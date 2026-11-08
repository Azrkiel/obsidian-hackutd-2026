"""ResetManager: countdown, ask the game to load a saved state, confirm from telemetry.

Two saved states:
  checkpoint  on the corner approach; every retry rewinds here
  resume      taken when a drill starts; "resume" loads it and the session carries on
              (udp and sim modes only: hotkey/manual have a single save slot)
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Any, Callable

from .telemetry import Sample

MODES = ("udp", "hotkey", "manual", "sim")


# --- UDP to the CSP Lua app ------------------------------------------------------------------
class _Proto(asyncio.DatagramProtocol):
    def __init__(self) -> None:
        self.q: asyncio.Queue[str] = asyncio.Queue()

    def datagram_received(self, data: bytes, addr: Any) -> None:
        self.q.put_nowait(data.decode("utf-8", "replace").strip())


async def udp_roundtrip(addr: tuple[str, int], msg: str, expect: str, timeout: float) -> str | None:
    """Send msg, return the first reply starting with `expect`, or None on timeout."""
    loop = asyncio.get_running_loop()
    transport, proto = await loop.create_datagram_endpoint(_Proto, remote_addr=addr)
    try:
        transport.sendto(msg.encode())
        deadline = loop.time() + timeout
        while True:
            left = deadline - loop.time()
            if left <= 0:
                return None
            try:
                reply = await asyncio.wait_for(proto.q.get(), left)
            except asyncio.TimeoutError:
                return None
            if reply.startswith(expect):
                return reply
    finally:
        transport.close()


# --- keyboard (Windows SendInput, scan codes) ---------------------------------------------------
def press_key(name: str, hold_s: float = 0.05) -> None:  # untested: needs Windows + a game window
    """Tap a key (F1-F12 or a single letter/digit) with SendInput using hardware scan codes."""
    if sys.platform != "win32":
        raise RuntimeError("hotkey mode is Windows-only")
    import ctypes
    import time
    from ctypes import wintypes
    name = name.upper()
    vk = 0x70 + int(name[1:]) - 1 if name.startswith("F") and name[1:].isdigit() else ord(name[0])
    u32 = ctypes.windll.user32
    scan = u32.MapVirtualKeyW(vk, 0)

    class KEYBDINPUT(ctypes.Structure):
        _fields_ = [("wVk", wintypes.WORD), ("wScan", wintypes.WORD), ("dwFlags", wintypes.DWORD),
                    ("time", wintypes.DWORD), ("dwExtraInfo", ctypes.c_size_t)]

    class MOUSEINPUT(ctypes.Structure):  # only to give the union its real size
        _fields_ = [("dx", wintypes.LONG), ("dy", wintypes.LONG), ("mouseData", wintypes.DWORD),
                    ("dwFlags", wintypes.DWORD), ("time", wintypes.DWORD),
                    ("dwExtraInfo", ctypes.c_size_t)]

    class _U(ctypes.Union):
        _fields_ = [("ki", KEYBDINPUT), ("mi", MOUSEINPUT)]

    class INPUT(ctypes.Structure):
        _fields_ = [("type", wintypes.DWORD), ("u", _U)]

    def send(flags: int) -> None:
        inp = INPUT(1, _U(ki=KEYBDINPUT(0, scan, 0x0008 | flags, 0, 0)))  # KEYEVENTF_SCANCODE
        u32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))

    send(0)
    time.sleep(hold_s)
    send(0x0002)  # KEYEVENTF_KEYUP


class ResetManager:
    def __init__(self, mode: str, emit: Callable[[dict], None], on_confirmed: Callable[[], None],
                 scorer: Any = None, sim: Any = None, checkpoint_path: str | Path | None = None,
                 countdown: int = 3, tick_s: float = 1.0, confirm_timeout_s: float | None = None,
                 udp_addr: tuple[str, int] = ("127.0.0.1", 9101), udp_ack_s: float = 2.0,
                 load_key: str = "F7", save_key: str = "F6", pos_tol_m: float = 20.0,
                 speed_tol_kmh: float = 10.0, run_wait_s: float = 15.0,
                 on_resumed: Callable[[], None] | None = None):
        if mode not in MODES:
            raise ValueError(f"reset mode must be one of {MODES}")
        self.mode, self.emit, self.on_confirmed, self.on_resumed = mode, emit, on_confirmed, on_resumed
        self.scorer, self.sim = scorer, sim
        self.checkpoint_path = Path(checkpoint_path) if checkpoint_path else None
        self.countdown, self.tick_s = countdown, tick_s
        self.confirm_timeout_s = confirm_timeout_s or (30.0 if mode == "manual" else 8.0)
        self.udp_addr, self.udp_ack_s = udp_addr, udp_ack_s
        self.load_key, self.save_key = load_key, save_key
        self.pos_tol_m, self.speed_tol_kmh, self.run_wait_s = pos_tol_m, speed_tol_kmh, run_wait_s
        self.checkpoint: dict | None = None
        self.resume_point: dict | None = None
        self.last: Sample | None = None
        self.last_decision_id: str | None = None
        self.last_slot = "checkpoint"
        self.status = "idle"   # idle | countdown | loading | confirming | failed
        self.busy = False
        self._waiting = False
        self._confirmed = asyncio.Event()
        self._target: dict | None = None
        if self.checkpoint_path and self.checkpoint_path.exists():
            try:
                self.checkpoint = json.loads(self.checkpoint_path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                pass

    def _status(self, s: str) -> None:
        self.status = s

    # -- telemetry feed --
    def on_sample(self, s: Sample) -> None:
        self.last = s
        if self._waiting and self._target and self._near(s):
            self._confirmed.set()

    def _near(self, s: Sample) -> bool:
        cp = self._target
        return (abs(s.pos_m - cp["pos_m"]) <= self.pos_tol_m
                and abs(s.speed_kmh - cp["speed_kmh"]) <= self.speed_tol_kmh)

    # -- checkpoint --
    def set_checkpoint(self, pos_m: float, speed_kmh: float) -> None:
        self.checkpoint = {"pos_m": float(pos_m), "speed_kmh": float(speed_kmh)}
        if self.checkpoint_path:
            self.checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
            self.checkpoint_path.write_text(json.dumps(self.checkpoint), encoding="utf-8")
        self.emit({"type": "checkpoint", **self.checkpoint})

    async def save_checkpoint(self) -> bool:
        if self.last is None:
            self.emit({"type": "status", "message": "ignored: no telemetry, cannot save checkpoint"})
            return False
        s = self.last
        if self.mode == "udp":
            reply = await udp_roundtrip(self.udp_addr, "SAVE", "SAVED", self.udp_ack_s)
            if reply is None:
                self.emit({"type": "status", "message": "checkpoint: no SAVED reply from the Lua app"})
        elif self.mode == "hotkey":
            await asyncio.to_thread(press_key, self.save_key)
        self.set_checkpoint(s.pos_m, s.speed_kmh)
        return True

    @property
    def can_resume(self) -> bool:
        return self.mode in ("udp", "sim")

    async def save_resume_point(self) -> bool:
        """Remember where the driver was before the drill so `resume` can put them back."""
        if not self.can_resume:
            self.emit({"type": "status", "message": f"resume is not available in {self.mode} reset mode"})
            return False
        if self.last is None:
            self.emit({"type": "status", "message": "no telemetry, cannot save the resume point"})
            return False
        s = self.last
        if self.mode == "udp":
            reply = await udp_roundtrip(self.udp_addr, "SAVE resume", "SAVED", self.udp_ack_s)
            if reply is None:
                self.emit({"type": "status", "message": "resume point: no SAVED reply from the Lua app"})
                return False
        self.resume_point = {"pos_m": float(s.pos_m), "speed_kmh": float(s.speed_kmh)}
        self.emit({"type": "resume_point", **self.resume_point})
        return True

    def clear_resume_point(self) -> None:
        self.resume_point = None

    # -- reset --
    async def _request_load(self, decision_id: str, slot: str = "checkpoint") -> None:
        target = self._target
        if self.mode == "sim":
            self.sim.teleport_to(target["pos_m"], target["speed_kmh"])
        elif self.mode == "udp":
            verb = "RESUME" if slot == "resume" else "RESET"
            ack = await udp_roundtrip(self.udp_addr, f"{verb} {decision_id}", f"ACK {decision_id}",
                                      self.udp_ack_s)
            if ack is None:  # telemetry is the source of truth; keep waiting for it
                self.emit({"type": "status", "message": "no ACK from the Lua app; waiting on telemetry"})
        elif self.mode == "hotkey":
            await asyncio.to_thread(press_key, self.load_key)
        else:
            self.emit({"type": "prompt", "message": "Press your load key now"})

    def _fail(self, reason: str) -> bool:
        self._status("failed")
        self.emit({"type": "reset_failed", "reason": reason, "mode": self.mode})
        return False

    async def retry(self) -> bool:
        """Repeat the last failed load (checkpoint or resume point)."""
        if self.last_slot == "resume":
            return await self.reset(self.last_decision_id or "resume", abort_run=True, slot="resume")
        return await self.reset(self.last_decision_id or "retry")

    async def resume(self, decision_id: str = "resume") -> bool:
        """Load the resume point (pre-drill state). Aborts a run in progress."""
        if self.resume_point is None:
            self.emit({"type": "status", "message": "ignored: no resume point saved"})
            return False
        return await self.reset(decision_id, abort_run=True, slot="resume")

    async def reset(self, decision_id: str, abort_run: bool = False, slot: str = "checkpoint") -> bool:
        if self.busy:
            self.emit({"type": "status", "message": "ignored: reset already in progress"})
            return False
        self.busy, self.last_decision_id, self.last_slot = True, decision_id, slot
        try:
            if self.scorer is not None and self.scorer.in_run:
                if abort_run:
                    self.scorer.abort()
                else:
                    loop = asyncio.get_running_loop()
                    end = loop.time() + self.run_wait_s
                    while self.scorer.in_run and loop.time() < end:
                        await asyncio.sleep(0.05)
                    if self.scorer.in_run:
                        return self._fail("run in progress")
            self._target = self.resume_point if slot == "resume" else self.checkpoint
            if not self._target:
                return self._fail("no resume point saved" if slot == "resume" else "no checkpoint saved")
            self._status("countdown")
            for n in range(self.countdown, 0, -1):
                self.emit({"type": "countdown", "n": n})
                await asyncio.sleep(self.tick_s)
            self.emit({"type": "countdown", "n": 0})
            self._status("loading")
            self.emit({"type": "reset_request", "decision_id": decision_id, "mode": self.mode, "slot": slot})
            self._confirmed.clear()
            self._waiting = True
            await self._request_load(decision_id, slot)
            self._status("confirming")
            try:
                await asyncio.wait_for(self._confirmed.wait(), self.confirm_timeout_s)
            except asyncio.TimeoutError:
                return self._fail("timeout waiting for the car at the " + ("resume point" if slot == "resume" else "checkpoint"))
            finally:
                self._waiting = False
            self._status("idle")
            self.emit({"type": "reset_confirmed", "decision_id": decision_id, "slot": slot})
            if slot == "resume":
                self.resume_point = None
                if self.on_resumed:
                    self.on_resumed()
            else:
                self.on_confirmed()
            return True
        except Exception as e:  # noqa: BLE001 - never wedge the busy flag
            return self._fail(f"{type(e).__name__}: {e}")
        finally:
            self.busy = False
            self._waiting = False
