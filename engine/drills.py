"""Single source of drill metadata and evidence eligibility.

Targets use the metric's units except the two legacy board/apex markers.
Uncalibrated telemetry never makes a drill eligible for coaching.
"""
from __future__ import annotations

from dataclasses import dataclass
import math


@dataclass(frozen=True)
class Drill:
    metric: str
    target_key: str
    unit: str
    gate: str
    cue: str
    reminder: str
    direction: str = "both"  # both, high (excess), low (deficit)
    requires: tuple[str, ...] = ()
    prerequisite: str | None = None

    def cue_position(self, target: dict, corner) -> float:
        if self.metric == "brake_onset_m":
            return corner.board_zero_m - target[self.target_key]
        if self.metric == "throttle_pickup_m":
            return corner.apex_window_m[1] + target[self.target_key]
        if self.metric in ("turn_in_m", "last_downshift_m"):
            return float(target[self.target_key])
        if self.metric == "min_vs_apex_m":
            return sum(corner.apex_window_m) / 2 + target[self.target_key]
        return corner.gate(self.gate)


DRILLS = {
    "brake_point": Drill("brake_onset_m", "marker_m", "m", "brake_m", "Brake at the reference board.", "Brake earlier."),
    "brake_release": Drill("release_s", "release_s", "s", "turn_in_m", "Ease off the brake progressively as you turn in.", "Ease off slowly."),
    "throttle_pickup": Drill("throttle_pickup_m", "marker_m", "m", "apex2_m", "Pick up throttle at the reference marker.", "Throttle earlier."),
    "brake_bite": Drill("time_to_peak_s", "time_to_peak_s", "s", "brake_m", "Build brake pressure smoothly toward the reference bite.", "Build pressure smoothly."),
    "no_coast": Drill("coast_s", "coast_s", "s", "turn_in_m", "Reduce coasting; connect the brake release to throttle pickup.", "Connect the pedals.", "high"),
    "apex_position": Drill("min_vs_apex_m", "min_vs_apex_m", "m", "apex1_m", "Place your slowest point closer to the reference apex.", "Match the apex."),
    "trail_brake": Drill("trail_brake_share", "trail_brake_share", "share", "turn_in_m", "Match the reference brake overlap while turning in.", "Blend brake and steering.", requires=("steering",)),
    "throttle_roll_on": Drill("full_throttle_s", "full_throttle_s", "s", "apex2_m", "Match the reference throttle buildup after the apex.", "Roll on progressively.", requires=("slip",)),
    "lockup": Drill("lockup_s", "lockup_s", "s", "brake_m", "Ease brake pressure as speed falls to reduce front locking.", "Ease pressure as slowing.", "high", ("slip",)),
    "min_speed": Drill("min_kmh", "min_kmh", "km/h", "apex1_m", "Carry the reference minimum speed through the apex.", "Carry the apex speed.", "low", prerequisite="min_vs_apex_m"),
    "turn_in": Drill("turn_in_m", "turn_in_m", "m", "turn_in_m", "Begin steering at the reference turn-in marker.", "Match the turn-in."),
    "downshift": Drill("last_downshift_m", "last_downshift_m", "m", "turn_in_m", "Finish your downshifts at the reference marker before the apex.", "Finish downshifting on approach."),
    "racing_line": Drill("line_offset_m", "line_offset_m", "m", "turn_in_m", "Follow the reference racing line through the corner.", "Follow the reference line.", "high", ("coordinates",)),
}
DRILL_METRIC = {k: d.metric for k, d in DRILLS.items()}
DRILL_TARGET = {k: d.target_key for k, d in DRILLS.items()}
TARGET_KEYS = {d.target_key for d in DRILLS.values()} | {"peak_brake"}
TARGET_PROPERTIES = {k: {"type": "number"} for k in sorted(TARGET_KEYS)}
TITLES = {k: k.replace("_", " ").capitalize() for k in DRILLS}


def prompt_drills() -> str:
    return "; ".join(f"{k} (target {d.target_key}, {d.unit}: {d.cue})" for k, d in DRILLS.items())


def finite(value) -> bool:
    return isinstance(value, (float, int)) and not isinstance(value, bool) and math.isfinite(value)


def eligible(packet: dict, drill_id: str) -> bool:
    d = DRILLS.get(drill_id)
    if d is None or drill_id not in packet["allowed"]["drills"] or drill_id not in packet["suggested"]:
        return False
    key = d.metric
    delta, tol = packet["delta"].get(key), packet["tolerance"].get(key)
    if not finite(packet["attempt"].get(key)) or not finite(packet["reference"].get(key)):
        return False
    if not finite(delta) or not finite(tol):
        return False
    if any(not packet.get("telemetry_verified", {}).get(k, False) for k in d.requires):
        return False
    if d.prerequisite:
        gap = packet["delta"].get(d.prerequisite)
        limit = packet["tolerance"].get(d.prerequisite)
        if not finite(gap) or not finite(limit) or abs(gap) > limit:
            return False
    return abs(delta) > tol if d.direction == "both" else delta > tol if d.direction == "high" else delta < -tol


def target_hit(drill_id: str, gap: float, tolerance: float) -> bool:
    """Deficits/excesses are one-sided; improvement past target still counts."""
    if not finite(gap) or not finite(tolerance):
        return False
    direction = DRILLS[drill_id].direction
    return abs(gap) <= tolerance if direction == "both" else gap <= tolerance if direction == "high" else gap >= -tolerance
