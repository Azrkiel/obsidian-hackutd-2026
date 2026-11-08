"""LapSim: a synthetic driver for the whole lap, with planted mistakes (ROLLING_CHECKPOINTS.md, D).

Drives the track model's AI line (speed and pedals) with consistent position, heading and yaw rate,
so the full flow (scoring, events, offers, rewinds) runs without the game. Mistakes are planted per
corner and per attempt at it:

    LapSim(track, errors={"c1": ["late_brake", None], "c4": ["spin"]})
        first time through Rettifilo: late brake; the retry after a rewind: clean; Lesmo 1: a spin

Mistakes: early_brake, late_brake (lock-up, wheels off, slow apex), run_wide, slow_exit, lockup, spin.
teleport_to(pos, speed) is the checkpoint load (ResetManager sim mode).
"""
from __future__ import annotations

import asyncio
import math
from typing import AsyncIterator

from .telemetry import Sample
from .track import Track, TrackCorner

ERRORS = ("early_brake", "late_brake", "run_wide", "slow_exit", "lockup", "spin")
LAT_MS2 = 24.0
EARLY_M, LATE_M, LATE_PICKUP_M, LATE_EXIT = 70.0, 25.0, 45.0, 0.72
SPIN_S, SPIN_KMH, RECOVER_MS2 = 1.2, 15.0, 6.0


