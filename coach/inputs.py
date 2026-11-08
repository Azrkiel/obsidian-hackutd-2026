"""InputHub: phone (UDP) + Arduino pedals (serial or UDP) -> one virtual Xbox 360 pad, inside the coach.

Inputs
  phone    UDP :5005   "v1,<seq>,<steer>,<throttle>,<brake>"   steer -1..1, pedals 0..1, ~100 Hz
                       "evt,<id>,<command>,<tap|down|up>"     buttons, each id sent 3x
                       reply "ack,<seq>" when seq % 30 == 0 so the app shows "Receiver confirmed"
  arduino  serial      "gas,brake" ints 0..1000 per line (hardware/pedals/pedals.ino); "#..." ignored
           UDP (opt.)  the same "gas,brake" text, one reading per datagram
Mixing
  steering   always from the phone (0 when the phone is silent)
  gas/brake  Arduino while it is fresh; otherwise the phone's fallback pedals; otherwise 0
Failsafe
  a source is stale after 200 ms. Phone stale -> steer 0 and its held buttons released.
  Everything stale -> neutral pad, all buttons released.
"""
from __future__ import annotations

import asyncio
import heapq
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
from collections import deque
from dataclasses import dataclass
from typing import Any, Callable

STALE_S = 0.2
TICK_S = 0.005
TAP_S = 0.06
SERVICE_TYPE = "_stealth-racing._udp"

# Phone command -> virtual pad button (names are vgamepad XUSB_BUTTON members without the prefix).
BINDINGS = {
    "shift_up": "RIGHT_SHOULDER",
    "shift_down": "LEFT_SHOULDER",
    "pit_limiter": "Y",
    "drs": "X",
    "headlights": "DPAD_UP",
    "horn": "A",            # held: down/up
    "look_back": "B",       # held: down/up
    "tc_down": "DPAD_LEFT",
    "tc_up": "DPAD_RIGHT",
    "abs_down": "LEFT_THUMB",
    "abs_up": "RIGHT_THUMB",
    "camera": "BACK",
}
_COMMAND = re.compile(r"[a-z][a-z0-9_]{0,31}")


def _clamp(v: float, lo: float, hi: float) -> float:
    return min(hi, max(lo, v))


def _num(text: str) -> float:
    v = float(text)
    if v != v or v in (float("inf"), float("-inf")):
        raise ValueError(text)
    return v


def parse_phone(data: bytes) -> tuple | None:
    """("v1", seq, steer, throttle, brake) | ("evt", id, command, phase) | None."""
    try:
        f = data.decode("ascii").strip().split(",")
    except UnicodeDecodeError:
        return None
    if f[0] == "v1" and len(f) == 5 and f[1].isdigit():
        try:
            steer, thr, brk = (_num(x) for x in f[2:])
        except ValueError:
            return None
        return "v1", int(f[1]), _clamp(steer, -1.0, 1.0), _clamp(thr, 0.0, 1.0), _clamp(brk, 0.0, 1.0)
    if f[0] == "evt" and len(f) == 4 and f[1].isdigit() and _COMMAND.fullmatch(f[2]) \
            and f[3] in ("tap", "down", "up"):
        return "evt", int(f[1]), f[2], f[3]
    return None


def parse_arduino(line: str) -> tuple[float, float] | None:
    """'gas,brake' with ints 0..1000 -> (gas, brake) in 0..1."""
    line = line.strip()
    if not line or line[0] == "#":
        return None
    parts = line.split(",")
    if len(parts) != 2:
        return None
    try:
        g, b = int(parts[0]), int(parts[1])
    except ValueError:
        return None
    return _clamp(g, 0, 1000) / 1000.0, _clamp(b, 0, 1000) / 1000.0


# --- pads ---------------------------------------------------------------------------------------
class NullPad:
    """Keeps the last output; used for --pad none, the simulator and tests."""

    def __init__(self) -> None:
        self.axes = (0.0, 0.0, 0.0)
        self.buttons: set[str] = set()
        self.log: list[tuple] = []

    def set_axes(self, steer: float, gas: float, brake: float) -> None:
        self.axes = (steer, gas, brake)

    def press(self, button: str) -> None:
        self.buttons.add(button)
        self.log.append(("press", button))

    def release(self, button: str) -> None:
        self.buttons.discard(button)
        self.log.append(("release", button))

    def update(self) -> None:
        pass


