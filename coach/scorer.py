"""CornerScorer: telemetry samples -> corner runs -> engine Attempt + per-run trace."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from engine.models import Attempt, CornerConfig

from .telemetry import Sample

BRAKE_THR, GAS_THR, HOLD_S = 0.10, 0.20, 0.10
GAP_S, JUMP_M, BACK_M, ABORT_BACK_M, MAX_RUN_S, TRACE_STEP_M = 0.2, 30.0, 5.0, 5.0, 60.0, 2.0


@dataclass
class _Pt:
    t: float
    r: float        # metres past the start gate (negative = before it)
    speed: float
    gas: float
    brake: float


def _lerp(a: _Pt, b: _Pt, r: float) -> _Pt:
    f = (r - a.r) / (b.r - a.r) if b.r != a.r else 0.0
    return _Pt(a.t + f * (b.t - a.t), r, a.speed + f * (b.speed - a.speed),
               a.gas + f * (b.gas - a.gas), a.brake + f * (b.brake - a.brake))


def _sustained(pts: list[_Pt], i0: int, key: Callable[[_Pt], float], thr: float) -> float | None:
    """r where key first rises above thr and stays above for HOLD_S (interpolated), else None."""
    n, i = len(pts), i0
    while i < n:
        if key(pts[i]) > thr:
            j = i
            while j < n and key(pts[j]) > thr and pts[j].t - pts[i].t < HOLD_S:
                j += 1
            if j < n and key(pts[j]) > thr:
                if i > i0 and key(pts[i - 1]) <= thr:
                    a, b = pts[i - 1], pts[i]
                    return a.r + (thr - key(a)) / (key(b) - key(a)) * (b.r - a.r)
                return pts[i].r
            i = max(j, i + 1)
        else:
            i += 1
    return None


class CornerScorer:
    def __init__(self, corner: CornerConfig, on_run: Callable[[Attempt, list], None],
                 max_run_s: float = MAX_RUN_S):
        self.corner, self.on_run, self.max_run_s = corner, on_run, max_run_s
        L, s = corner.track_length_m, corner.start_gate_m
        self._L, self._s = L, s
        self._exit_rel = (corner.exit_gate_m - s) % L
        self._apex = tuple((x - s) % L for x in corner.apex_window_m)
        self._prev: _Pt | None = None
        self._run: list[_Pt] | None = None
        self._invalid: str | None = None
        self._max_r = 0.0
        self._n = 0

    @property
    def in_run(self) -> bool:
        return self._run is not None

    def abort(self) -> None:
        self._run, self._invalid = None, None

    def _rel(self, pos_m: float) -> float:
        L = self._L
        return ((pos_m - self._s + L / 2) % L) - L / 2

    def _bad(self, why: str) -> None:
        if self._invalid is None:
            self._invalid = why

    def add(self, s: Sample) -> None:
        pt = _Pt(s.t, self._rel(s.pos_m), s.speed_kmh, s.gas, s.brake)
        prev, self._prev = self._prev, pt
        if prev is None:
            return
        if self._run is None:
            if prev.r < 0 <= pt.r and pt.r - prev.r <= JUMP_M and s.status == "live":
                gate = _lerp(prev, pt, 0.0)
                self._run, self._invalid, self._max_r = [gate, pt], None, pt.r
            return
        # in a run
        if pt.r < -ABORT_BACK_M:  # teleported back behind the gate: silent abort
            self.abort()
            return
        if prev.r < 0 <= pt.r and pt.r - prev.r <= JUMP_M:  # re-crossed the gate: restart silently
            self._run, self._invalid, self._max_r = [_lerp(prev, pt, 0.0), pt], None, pt.r
            return
        if pt.t - prev.t > GAP_S:
            self._bad(f"data gap {pt.t - prev.t:.2f}s")
        if abs(pt.r - prev.r) > JUMP_M:
            self._bad("position jump")
        self._max_r = max(self._max_r, pt.r)
        if self._max_r - pt.r > BACK_M:
            self._bad("went backwards")
        if s.status != "live":
            self._bad(f"status {s.status}")
        if pt.t - self._run[0].t > self.max_run_s:
            self._bad(f"run longer than {self.max_run_s:.0f}s")
            self._emit(self._run, None)
            return
        if prev.r < self._exit_rel <= pt.r:
            ex = _lerp(prev, pt, self._exit_rel)
            self._emit(self._run, ex)
            return
        self._run.append(pt)

    # -- results --
    def _emit(self, pts: list[_Pt], ex: _Pt | None) -> None:
        reason = self._invalid
        self._run, self._invalid = None, None
        if ex is not None:
            pts = pts + [ex]
        a0, a1 = self._apex
        s = self._s
        in_apex = [i for i, p in enumerate(pts) if a0 <= p.r <= a1]
        apex_i = min(in_apex, key=lambda i: pts[i].speed) if in_apex else None
        onset = _sustained(pts, 0, lambda p: p.brake, BRAKE_THR)
        pickup = _sustained(pts, apex_i, lambda p: p.gas, GAS_THR) if apex_i is not None else None
        if reason is None:
            if ex is None:
                reason = "run did not finish"
            elif apex_i is None:
                reason = "no samples in apex window"
            elif onset is None:
                reason = "no brake onset"
            elif pickup is None:
                reason = "no throttle pickup"
        peak = max((p.brake for p in pts if p.r <= a1), default=0.0)
        self._n += 1
        attempt = Attempt(
            attempt_id=f"a-{self._n:04d}", valid=reason is None, invalid_reason=reason,
            entry_kmh=pts[0].speed, apex_kmh=pts[apex_i].speed if apex_i is not None else 0.0,
            exit_kmh=ex.speed if ex else pts[-1].speed,
            brake_onset_m=s + onset if onset is not None else 0.0, peak_brake=peak,
            throttle_pickup_m=s + pickup if pickup is not None else 0.0,
            section_s=(ex.t if ex else pts[-1].t) - pts[0].t)
        trace, last = [], None
        for p in pts:
            if last is None or p.r - last >= TRACE_STEP_M:
                trace.append([round(s + p.r, 1), round(p.brake, 2), round(p.gas, 2), round(p.speed, 1)])
                last = p.r
        self.on_run(attempt, trace)
