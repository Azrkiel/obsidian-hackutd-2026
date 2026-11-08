"""InputHub: phone (UDP) + Arduino pedals (serial or UDP) -> one virtual Xbox 360 pad, inside the coach.

Inputs
  phone    UDP :5005   "v1,<seq>,<steer>,<throttle>,<brake>"   steer -1..1, pedals 0..1, ~100 Hz
                       "evt,<id>,<command>,<tap|down|up>"     buttons, each id sent 3x
                         (coach_next / coach_resume are coach commands, not pad buttons)
                       reply "ack,<seq>" when seq % 30 == 0 so the app shows "Receiver confirmed"
                       paired phones (QR, coach/pairing.py) sign every packet and get signed acks
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
import json
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

from .pairing import Pairing, Session, looks_signed, sign, verify

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
# Phone commands for the coach itself (not pad buttons): "next" accepts an offer or rewinds for a
# retry, "resume" ends a drill and loads the resume point.
COACH_COMMANDS = {"coach_next": "next", "coach_resume": "resume"}
# Phone commands that pick who drives the pedals: the app's "On-screen pedals" toggle sends these.
# "phone" = the phone's pedals even while the Arduino is plugged in and sending; "auto" = Arduino first.
PEDAL_COMMANDS = {"pedals_phone": "phone", "pedals_auto": "auto"}
PEDAL_MODES = ("auto", "phone")
DROPOUT_PCT = 10  # % of a run with no pedal input that makes the run not count
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
        self.phone_drops = self.pedal_drops = self.arduino_drops = 0
        self._phone_live = self._pedals_live = self._ard_live = None
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
        if self._ard_live and not state["arduino_live"] and state.get("pedal_mode") != "phone":
            self.arduino_drops += 1
        self._phone_live, self._pedals_live = state["phone_live"], pedals_live
        self._ard_live = state["arduino_live"]
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
            "arduino_link_drops": self.arduino_drops,
            "input_vs_game_pedal_gap": round(self.gap_sum / self.gap_n, 2) if self.gap_n else None,
        }


def dropout_reason(summary: dict | None) -> str | None:
    """Why a run must not count because an input cut out, or None.

    A run where the receiver never saw pedals or the phone (e.g. the driver used a real wheel) is
    left alone. Otherwise: phone lost mid-run -> steering went to centre; Arduino lost, or pedals
    gone for more than DROPOUT_PCT of the run -> the game saw the pedals let go, not the driver."""
    if not summary:
        return None
    if summary["phone_link_drops"]:
        return "steering_dropout"
    if summary["arduino_link_drops"] or summary["pedal_link_drops"]:
        return "pedal_dropout"
    if summary["pedal_source"] != "none" and summary["no_pedal_input_pct"] > DROPOUT_PCT:
        return "pedal_dropout"
    return None


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
                if self.hub.race_history is not None and reply.startswith(b"ack,"):
                    history = json.dumps({"type": "race_history", "history": self.hub.race_history},
                                         separators=(",", ":")).encode()
                    session = self.hub.sessions.get(addr)
                    self.transport.sendto(sign(session.key, history) if session else history, addr)
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
    race_history: dict | None = None
    def __init__(self, pad: Any = None, phone_port: int = 5005, arduino: str = "auto",
                 arduino_udp_port: int | None = None, invert_steer: bool = False,
                 emit: Callable[[dict], None] | None = None, clock: Callable[[], float] = time.monotonic,
                 advertise: bool = True, gas_gamma: float = 1.0, brake_gamma: float = 1.0,
                 pairing: Pairing | None = None, pairing_mode: str = "optional"):
        self.pad = pad or NullPad()
        # pedal response curves sent to the game: out = in ** gamma (0 and 1 unchanged; >1 = gentler start)
        self.gas_gamma, self.brake_gamma = gas_gamma, brake_gamma
        self.phone_port, self.arduino, self.arduino_udp_port = phone_port, arduino, arduino_udp_port
        self.invert, self.emit, self.clock, self.advertise = invert_steer, emit or (lambda e: None), clock, advertise
        self.on_command: Callable[[str], None] | None = None  # set by the coach
        # QR pairing: "off" = plain packets only; "optional" = plain packets accepted only until the
        # first phone pairs, then signed only (another device on the Wi-Fi can't join in unsigned);
        # "required" = signed only
        self.pairing = pairing
        self.pairing_mode = pairing_mode if pairing is not None else "off"
        self.sessions: dict[Any, Session] = {}
        self._phones: dict[Any, float] = {}     # address -> last control packet (for pushes)
        self.rejected = 0
        self._lock = threading.Lock()  # the serial reader runs in a thread
        self.steer = self.p_gas = self.p_brake = 0.0
        self.a_gas = self.a_brake = 0.0
        self.pedal_mode = "auto"   # "auto" = Arduino while fresh, else phone; "phone" = phone only
        self.t_phone = self.t_ard = float("-inf")
        self._seq: dict[Any, int] = {}
        self._events: dict[Any, deque] = {}
        self._held_phone: set[str] = set()
        self._releases: list[tuple[float, str]] = []
        self._release_due: dict[str, float] = {}
        self.out = {"steer": 0.0, "gas": 0.0, "brake": 0.0, "pedal_source": "none",
                    "phone_live": False, "arduino_live": False, "pedal_mode": "auto"}
        self.senders: set[str] = set()
        self.serial_port: str | None = None
        self.serial_error: str | None = None
        self._tasks: list[asyncio.Task] = []
        self._transports: list[Any] = []
        self._stop = threading.Event()
        self._dns: subprocess.Popen | None = None

    # -- feeds (sync, safe to call from tests) --
    def feed_phone(self, data: bytes, addr: Any) -> bytes | None:
        session = None
        if self.pairing_mode != "off":
            if data.startswith(b"h1,"):
                return self._hello(data, addr)
            session = self.sessions.get(addr)
            if session is not None:
                data = verify(session.key, data)
                if data is None:                      # unsigned, or signed with the wrong key
                    return self._reject(addr, "bad signature")
            elif looks_signed(data):
                return b"rehello"                     # we restarted or rotated: ask for a new hello
            elif self.pairing_mode == "required" or self.sessions:
                return self._reject(addr, "unpaired")
        p = parse_phone(data)
        if p is None:
            return None
        host = str(addr[0]).removeprefix("::ffff:") if addr else "?"
        if host not in self.senders:
            self.senders.add(host)
            self.emit({"type": "input", "message": f"phone connected from {host}"})
        if p[0] == "v1":
            _, seq, steer, thr, brk = p
            if session is not None:
                if seq <= session.last_seq:           # signed sessions never go back: no replays
                    return None
                session.last_seq = seq
            else:
                last = self._seq.get(addr, -1)
                if seq <= last and last - seq < 1000:  # late/duplicate packet; big jump back = app restart
                    return None
                self._seq[addr] = seq
            with self._lock:
                self.steer = -steer if self.invert else steer
                self.p_gas, self.p_brake, self.t_phone = thr, brk, self.clock()
            self._phones[addr] = self.clock()
            if seq % 30:
                return None
            ack = b"ack,%d" % seq
            return sign(session.key, ack) if session is not None else ack
        _, eid, command, phase = p
        recent = self._events.setdefault(addr, deque(maxlen=64))
        if eid in recent:
            return None
        recent.append(eid)
        self.handle_event(command, phase)
        return None

    def _hello(self, data: bytes, addr: Any) -> bytes | None:
        answer = self.pairing.welcome(data)
        if answer is None:
            return self._reject(addr, "bad pairing hello (old QR code?)")
        welcome, session = answer
        new = addr not in self.sessions
        self.sessions[addr] = session
        self._seq.pop(addr, None)
        self._events.pop(addr, None)
        if new:
            host = str(addr[0]).removeprefix("::ffff:")
            self.emit({"type": "input", "message": f"phone paired from {host}"})
        return welcome

    def _reject(self, addr: Any, why: str) -> None:
        self.rejected += 1
        if self.rejected == 1 or self.rejected % 500 == 0:  # don't flood the activity log
            host = str(addr[0]).removeprefix("::ffff:") if addr else "?"
            self.emit({"type": "input", "message": f"ignored packets from {host}: {why} ({self.rejected})"})
        return None

    def new_pairing_code(self) -> None:
        """Rotate the key: every paired phone must scan the new code."""
        if self.pairing is not None:
            self.pairing.rotate()
            self.sessions.clear()
            self.emit({"type": "input", "message": "new pairing code: phones must scan again"})

    def pairing_status(self) -> dict | None:
        if self.pairing is None or self.pairing_mode == "off":
            return None
        return {"mode": self.pairing_mode, "id": self.pairing.receiver_id, "name": self.pairing.name,
                "hosts": self.pairing.hosts(), "port": self.phone_port, "paired": len(self.sessions),
                "rejected": self.rejected}

    def feed_arduino(self, line: str) -> bool:
        r = parse_arduino(line)
        if r is None:
            return False
        with self._lock:
            self.a_gas, self.a_brake = r
            self.t_ard = self.clock()
        return True

    def set_pedal_mode(self, mode: str) -> bool:
        """Who drives gas/brake: "auto" (Arduino first, phone fallback) or "phone" (phone only)."""
        if mode not in PEDAL_MODES:
            return False
        if mode != self.pedal_mode:
            self.pedal_mode = mode
            self.emit({"type": "input", "message": "pedals: phone (Arduino on standby)" if mode == "phone"
                       else "pedals: Arduino first, phone as fallback"})
        return True

    def handle_event(self, command: str, phase: str) -> str | None:
        if command in PEDAL_COMMANDS:
            if phase != "up":
                self.set_pedal_mode(PEDAL_COMMANDS[command])
            return None
        if command in COACH_COMMANDS:
            if phase != "up":
                name = COACH_COMMANDS[command]
                self.emit({"type": "input", "message": f"phone: {name}"})
                if self.on_command is not None:
                    self.on_command(name)
            return None
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
            if ard and self.pedal_mode != "phone":
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
        gas, brake = gas ** self.gas_gamma, brake ** self.brake_gamma
        prev = self.out
        self.out = {"steer": steer, "gas": gas, "brake": brake, "pedal_source": src,
                    "phone_live": phone, "arduino_live": ard, "pedal_mode": self.pedal_mode}
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
                "arduino": ("standby" if self.pedal_mode == "phone" else
                            "live" if o["arduino_live"] else ("off" if self.arduino == "off"
                                                              and not self.arduino_udp_port else "silent")),
                "pedal_mode": self.pedal_mode,
                "serial_port": self.serial_port, "serial_error": self.serial_error,
                "pad": type(self.pad).__name__, "pairing": self.pairing_status()}

    def neutralize(self) -> None:
        self.pad.set_axes(0.0, 0.0, 0.0)
        for b in sorted(self._held_phone | set(self._release_due)):
            self.pad.release(b)
        self._held_phone.clear()
        self._release_due.clear()
        self._releases.clear()
        self.pad.update()

    # -- receiver -> phone pushes (whole-lap retry offers: ofr / ofx) --
    def phone_packets(self, text: str, live_s: float = 2.0) -> list[tuple[bytes, Any]]:
        """The datagram for each phone driving right now: signed with its session when paired
        (plain only where plain packets are still accepted)."""
        now, out = self.clock(), []
        data = text.encode()
        for addr, seen in list(self._phones.items()):
            if now - seen > live_s:
                del self._phones[addr]
                continue
            session = self.sessions.get(addr)
            if session is not None:
                out.append((sign(session.key, data), addr))
            elif self.pairing_mode == "off" or (self.pairing_mode == "optional" and not self.sessions):
                out.append((data, addr))
        return out

    def send_phone(self, text: str) -> int:
        if not self._transports:
            return 0
        n = 0
        for data, addr in self.phone_packets(text):
            try:
                self._transports[0].sendto(data, addr)
                n += 1
            except OSError:
                pass
        return n

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
            name = f"Pit Pal - {socket.gethostname().split('.')[0]}"
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
                        self.feed_arduino(newest_line(ser))
            except (serial.SerialException, OSError) as e:
                self.serial_port, self.serial_error = None, str(e)
                time.sleep(1)


def newest_line(ser: Any, backlog: int = 40) -> str:
    """Next serial line, skipping ahead when readings pile up (same as hardware/bridge.py), so a
    slow moment never leaves the pedals lagging behind the driver's feet."""
    line = ser.readline()
    while ser.in_waiting > backlog:
        line = ser.readline()
    return line.decode(errors="ignore")


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


