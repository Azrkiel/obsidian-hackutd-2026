"""Build the evidence packet the model (and rules) reason over."""
from __future__ import annotations

from .models import Attempt, CornerConfig, DrillState


def _side(a: Attempt, corner: CornerConfig) -> dict:
    return {
        "brake_board_m": round(corner.board_zero_m - a.brake_onset_m, 1),
        "brake_onset_m": round(a.brake_onset_m, 1),
        "peak_brake": round(a.peak_brake, 2),
        "throttle_pickup_m": round(a.throttle_pickup_m, 1),
        "pickup_after_apex_m": round(a.throttle_pickup_m - corner.apex_window_m[1], 1),
        "entry_kmh": round(a.entry_kmh, 1),
        "apex_kmh": round(a.apex_kmh, 1),
        "exit_kmh": round(a.exit_kmh, 1),
        "section_s": round(a.section_s, 2),
    }


def _round10(x: float, lo: float, hi: float) -> int:
    return int(min(max(round(x / 10.0) * 10, lo), hi))


def suggested_markers(reference: Attempt, corner: CornerConfig) -> dict:
    """Marker values rules/model may offer, derived from the reference run."""
    al = corner.allowed
    board = corner.board_zero_m - reference.brake_onset_m
    after = reference.throttle_pickup_m - corner.apex_window_m[1]
    bl, bh = al["brake_point"]["marker_m"]
    tl, th = al["throttle_pickup"]["marker_m"]
    return {"brake_point": _round10(board, bl, bh), "throttle_pickup": _round10(after, tl, th)}


def target_onset(drill_id: str, target: dict, corner: CornerConfig) -> tuple[str, float]:
    """(metric key, absolute track position in m) the drill target refers to."""
    if drill_id == "brake_point":
        return "brake_onset_m", corner.board_zero_m - target["marker_m"]
    return "throttle_pickup_m", corner.apex_window_m[1] + target["marker_m"]


def build_packet(attempt: Attempt, reference: Attempt, baseline: Attempt | None,
                 corner: CornerConfig, drill_state: DrillState | None,
                 previous_attempt: Attempt | None) -> dict:
    """Assemble the packet. Deltas are attempt minus reference; + onset = braked later."""
    ref, att = _side(reference, corner), _side(attempt, corner)
    delta = {
        "brake_onset_m": round(attempt.brake_onset_m - reference.brake_onset_m, 1),
        "peak_brake": round(attempt.peak_brake - reference.peak_brake, 2),
        "entry_kmh": round(attempt.entry_kmh - reference.entry_kmh, 1),
        "apex_kmh": round(attempt.apex_kmh - reference.apex_kmh, 1),
        "exit_kmh": round(attempt.exit_kmh - reference.exit_kmh, 1),
        "throttle_pickup_m": round(attempt.throttle_pickup_m - reference.throttle_pickup_m, 1),
        "section_s": round(attempt.section_s - reference.section_s, 2),
    }
    retry = drill_state is not None
    drill = None
    target_gap = None
    vs_prev = None
    suggested = suggested_markers(reference, corner)
    if retry:
        drill = {"id": drill_state.drill_id, "target": dict(drill_state.target),
                 "tries": drill_state.tries}
        if baseline is not None:
            drill["baseline_delta"] = {
                "brake_onset_m": round(baseline.brake_onset_m - reference.brake_onset_m, 1),
                "throttle_pickup_m": round(baseline.throttle_pickup_m - reference.throttle_pickup_m, 1),
            }
        key, pos = target_onset(drill_state.drill_id, drill_state.target, corner)
        target_gap = {key: round(getattr(attempt, key) - pos, 1)}
        m = drill_state.target["marker_m"]
        if drill_state.drill_id == "brake_point":
            lo, hi = corner.allowed["brake_point"]["marker_m"]
            toward = 1 if att["brake_board_m"] > m else -1
        else:
            lo, hi = corner.allowed["throttle_pickup"]["marker_m"]
            toward = 1 if target_gap[key] > 0 else -1
        suggested["adjusted_marker_m"] = int(min(max(m + 10 * toward, lo), hi))
    if previous_attempt is not None:
        vs_prev = {
            "brake_onset_m": round(attempt.brake_onset_m - previous_attempt.brake_onset_m, 1),
            "throttle_pickup_m": round(attempt.throttle_pickup_m - previous_attempt.throttle_pickup_m, 1),
            "section_s": round(attempt.section_s - previous_attempt.section_s, 2),
        }
    return {
        "attempt_id": attempt.attempt_id,
        "phase": "retry" if retry else "baseline",
        "drill": drill,
        "valid": bool(attempt.valid),
        "invalid_reason": attempt.invalid_reason,
        "comparable": abs(delta["entry_kmh"]) <= corner.comparable_entry_kmh,
        "reference": ref,
        "attempt": att,
        "delta": delta,
        "vs_previous": vs_prev,
        "target_gap": target_gap,
        "suggested": suggested,
        "tolerance": dict(corner.tolerance),
        "allowed": corner.allowed,
    }