class LapSim:
    def __init__(self, track: Track, errors: dict[str, list[str | None]] | None = None,
                 hz: float = 60.0, realtime: bool = False, laps: float | None = None,
                 start_m: float = 0.0):
        for kinds in (errors or {}).values():
            for k in kinds:
                if k is not None and k not in ERRORS:
                    raise ValueError(f"unknown mistake {k!r} (one of {ERRORS})")
        self.track, self.errors, self.dt, self.realtime = track, errors or {}, 1.0 / hz, realtime
        self.finite = laps is not None
        self.max_dist = None if laps is None else laps * track.length_m
        self.pos, self.t, self.packet = track.wrap(start_m), 0.0, 0
        self.speed = track.ai_kmh(start_m)
        self.heading = 0.0       # direction of travel
        self.spin_angle = 0.0    # car body relative to travel
        self.x = self.z = 0.0
        self.attempts: dict[str, int] = {}
        self.corner: TrackCorner | None = None
        self.mistake: str | None = None
        self._spin_t: float | None = None
        self._spun = False
        self._driven = 0.0
        self._stop = False
        self.log: list[tuple[str, int, str | None]] = []   # (corner id, attempt, mistake) as driven

    # -- control --
    def teleport_to(self, pos_m: float, speed_kmh: float) -> None:
        self.pos, self.speed = self.track.wrap(pos_m), speed_kmh
        self.corner, self.mistake, self._spin_t, self._spun, self.spin_angle = None, None, None, False, 0.0

    def stop(self) -> None:
        self._stop = True

    # SimSource learns toward the drill target; here the planted mistakes decide each attempt
    def set_target_board(self, board_m: float) -> None:
        pass

    def set_target_release(self, release_s: float) -> None:
        pass

    # -- model --
    def _enter(self, c: TrackCorner) -> None:
        n = self.attempts.get(c.id, 0)
        self.attempts[c.id] = n + 1
        plan = self.errors.get(c.id, [])
        self.corner, self.mistake = c, plan[n] if n < len(plan) else None
        self._spin_t, self._spun = None, False
        self.log.append((c.id, n, self.mistake))

    def _curvature(self, pos: float) -> float:
        c = self.track.corner_at(pos)
        if c is None or not (c.turn_in_m <= pos <= c.exit_m - 30):
            return 0.0
        v = self.track.ai_kmh(pos) / 3.6
        side = 1.0 if (sum(pos >= a for a in c.apex_m) % 2) else -1.0   # chicanes alternate
        return side * LAT_MS2 / max(v * v, 1.0)

    def _controls(self, pos: float) -> tuple[float, float, float, int, float]:
        """(target km/h, gas, brake, tyres out, front slip) at pos, with the current mistake."""
        tr, c, m = self.track, self.corner, self.mistake
        v = tr.ai_kmh(pos)
        gas, brake = tr.ai_pedals(pos)
        out, slip_f = 0, 0.03
        if c is None or m is None or not (c.entry_m <= pos <= c.exit_m):
            return v, gas, brake, out, slip_f
        a1, a2 = c.apex_m[0], c.apex_m[-1]
        if m == "early_brake" and pos < a1:
            v2 = tr.ai_kmh(pos + EARLY_M)
            if v2 < v:
                v, (gas, brake) = v2, tr.ai_pedals(pos + EARLY_M)
        elif m == "late_brake":
            if pos < a1:
                v = max(v, tr.ai_kmh(pos - LATE_M))
                gas, brake = tr.ai_pedals(pos - LATE_M)
                if a1 - 25 <= pos:
                    slip_f, brake = 0.35, 1.0
            else:
                v *= LATE_EXIT           # ran deep: slow, wide exit
                gas, brake = tr.ai_pedals(pos - LATE_PICKUP_M)
                out = 4 if pos <= a1 + 25 else 0
        elif m == "run_wide" and a2 + 10 <= pos <= c.exit_m - 10:
            v, out = v * 0.9, 4
        elif m == "slow_exit" and pos > a2:
            v *= 0.85
            gas, _ = tr.ai_pedals(pos - LATE_PICKUP_M)
        elif m == "lockup" and c.brake_m is not None and c.brake_m + 20 <= pos <= c.brake_m + 60:
            slip_f = 0.4
        return v, gas, brake, out, slip_f

    def _step(self) -> Sample:
        tr = self.track
        if self.corner is None:
            c = tr.corner_at(self.pos)
            if c is not None and self.pos - c.entry_m < 5:
                self._enter(c)
        elif not (self.corner.entry_m <= self.pos <= self.corner.exit_m):
            self.corner, self.mistake = None, None
        target, gas, brake, out, slip_f = self._controls(self.pos)
        spin_rate = 0.0
        if self.mistake == "spin" and not self._spun and self.pos >= self.corner.apex_m[0]:
            self._spin_t = self._spin_t if self._spin_t is not None else 0.0
            self._spin_t += self.dt
            spin_rate = 2 * math.pi / SPIN_S       # one full turn
            self.spin_angle += spin_rate * self.dt
            self.speed = max(SPIN_KMH, self.speed - (self.speed - SPIN_KMH) * self.dt / 0.4)
            gas, brake, slip_f = 0.0, 0.6, 0.6
            if self._spin_t >= SPIN_S:      # round once, facing the right way again: drive on
                self._spun = True
        elif self.mistake == "spin" and self._spun:
            self.speed = min(target, self.speed + RECOVER_MS2 * 3.6 * self.dt)
        else:
            self.speed = target
        v = self.speed / 3.6
        k = self._curvature(self.pos)
        ds = v * self.dt
        self.heading += k * ds
        self.x += math.cos(self.heading) * ds
        self.z += math.sin(self.heading) * ds
        self.packet += 1
        s = Sample(self.t, self.packet, "live", self.pos / tr.length_m, self.pos, self.speed, gas, brake,
                   0.0, self.x, 0.0, self.z, g_lat=v * v * k / 9.81, g_lon=0.0,
                   yaw_rate=v * k + spin_rate, slip_f=slip_f, slip_r=0.03, tyres_out=out)
        self.pos = tr.wrap(self.pos + ds)
        self._driven += ds
        self.t += self.dt
        return s

    async def samples(self) -> AsyncIterator[Sample]:
        loop = asyncio.get_running_loop()
        wall0 = loop.time() - self.t
        n = 0
        while not self._stop and (self.max_dist is None or self._driven < self.max_dist):
            yield self._step()
            n += 1
            if self.realtime:
                await asyncio.sleep(max(0.0, wall0 + self.t - loop.time()))
            elif n % 200 == 0:
                await asyncio.sleep(0)
