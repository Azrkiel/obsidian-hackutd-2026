"""CornerScorer: telemetry samples -> corner runs -> engine Attempt + per-run trace."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from engine.analysis import driving_profile
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
    steer: float = 0.0
    yaw: float = 0.0
    slip_f: float = 0.0
    slip_r: float = 0.0
    gear: int | None = None
    x: float | None = None
    z: float | None = None


def _lerp(a: _Pt, b: _Pt, r: float) -> _Pt:
    f = (r - a.r) / (b.r - a.r) if b.r != a.r else 0.0

    def m(x: float | None, y: float | None) -> float | None:
        if x is None or y is None:
            return None
        return x + f * (y - x)
    return _Pt(m(a.t, b.t), r, m(a.speed, b.speed), m(a.gas, b.gas), m(a.brake, b.brake),
               m(a.steer, b.steer), m(a.yaw, b.yaw), m(a.slip_f, b.slip_f), m(a.slip_r, b.slip_r),
               b.gear if f >= 1 else a.gear, m(a.x, b.x), m(a.z, b.z))


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
        pt = _Pt(s.t, self._rel(s.pos_m), s.speed_kmh, s.gas, s.brake, s.steer,
                 getattr(s, "yaw_rate", 0.0), getattr(s, "slip_f", 0.0), getattr(s, "slip_r", 0.0), s.gear, s.x, s.z)
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
        # trace rows: [pos, brake, gas, speed, t, steer, yaw, slip_f, slip_r, gear, x, z] (see engine.analysis)
        trace, last = [], None
        t0 = pts[0].t
        for p in pts:
            if last is None or p.r - last >= TRACE_STEP_M or p is pts[-1] or (trace and p.gear != trace[-1][9]):
                trace.append([round(s + p.r, 1), round(p.brake, 3), round(p.gas, 3), round(p.speed, 1),
                              round(p.t - t0, 3), round(p.steer, 3), round(p.yaw, 3),
                              round(p.slip_f, 3), round(p.slip_r, 3), p.gear, p.x, p.z])
                last = p.r
        prof = driving_profile(trace, self.corner) if reason is None else {}
        attempt = Attempt(
            attempt_id=f"a-{self._n:04d}", valid=reason is None, invalid_reason=reason,
            entry_kmh=pts[0].speed, apex_kmh=pts[apex_i].speed if apex_i is not None else 0.0,
            exit_kmh=ex.speed if ex else pts[-1].speed,
            brake_onset_m=s + onset if onset is not None else 0.0, peak_brake=peak,
            throttle_pickup_m=s + pickup if pickup is not None else 0.0,
            section_s=(ex.t if ex else pts[-1].t) - pts[0].t,
            release_s=prof.get("release_s"), trail_brake_share=prof.get("trail_brake_share"),
            lockup_s=prof.get("lockup_s"), wheelspin_s=prof.get("wheelspin_s"),
            min_kmh=prof.get("min_kmh"), min_pos_m=prof.get("min_pos_m"),
            **{k: prof.get(k) for k in ("time_to_peak_s", "coast_s", "min_vs_apex_m",
                                      "full_throttle_s", "turn_in_m", "last_downshift_m", "line_offset_m")})
        self.on_run(attempt, trace)


# --- whole lap (W4) -------------------------------------------------------------------------------
LINE_NEAR_M = 300.0      # a lap-line crossing = position wraps from the last LINE_NEAR_M to the first
LAP_GAP_S, LAP_JUMP_M = 0.5, 50.0


class TrackScorer:
    """One CornerScorer per corner of a Track; every sample goes to all of them (corners never overlap,
    so at most one is inside a run).

    - on_run(corner_id, attempt, trace): each scored corner pass (attempt ids are "L03-ascari").
    - on_corners(lap_n, runs): the corners of one lap, {corner_id: (attempt, trace)}, sent at the
      last corner's exit so the per-lap decision can be spoken on the main straight. If the last
      corner did not score, they go at the lap line instead.
    - on_track_lap(event): at the lap line, lap time (None for a partial or broken lap) and every
      corner's time vs reference (reference_of(corner_id) -> Attempt | None).
    """

    def __init__(self, track, on_run: Callable[[str, Attempt, list], None],
                 on_corners: Callable[[int, dict], None], on_track_lap: Callable[[dict], None],
                 reference_of: Callable[[str], Attempt | None] = lambda cid: None,
                 max_run_s: float = MAX_RUN_S):
        self.track, self.on_run, self.on_corners, self.on_track_lap = track, on_run, on_corners, on_track_lap
        self.reference_of = reference_of
        self.scorers = {c.id: CornerScorer(c, self._corner_cb(c.id), max_run_s) for c in track.corners}
        self.lap = 0                    # laps started (line crossings seen)
        self._line_t: float | None = None
        self._lap_bad: str | None = "partial lap"  # the first lap starts wherever the car is
        self._prev = None
        self._bucket: dict[str, tuple[Attempt, list]] = {}   # corners since the last flush
        self._lap_runs: dict[str, Attempt] = {}              # corners since the last line crossing
        self._ids: set[str] = set()

    @property
    def in_run(self) -> bool:
        return any(s.in_run for s in self.scorers.values())

    def abort(self) -> None:
        for s in self.scorers.values():
            s.abort()
        self._lap_bad = self._lap_bad or "reset"

    def _corner_cb(self, cid: str) -> Callable[[Attempt, list], None]:
        def cb(attempt: Attempt, trace: list) -> None:
            aid = f"L{self.lap:02d}-{cid}"
            while aid in self._ids:  # same corner twice in one lap (a reset): keep ids unique
                aid += "b"
            self._ids.add(aid)
            attempt.attempt_id = aid
            self._bucket[cid] = (attempt, trace)
            self._lap_runs[cid] = attempt
            self.on_run(cid, attempt, trace)
            if cid == self.track.last_id:
                self._flush()
        return cb

    def _flush(self) -> None:
        if self._bucket:
            runs, self._bucket = self._bucket, {}
            self.on_corners(self.lap, runs)

    def add(self, s: Sample) -> None:
        prev, self._prev = self._prev, s
        if prev is not None:
            L = self.track.length_m
            if prev.pos_m > L - LINE_NEAR_M and s.pos_m < LINE_NEAR_M:
                self._line(prev, s, L)
            else:
                if s.t - prev.t > LAP_GAP_S:
                    self._lap_bad = self._lap_bad or f"data gap {s.t - prev.t:.2f}s"
                if abs(s.pos_m - prev.pos_m) > LAP_JUMP_M:
                    self._lap_bad = self._lap_bad or "position jump"
            if s.status != "live":
                self._lap_bad = self._lap_bad or f"status {s.status}"
        for sc in self.scorers.values():
            sc.add(s)

    def _line(self, prev: Sample, s: Sample, L: float) -> None:
        a, b = L - prev.pos_m, s.pos_m
        t = prev.t + (s.t - prev.t) * (a / (a + b) if a + b > 0 else 0.0)
        self._flush()  # the last corner did not score this lap: decide now
        if self.lap > 0:
            lap_time = round(t - self._line_t, 3) if self._lap_bad is None and self._line_t is not None else None
            self.on_track_lap(self._lap_event(self.lap, lap_time, self._lap_bad))
        self.lap += 1
        self._line_t, self._lap_bad, self._lap_runs = t, None, {}

    def _lap_event(self, lap: int, lap_time: float | None, why: str | None) -> dict:
        corners, lost = [], 0.0
        for c in self.track.corners:
            a = self._lap_runs.get(c.id)
            if a is None:
                continue
            ref = self.reference_of(c.id)
            d = round(a.section_s - ref.section_s, 3) if a.valid and ref is not None else None
            lost += d or 0.0
            corners.append({"corner_id": c.id, "name": c.name, "attempt_id": a.attempt_id,
                            "valid": a.valid, "section_s": round(a.section_s, 3), "delta_s": d})
        return {"type": "track_lap", "lap": lap, "lap_time_s": lap_time, "valid": lap_time is not None,
                "invalid_reason": why, "delta_s": round(lost, 3), "corners": corners}
