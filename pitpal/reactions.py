"""Instant reactions: Rev reacts to the live telemetry feed with local rules, no model in the loop.

The slip and g thresholds are first guesses: the coach notes that slip units and signs are not yet
verified in the game, so every number lives in `Thresholds` for tuning on the game PC.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Moment:
    """One short thing for Rev to show: a bubble and an animation, for a few seconds."""
    bold: str
    rest: str = ""
    kind: str = "text"       # text | warn
    anim: str = "idle"       # idle | hop | wince | warn
    dur: float = 2.0
    key: str = ""            # moments with the same key replace each other


@dataclass
class Thresholds:
    racing_kmh: float = 30.0        # below this we are not "driving", so no reactions
    lock_brake: float = 0.8         # brake pedal this hard ...
    lock_slip: float = 0.35         # ... with the front tyres slipping this much = lock-up
    off_tyres: int = 3              # wheels off the track
    off_hold_s: float = 0.3
    slide_slip: float = 0.5         # rear slip under power = a slide
    slide_gas: float = 0.5
    cooldown_s: float = 8.0         # the same reaction never repeats faster than this


class Reactor:
    def __init__(self, th: Thresholds | None = None):
        self.th = th or Thresholds()
        self._last: dict[str, float] = {}
        self._off_since: float | None = None

    def _ready(self, name: str, now: float) -> bool:
        if now - self._last.get(name, -1e9) < self.th.cooldown_s:
            return False
        self._last[name] = now
        return True

    def feed(self, t: dict, now: float) -> Moment | None:
        th = self.th
        if t.get("status") != "live" or t.get("speed_kmh", 0.0) < th.racing_kmh:
            self._off_since = None
            return None
        if t.get("tyres_out", 0) >= th.off_tyres:
            self._off_since = self._off_since if self._off_since is not None else now
            if now - self._off_since >= th.off_hold_s and self._ready("off", now):
                return Moment("Wheels off.", "", "warn", "wince", 1.6, "off")
            return None
        self._off_since = None
        if t.get("brake", 0.0) >= th.lock_brake and t.get("slip_f", 0.0) >= th.lock_slip \
                and self._ready("lock", now):
            return Moment("Lock-up.", "", "warn", "wince", 1.5, "lock")
        if t.get("gas", 0.0) >= th.slide_gas and t.get("slip_r", 0.0) >= th.slide_slip \
                and self._ready("slide", now):
            return Moment("Easy on throttle.", "", "text", "wince", 1.5, "slide")
        return None
