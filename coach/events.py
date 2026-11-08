"""Error events and where their retry starts (ROLLING_CHECKPOINTS.md, E1-E2).

EventDetector: after each CornerPass, compare it with the reference for that corner.
  major: wheels off, spin (or went backwards), lock-up, wheelspin, big speed loss at the apex
  minor: time lost above the sensitivity, or braked early/late beyond the brake threshold
  Flat-out corners (Curva Grande) only raise major events. Passes with bad data raise nothing.

CheckpointPicker: the state a retry rewinds to, chosen when the event fires:
  1. this lap's anchor save for the corner
  2. else the newest rolling save at least the lead time before the brake point (turn-in if flat)
  3. else the oldest stable rolling save: off every corner, at a normal speed for the spot
  4. else no retry
Sim reset mode has no saves: the retry starts at the corner's anchor position.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .checkpoints import Checkpoint, CheckpointStore
from .reference import RefCorner
from .track import Track, TrackCorner
from .corner_pass import CornerPass

MAJOR, MINOR = "major", "minor"


@dataclass
class Thresholds:
    time_lost_s: float = 0.25        # error sensitivity (settings: 0.1-0.5)
    brake_m: float = 15.0            # braked early/late beyond this
    wheels_off_s: float = 0.3        # >= 3 tyres out for longer than this
    spin_deg: float = 90.0           # car vs direction of travel
    lockup_slip: float = 0.3         # front wheelSlip; units unverified in game (stage B sets it)
    wheelspin_slip: float = 0.3      # rear wheelSlip
    speed_loss: float = 0.25         # apex speed this fraction below the reference


@dataclass
class CornerEvent:
    id: str
    corner_id: str
    corner: str
    lap: int
    severity: str                    # major | minor
    kinds: list[str]                 # e.g. ["wheels_off", "time_lost"]
    facts: dict[str, Any]
    cpass: CornerPass = field(repr=False)
    ref: RefCorner = field(repr=False)

    def summary(self) -> dict:
        return {"id": self.id, "corner_id": self.corner_id, "corner": self.corner, "lap": self.lap,
                "severity": self.severity, "kinds": self.kinds, "facts": self.facts,
                "reference": self.ref.source}


class EventDetector:
    def __init__(self, thresholds: Thresholds | None = None):
        self.th = thresholds or Thresholds()
        self._n = 0

    def detect(self, p: CornerPass, ref: RefCorner, flat: bool = False) -> CornerEvent | None:
        if not p.valid:
            return None
        th, major, minor = self.th, [], []
        lost = p.segment_s - ref.segment_s
        facts: dict[str, Any] = {"time_lost_s": round(lost, 3), "min_kmh": round(p.min_kmh, 1),
                                 "ref_min_kmh": round(ref.min_kmh, 1)}
        if p.tyres_out_s > th.wheels_off_s:
            major.append("wheels_off")
            facts["wheels_off_s"] = round(p.tyres_out_s, 2)
        if p.max_body_slip_deg > th.spin_deg or p.went_backwards:
            major.append("spin")
            facts["body_slip_deg"] = round(p.max_body_slip_deg)
        if p.peak_slip_f > th.lockup_slip:
            major.append("lockup")
            facts["slip_front"] = round(p.peak_slip_f, 2)
        if p.peak_slip_r > th.wheelspin_slip:
            major.append("wheelspin")
            facts["slip_rear"] = round(p.peak_slip_r, 2)
        if ref.min_kmh > 0 and p.min_kmh < (1 - th.speed_loss) * ref.min_kmh:
            major.append("speed_loss")
        if not flat:
            if lost > th.time_lost_s:
                minor.append("time_lost")
            if p.brake_onset_m is not None and ref.brake_onset_m is not None:
                d = p.brake_onset_m - ref.brake_onset_m   # + = later
                facts["brake_delta_m"] = round(d, 1)
                if d > th.brake_m:
                    minor.append("brake_late")
                elif d < -th.brake_m:
                    minor.append("brake_early")
        if not (major or minor):
            return None
        self._n += 1
        return CornerEvent(f"e{self._n:04d}", p.corner_id, p.corner, p.lap, MAJOR if major else MINOR,
                           major + minor, facts, p, ref)


@dataclass(frozen=True)
class RetryStart:
    source: str                      # anchor | buffer | oldest | sim
    pos_m: float
    speed_kmh: float
    cp: Checkpoint | None = None


class CheckpointPicker:
    def __init__(self, track: Track, lead_s: float = 4.0, max_age_s: float = 30.0,
                 approach_s: float = 15.0, speed_tol: float = 0.25):
        self.track, self.lead_s, self.max_age_s = track, lead_s, max_age_s
        self.approach_s, self.speed_tol = approach_s, speed_tol

    def _index(self, c: TrackCorner) -> int:
        return self.track.corners.index(c) + 1   # anchors are 1-based, in corner order

    def for_sim(self, c: TrackCorner) -> RetryStart:
        pos = self.track.anchor_m(c, self.lead_s)
        return RetryStart("sim", pos, self.track.ai_kmh(pos))

    def pick(self, c: TrackCorner, store: CheckpointStore, now: float) -> RetryStart | None:
        tr, L = self.track, self.track.length_m

        def fresh(cp: Checkpoint) -> bool:
            return now - cp.t <= self.max_age_s

        a = store.anchor(self._index(c))
        if a is not None and fresh(a):
            return RetryStart("anchor", a.spline * L, a.speed_kmh, a)
        ring = [cp for cp in store.ring if fresh(cp)]
        before = [(tr.ai_time(cp.spline * L, c.key_m), cp) for cp in ring]
        ok = [(t, cp) for t, cp in before if self.lead_s <= t <= self.lead_s + self.approach_s]
        if ok:
            cp = min(ok, key=lambda x: x[0])[1]                  # the newest that still leaves the lead
            return RetryStart("buffer", cp.spline * L, cp.speed_kmh, cp)
        for cp in ring:                                         # oldest first
            pos = cp.spline * L
            ai = tr.ai_kmh(pos)
            if tr.corner_at(pos) is None and abs(cp.speed_kmh - ai) <= self.speed_tol * ai:
                return RetryStart("oldest", pos, cp.speed_kmh, cp)
        return None