class VGamepadPad:
    """Virtual Xbox 360 controller (Windows, needs the ViGEmBus driver and `pip install vgamepad`)."""

    def __init__(self) -> None:
        try:
            import vgamepad as vg
        except ImportError as e:
            raise RuntimeError("vgamepad is not available. Start the coach with "
                               "`uv run --with vgamepad --with pyserial python -m coach ... --inputs` "
                               "(ViGEmBus must be installed), or add --pad none") from e
        self._xb = vg.XUSB_BUTTON
        self._pad = vg.VX360Gamepad()

    def set_axes(self, steer: float, gas: float, brake: float) -> None:
        self._pad.left_joystick_float(x_value_float=steer, y_value_float=0.0)
        self._pad.right_trigger_float(value_float=gas)
        self._pad.left_trigger_float(value_float=brake)

    def press(self, button: str) -> None:
        self._pad.press_button(button=getattr(self._xb, "XUSB_GAMEPAD_" + button))

    def release(self, button: str) -> None:
        self._pad.release_button(button=getattr(self._xb, "XUSB_GAMEPAD_" + button))

    def update(self) -> None:
        self._pad.update()


# --- per-run input summary (sent to the coach with each scored attempt) --------------------------
class RunInputs:
    def __init__(self) -> None:
        self.n = 0
        self.by_source = {"arduino": 0, "phone": 0, "none": 0}
        self.phone_drops = self.pedal_drops = 0
        self._phone_live = self._pedals_live = None
        self.gap_sum = 0.0
        self.gap_n = 0

    def add(self, state: dict, game_gas: float | None = None, game_brake: float | None = None) -> None:
        self.n += 1
        self.by_source[state["pedal_source"]] += 1
        if self._phone_live and not state["phone_live"]:
            self.phone_drops += 1
        pedals_live = state["pedal_source"] != "none"
        if self._pedals_live and not pedals_live:
            self.pedal_drops += 1
        self._phone_live, self._pedals_live = state["phone_live"], pedals_live
        if game_brake is not None and game_gas is not None:
            self.gap_sum += abs(state["brake"] - game_brake) + abs(state["gas"] - game_gas)
            self.gap_n += 2

    def summary(self) -> dict | None:
        if not self.n:
            return None
        used = [k for k in ("arduino", "phone") if self.by_source[k]]
        return {
            "pedal_source": used[0] if len(used) == 1 else "mixed" if used else "none",
            "phone_fallback_pct": round(100 * self.by_source["phone"] / self.n),
            "no_pedal_input_pct": round(100 * self.by_source["none"] / self.n),
            "phone_link_drops": self.phone_drops,
            "pedal_link_drops": self.pedal_drops,
            "input_vs_game_pedal_gap": round(self.gap_sum / self.gap_n, 2) if self.gap_n else None,
        }


# --- hub ------------------------------------------------------------------------------------------
class _PhoneProto(asyncio.DatagramProtocol):
    def __init__(self, hub: "InputHub") -> None:
        self.hub, self.transport = hub, None

    def connection_made(self, transport: Any) -> None:
        self.transport = transport

    def datagram_received(self, data: bytes, addr: Any) -> None:
        reply = self.hub.feed_phone(data, addr)
        if reply and self.transport:
            try:
                self.transport.sendto(reply, addr)
            except OSError:
                pass

    def error_received(self, exc: Exception) -> None:  # Windows ICMP "connection reset"
        pass


class _ArduinoUdpProto(asyncio.DatagramProtocol):
    def __init__(self, hub: "InputHub") -> None:
        self.hub = hub

    def datagram_received(self, data: bytes, addr: Any) -> None:
        self.hub.feed_arduino(data.decode("ascii", "replace"))


