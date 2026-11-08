"""Stealth Racing wire protocol: parsing and safety helpers (standard library only).

Packets from the phone (UTF-8 CSV over UDP):
    v1,<seq>,<steer>,<throttle>,<brake>      ~100 Hz control state
    evt,<id>,<command>,<tap|down|up>         discrete action, sent 3x per id
"""

import math
import re
import time
from collections import deque
from dataclasses import dataclass

PHASES = ("tap", "down", "up")
_COMMAND = re.compile(r"[a-z][a-z0-9_]{0,31}")


@dataclass(frozen=True)
class ControlPacket:
    seq: int
    steer: float     # -1 (left) .. 1 (right)
    throttle: float  # 0 .. 1
    brake: float     # 0 .. 1


@dataclass(frozen=True)
class EventPacket:
    id: int
    command: str
    phase: str


def clamp(value, low, high):
    return min(high, max(low, value))


def _finite(text):
    value = float(text)
    if not math.isfinite(value):
        raise ValueError(text)
    return value


def parse_packet(data):
    """Return a ControlPacket, EventPacket, or None for anything malformed."""
    try:
        fields = data.decode("ascii").strip().split(",")
    except (UnicodeDecodeError, AttributeError):
        return None

    if fields[0] == "v1" and len(fields) == 5 and fields[1].isdigit():
        try:
            steer, throttle, brake = (_finite(f) for f in fields[2:])
        except ValueError:
            return None
        return ControlPacket(
            int(fields[1]),
            clamp(steer, -1.0, 1.0),
            clamp(throttle, 0.0, 1.0),
            clamp(brake, 0.0, 1.0),
        )

    if (fields[0] == "evt" and len(fields) == 4 and fields[1].isdigit()
            and _COMMAND.fullmatch(fields[2]) and fields[3] in PHASES):
        return EventPacket(int(fields[1]), fields[2], fields[3])

    return None


class EventDeduper:
    """Each event arrives up to three times; only the first copy counts."""

    def __init__(self, size=64):
        self._size = size
        self._recent = {}  # sender -> deque of recent event ids

    def is_new(self, sender, event_id):
        recent = self._recent.setdefault(sender, deque(maxlen=self._size))
        if event_id in recent:
            return False
        recent.append(event_id)
        return True


def merge_pedals(phone, arduino):
    """Combine (throttle, brake) pairs with max(); None means that source is missing."""
    sources = [p for p in (phone, arduino) if p is not None]
    if not sources:
        return 0.0, 0.0
    return max(s[0] for s in sources), max(s[1] for s in sources)


class Watchdog:
    """Expires when no control packet has arrived for `timeout` seconds."""

    def __init__(self, timeout=0.25, clock=time.monotonic):
        self.timeout = timeout
        self._clock = clock
        self._last = None

    def feed(self):
        self._last = self._clock()

    def expired(self):
        return self._last is None or self._clock() - self._last > self.timeout
