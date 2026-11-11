"""CrashWatch: spot a crash into a barrier, or a car stuck off the track, from telemetry alone.

    crash  speed drops by `drop_kmh` or more within `window_s` (normal braking loses about 18 km/h in
           that time; a wall takes far more), or a longitudinal-g spike with a clear speed loss
    stuck  nearly stopped with two or more tyres off the track for `stuck_s` seconds

Either one is reported once, then silenced for `cooldown_s`. Reports are also held off while a
rewind is running (the teleport itself looks like a sudden speed change). Pure logic: no I/O.
"""
from __future__ import annotations

from collections import deque
from typing import Any

CRASH, STUCK = "crash", "stuck"


class CrashWatch:
    def __init__(self, drop_kmh: float = 45.0, window_s: float = 0.5, min_kmh: float = 40.0,
                 g_spike: float = 4.0, g_min_drop_kmh: float = 15.0, stuck_s: float = 5.0,
                 stuck_kmh: float = 6.0, cooldown_s: float = 20.0):
        self.drop_kmh, self.window_s, self.min_kmh = drop_kmh, window_s, min_kmh
        self.g_spike, self.g_min_drop_kmh = g_spike, g_min_drop_kmh
        self.stuck_s, self.stuck_kmh, self.cooldown_s = stuck_s, stuck_kmh, cooldown_s
        self._hist: deque[tuple[float, float]] = deque()
        self._mute_until = self._cool_until = -1e9
        self._stuck_since: float | None = None

    def hold(self, t: float, seconds: float) -> None:
        """Ignore everything until t + seconds (call it every sample while a rewind is running)."""
        self._mute_until = max(self._mute_until, t + seconds)
        self._hist.clear()
        self._stuck_since = None

    def _fire(self, t: float, kind: str) -> str:
        self._cool_until = t + self.cooldown_s
        self._hist.clear()
        self._stuck_since = None
        return kind

    def feed(self, s: Any) -> str | None:
        """One telemetry sample (needs t, status, speed_kmh, tyres_out, g_lon). Returns "crash", "stuck" or None."""
        t = s.t
        if s.status != "live":
            self._hist.clear()
            self._stuck_since = None
            return None
        self._hist.append((t, s.speed_kmh))
        while self._hist and t - self._hist[0][0] > self.window_s:
            self._hist.popleft()
        if t < self._mute_until or t < self._cool_until:
            self._stuck_since = None
            return None
        peak = max(v for _, v in self._hist)
        lost = peak - s.speed_kmh
        g = abs(getattr(s, "g_lon", 0.0) or 0.0)
        if peak >= self.min_kmh and (lost >= self.drop_kmh or (g >= self.g_spike and lost >= self.g_min_drop_kmh)):
            return self._fire(t, CRASH)
        if s.speed_kmh <= self.stuck_kmh and getattr(s, "tyres_out", 0) >= 2:
            if self._stuck_since is None:
                self._stuck_since = t
            elif t - self._stuck_since >= self.stuck_s:
                return self._fire(t, STUCK)
        else:
            self._stuck_since = None
        return None