class InputHub:
    def __init__(self, pad: Any = None, phone_port: int = 5005, arduino: str = "auto",
                 arduino_udp_port: int | None = None, invert_steer: bool = False,
                 emit: Callable[[dict], None] | None = None, clock: Callable[[], float] = time.monotonic,
                 advertise: bool = True):
        self.pad = pad or NullPad()
        self.phone_port, self.arduino, self.arduino_udp_port = phone_port, arduino, arduino_udp_port
        self.invert, self.emit, self.clock, self.advertise = invert_steer, emit or (lambda e: None), clock, advertise
        self._lock = threading.Lock()  # the serial reader runs in a thread
        self.steer = self.p_gas = self.p_brake = 0.0
        self.a_gas = self.a_brake = 0.0
        self.t_phone = self.t_ard = float("-inf")
        self._seq: dict[Any, int] = {}
        self._events: dict[Any, deque] = {}
        self._held_phone: set[str] = set()
        self._releases: list[tuple[float, str]] = []
        self._release_due: dict[str, float] = {}
        self.out = {"steer": 0.0, "gas": 0.0, "brake": 0.0, "pedal_source": "none",
                    "phone_live": False, "arduino_live": False}
        self.senders: set[str] = set()
        self.serial_port: str | None = None
        self.serial_error: str | None = None
        self._tasks: list[asyncio.Task] = []
        self._transports: list[Any] = []
        self._stop = threading.Event()
        self._dns: subprocess.Popen | None = None

    # -- feeds (sync, safe to call from tests) --
    def feed_phone(self, data: bytes, addr: Any) -> bytes | None:
        p = parse_phone(data)
        if p is None:
            return None
        host = str(addr[0]).removeprefix("::ffff:") if addr else "?"
        if host not in self.senders:
            self.senders.add(host)
            self.emit({"type": "input", "message": f"phone connected from {host}"})
        if p[0] == "v1":
            _, seq, steer, thr, brk = p
            last = self._seq.get(addr, -1)
            if seq <= last and last - seq < 1000:   # late/duplicate packet; big jump back = app restart
                return None
            self._seq[addr] = seq
            with self._lock:
                self.steer = -steer if self.invert else steer
                self.p_gas, self.p_brake, self.t_phone = thr, brk, self.clock()
            return b"ack,%d" % seq if seq % 30 == 0 else None
        _, eid, command, phase = p
        recent = self._events.setdefault(addr, deque(maxlen=64))
        if eid in recent:
            return None
        recent.append(eid)
        self.handle_event(command, phase)
        return None

    def feed_arduino(self, line: str) -> bool:
        r = parse_arduino(line)
        if r is None:
            return False
        with self._lock:
            self.a_gas, self.a_brake = r
            self.t_ard = self.clock()
        return True

    def handle_event(self, command: str, phase: str) -> str | None:
        button = BINDINGS.get(command)
        if button is None:
            self.emit({"type": "input", "message": f"unbound phone command {command}"})
            return None
        if phase == "tap":
            self.pad.press(button)
            due = self.clock() + TAP_S
            self._release_due[button] = due
            heapq.heappush(self._releases, (due, button))
        elif phase == "down":
            self._held_phone.add(button)
            self.pad.press(button)
        else:
            self._held_phone.discard(button)
            self.pad.release(button)
        self.pad.update()
        return button

    # -- mixing + output --
    def tick(self) -> dict:
        now = self.clock()
        while self._releases and self._releases[0][0] <= now:
            due, button = heapq.heappop(self._releases)
            if self._release_due.get(button) == due:
                del self._release_due[button]
                if button not in self._held_phone:
                    self.pad.release(button)
        with self._lock:
            phone = now - self.t_phone <= STALE_S
            ard = now - self.t_ard <= STALE_S
            steer = self.steer if phone else 0.0
            if ard:
                gas, brake, src = self.a_gas, self.a_brake, "arduino"
            elif phone:
                gas, brake, src = self.p_gas, self.p_brake, "phone"
            else:
                gas, brake, src = 0.0, 0.0, "none"
        if not phone and self._held_phone:
            for b in sorted(self._held_phone):
                self.pad.release(b)
            self._held_phone.clear()
        if not phone and not ard:
            for b in sorted(self._release_due):
                self.pad.release(b)
            self._release_due.clear()
            self._releases.clear()
        prev = self.out
        self.out = {"steer": steer, "gas": gas, "brake": brake, "pedal_source": src,
                    "phone_live": phone, "arduino_live": ard}
        if prev["pedal_source"] != src:
            self.emit({"type": "input", "message": f"pedals now from {src}"})
        self.pad.set_axes(steer, gas, brake)
        self.pad.update()
        return self.out

    def snapshot(self) -> dict:
        return dict(self.out)

    def status(self) -> dict:
        o = self.out
        return {"pedal_source": o["pedal_source"], "phone": "live" if o["phone_live"] else "silent",
                "arduino": "live" if o["arduino_live"] else ("off" if self.arduino == "off"
                                                               and not self.arduino_udp_port else "silent"),
                "serial_port": self.serial_port, "serial_error": self.serial_error,
                "pad": type(self.pad).__name__}

    def neutralize(self) -> None:
        self.pad.set_axes(0.0, 0.0, 0.0)
        for b in sorted(self._held_phone | set(self._release_due)):
            self.pad.release(b)
        self._held_phone.clear()
        self._release_due.clear()
        self._releases.clear()
        self.pad.update()

    # -- lifecycle --
    async def start(self) -> None:
        loop = asyncio.get_running_loop()
        transport, _ = await loop.create_datagram_endpoint(lambda: _PhoneProto(self),
                                                           sock=_bind(self.phone_port, "phone"))
        self._transports.append(transport)
        if self.arduino_udp_port:
            t, _ = await loop.create_datagram_endpoint(lambda: _ArduinoUdpProto(self),
                                                       sock=_bind(self.arduino_udp_port, "Arduino"))
            self._transports.append(t)
        if self.arduino != "off":
            threading.Thread(target=self._serial_loop, name="arduino-serial", daemon=True).start()
        if self.advertise:
            self._advertise()
        self._tasks.append(loop.create_task(self._tick_loop()))

    async def stop(self) -> None:
        self._stop.set()
        for t in self._tasks:
            t.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        for t in self._transports:
            t.close()
        self.neutralize()
        if self._dns:
            self._dns.terminate()

    async def _tick_loop(self) -> None:
        while True:
            self.tick()
            await asyncio.sleep(TICK_S)

    def _advertise(self) -> None:
        dns_sd = shutil.which("dns-sd")
        if dns_sd:
            name = f"NomadSim - {socket.gethostname().split('.')[0]}"
            self._dns = subprocess.Popen([dns_sd, "-R", name, SERVICE_TYPE, "local.", str(self.phone_port)],
                                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    def _serial_loop(self) -> None:  # untested: needs the Arduino plugged in
        try:
            import serial
            import serial.tools.list_ports as lp
        except ImportError:
            self.serial_error = "pyserial not installed"
            return
        while not self._stop.is_set():
            port = self.arduino if self.arduino != "auto" else _find_arduino(lp)
            if not port:
                time.sleep(1)
                continue
            try:
                with serial.Serial(port, 115200, timeout=0.1) as ser:
                    self.serial_port, self.serial_error = port, None
                    while not self._stop.is_set():
                        self.feed_arduino(ser.readline().decode(errors="ignore"))
            except (serial.SerialException, OSError) as e:
                self.serial_port, self.serial_error = None, str(e)
                time.sleep(1)


def _find_arduino(lp: Any) -> str | None:
    for p in lp.comports():
        d = (p.description or "").lower()
        if p.vid == 0x2341 or "arduino" in d or "ch340" in d or "usb serial" in d:
            return p.device
    return None


def _bind(port: int, what: str) -> socket.socket:
    try:
        return _dual_stack_socket(port)
    except OSError as e:
        raise RuntimeError(f"cannot listen for the {what} on UDP {port} ({e}). Is bridge/bridge.py, "
                           f"hardware/bridge.py or listen.py running? Stop it, or run without --inputs.") from e


def _dual_stack_socket(port: int) -> socket.socket:
    """Bind IPv4 and IPv6 where supported (the phone may use either), else IPv4 only."""
    try:
        s = socket.socket(socket.AF_INET6, socket.SOCK_DGRAM)
        try:
            s.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
            s.bind(("::", port))
        except OSError:
            s.close()
            raise
    except OSError:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.bind(("", port))
    s.setblocking(False)
    return s


def make_pad(kind: str) -> Any:
    if kind == "auto":
        kind = "vgamepad" if sys.platform == "win32" else "none"
    return VGamepadPad() if kind == "vgamepad" else NullPad()
