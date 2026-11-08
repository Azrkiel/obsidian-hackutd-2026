"""TrackScorer: telemetry for the whole lap -> one CornerPass per corner driven (ROLLING_CHECKPOINTS.md, D).

Two kinds of trouble are kept apart:
  * the DATA is unusable (gap, pause, teleport): the pass is `valid=False` with a reason, and a
    teleport (a checkpoint load) drops the pass silently, like CornerScorer;
  * the DRIVING went wrong (wheels off, spin, went backwards, lock-up): the pass stays valid and
    carries the facts. EventDetector (stage E) decides what counts as an error.

Brake onset, release, throttle pickup and the per-corner Attempt (drills, evidence, live cues) come
from running the existing CornerScorer over the pass, with a CornerConfig made by Track.corner_config.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Callable

from engine.models import Attempt, CornerConfig

from .scorer import CornerScorer
from .telemetry import Sample
from .track import Track, TrackCorner

GAP_S, JUMP_M, BACK_M, ABORT_BACK_M, MAX_PASS_S = 0.2, 30.0, 5.0, 5.0, 60.0
TYRES_OUT_MIN = 3        # "wheels off" = at least this many tyres out (AC allows two)
MIN_MOVE_M = 0.3         # travel direction needs at least this much movement between samples


@dataclass
class CornerPass:
    corner_id: str
    corner: str
    lap: int
    valid: bool                      # data usable (not: driven well)
    invalid_reason: str | None
    t_entry: float
    t_exit: float
    entry_kmh: float
    exit_kmh: float
    min_kmh: float
    min_pos_m: float
    segment_s: float                 # entry gate -> exit gate
    tyres_out_s: float               # longest stretch with >= TYRES_OUT_MIN tyres out
    max_tyres_out: int
    max_body_slip_deg: float         # car heading vs direction of travel (spin > 90)
    went_backwards: bool
    peak_slip_f: float
    peak_slip_r: float
    attempt: Attempt | None = None   # the CornerScorer view (None when it found no run)
    trace: list = field(default_factory=list)

    @property
    def brake_onset_m(self) -> float | None:
        a = self.attempt
        return a.brake_onset_m if a and a.brake_onset_m else None


def body_slip_deg(samples: list[Sample]) -> float:
    """Largest angle between where the car points and where it travels, over the pass.

    Heading change = integrated yaw rate; travel direction = from x/z. The yaw-rate sign
    convention in AC is unverified, so both signs are tried and the one that tracks the path
    (normal driving) wins. Starts at 0 by construction: car and path agree at the entry gate."""
    yaw, trav, ok = 0.0, None, []
    rows = []
    prev = samples[0]
    for s in samples[1:]:
        dt = s.t - prev.t
        yaw += 0.5 * (s.yaw_rate + prev.yaw_rate) * dt
        dx, dz = s.x - prev.x, s.z - prev.z
        if math.hypot(dx, dz) >= MIN_MOVE_M:
            a = math.atan2(dz, dx)
            if trav is None:
                trav0 = trav = a
            else:
                trav += math.remainder(a - trav, 2 * math.pi)   # unwrap
            rows.append((yaw, trav - trav0))
        prev = s
    if not rows:
        return 0.0
    best = None
    for sign in (1.0, -1.0):
        d = [abs(math.degrees(sign * y - p)) for y, p in rows]
        med = sorted(d)[len(d) // 2]
        if best is None or med < best[0]:
            best = (med, max(d))
    return best[1]


class TrackScorer:
    def __init__(self, track: Track, base: CornerConfig, on_pass: Callable[[CornerPass], None],
                 max_pass_s: float = MAX_PASS_S):
        self.track, self.on_pass, self.max_pass_s = track, on_pass, max_pass_s
        self.configs = {c.id: track.corner_config(c, base) for c in track.corners}
        self.lap = 0
        self._prev: Sample | None = None
        self._corner: TrackCorner | None = None
        self._pts: list[Sample] = []
        self._invalid: str | None = None
        self._max_r = 0.0

    @property
    def in_pass(self) -> bool:
        return self._corner is not None

    @property
    def current(self) -> TrackCorner | None:
        return self._corner

    def abort(self) -> None:
        self._corner, self._pts, self._invalid = None, [], None

    def _rel(self, c: TrackCorner, pos: float) -> float:
        L = self.track.length_m
        return ((pos - c.entry_m + L / 2) % L) - L / 2

    def _bad(self, why: str) -> None:
        if self._invalid is None:
            self._invalid = why

    def add(self, s: Sample) -> None:
        prev, self._prev = self._prev, s
        if prev is None:
            return
        L = self.track.length_m
        step = ((s.pos_m - prev.pos_m + L / 2) % L) - L / 2
        if prev.pos_m - s.pos_m > L / 2 and abs(step) <= JUMP_M:
            self.lap += 1                                   # crossed the start/finish line
        c = self._corner
        if c is None:
            for k in self.track.corners:
                r0, r1 = self._rel(k, prev.pos_m), self._rel(k, s.pos_m)
                if r0 < 0 <= r1 and r1 - r0 <= JUMP_M and s.status == "live":
                    self._corner, self._pts, self._invalid, self._max_r = k, [prev, s], None, r1
                    break
            return
        r0, r = self._rel(c, prev.pos_m), self._rel(c, s.pos_m)
        if abs(step) > JUMP_M:           # teleport (checkpoint load): drop the pass
            self.abort()
            return
        if r < -ABORT_BACK_M:            # back out behind the entry gate
            self.abort()
            return
        if s.t - prev.t > GAP_S:
            self._bad(f"data gap {s.t - prev.t:.2f}s")
        if s.status != "live":
            self._bad(f"status {s.status}")
        self._max_r = max(self._max_r, r)
        self._pts.append(s)
        exit_rel = (c.exit_m - c.entry_m) % L
        if r0 < exit_rel <= r:
            self._finish(complete=True)
        elif s.t - self._pts[0].t > self.max_pass_s:
            self._bad(f"pass longer than {self.max_pass_s:.0f}s")
            self._finish(complete=False)

    def _finish(self, complete: bool) -> None:
        c, pts = self._corner, self._pts
        reason = self._invalid or (None if complete else "pass did not finish")
        self.abort()
        L = self.track.length_m
        exit_rel = (c.exit_m - c.entry_m) % L

        def at(rel: float, key: str) -> float:   # interpolate a field at a gate
            for a, b in zip(pts, pts[1:]):
                ra, rb = self._rel(c, a.pos_m), self._rel(c, b.pos_m)
                if ra <= rel <= rb and rb > ra:
                    f = (rel - ra) / (rb - ra)
                    return getattr(a, key) + f * (getattr(b, key) - getattr(a, key))
            return getattr(pts[0] if rel <= 0 else pts[-1], key)

        t_in, t_out = at(0.0, "t"), at(exit_rel, "t") if complete else pts[-1].t
        body = [p for p in pts[1:] if 0 <= self._rel(c, p.pos_m) <= exit_rel] or pts[1:]
        w0, w1 = c.apex_window_m
        in_win = [p for p in body if w0 <= self.track.wrap(p.pos_m) <= w1]
        slowest = min(in_win or body, key=lambda p: p.speed_kmh)
        out_s, run_start, max_out = 0.0, None, 0
        for p in body:
            max_out = max(max_out, p.tyres_out)
            if p.tyres_out >= TYRES_OUT_MIN:
                run_start = p.t if run_start is None else run_start
                out_s = max(out_s, p.t - run_start)
            else:
                run_start = None
        rs = [self._rel(c, p.pos_m) for p in body]
        backwards, hi = False, -math.inf
        for r in rs:
            hi = max(hi, r)
            backwards = backwards or hi - r > BACK_M
        attempt, trace = None, []
        got: list = []
        cs = CornerScorer(self.configs[c.id], lambda a, tr: got.append((a, tr)), self.max_pass_s)
        for p in pts:
            cs.add(p)
        if got:
            attempt, trace = got[0]
        self.on_pass(CornerPass(
            corner_id=c.id, corner=c.name, lap=self.lap, valid=reason is None, invalid_reason=reason,
            t_entry=t_in, t_exit=t_out, entry_kmh=at(0.0, "speed_kmh"),
            exit_kmh=at(exit_rel, "speed_kmh") if complete else pts[-1].speed_kmh,
            min_kmh=slowest.speed_kmh, min_pos_m=slowest.pos_m, segment_s=t_out - t_in,
            tyres_out_s=out_s, max_tyres_out=max_out, max_body_slip_deg=body_slip_deg(pts),
            went_backwards=backwards, peak_slip_f=max(p.slip_f for p in body),
            peak_slip_r=max(p.slip_r for p in body), attempt=attempt, trace=trace))