class _NoDualStack(OSError):
    """IPv6 dual-stack is unavailable on this machine: fall back to IPv4 only."""


def _dual_stack_socket(port: int) -> socket.socket:
    """Bind IPv4 and IPv6 where supported (the phone may use either), else IPv4 only.

    On Windows the port is bound exclusively. Without it, a dual-stack bind next to another program's
    IPv4 socket on the same port (bridge/bridge.py, hardware/bridge.py, listen.py) succeeds silently and
    Windows delivers every phone packet to the other program, so the coach would never see the phone."""
    def exclusive(s: socket.socket) -> None:
        if sys.platform == "win32":
            s.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)

    try:
        try:
            s = socket.socket(socket.AF_INET6, socket.SOCK_DGRAM)
        except OSError as e:  # no IPv6 on this machine
            raise _NoDualStack() from e
        try:
            exclusive(s)
            s.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
            s.bind(("::", port))
        except OSError as e:
            s.close()
            if getattr(e, "winerror", None) in (10013, 10048):  # port taken: don't fall back to IPv4
                raise
            raise _NoDualStack() from e
    except _NoDualStack:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        exclusive(s)
        s.bind(("", port))
    s.setblocking(False)
    return s


def make_pad(kind: str) -> Any:
    if kind == "auto":
        kind = "vgamepad" if sys.platform == "win32" else "none"
    return VGamepadPad() if kind == "vgamepad" else NullPad()
