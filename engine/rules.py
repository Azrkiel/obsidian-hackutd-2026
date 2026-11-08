"""Deterministic fallback coach."""
from __future__ import annotations

import uuid

from .models import Decision


def new_decision_id() -> str:
    return "d-" + uuid.uuid4().hex[:8]


def _end(packet: dict, reason: str, summary: str) -> Decision:
    return Decision(new_decision_id(), packet["attempt_id"], "end_drill", end_reason=reason,
                    summary=summary, mode="rules")


def _offer(packet: dict, drill: str, marker: int, cue: str, verdict: str | None = None) -> Decision:
    return Decision(new_decision_id(), packet["attempt_id"], "offer_drill", drill_id=drill,
                    target={"marker_m": marker}, cue=cue, verdict=verdict,
                    summary=cue, mode="rules")


def _fmt(x: float) -> str:
    return f"{abs(round(x)):d}"


def rule_decide(packet: dict) -> Decision:
    """Rule-based decision from an evidence packet."""
    tol = packet["tolerance"]
    d = packet["delta"]
    retry = packet["phase"] == "retry"
    if not packet["valid"]:
        if retry:
            dr = packet["drill"]
            return _offer(packet, dr["id"], dr["target"]["marker_m"],
                          "That run was invalid. Repeat the same drill.", "repeat")
        return _end(packet, "invalid_run", "Run invalid; nothing to coach.")
    if not packet["comparable"]:
        return _end(packet, "not_comparable", "Entry speed too far from reference to compare.")
    sug = packet["suggested"]
    if not retry:
        if abs(d["brake_onset_m"]) > tol["brake_onset_m"]:
            m = sug["brake_point"]
            word = "later" if d["brake_onset_m"] > 0 else "earlier"
            return _offer(packet, "brake_point", m,
                          f"Brake at the {m} m board; you braked {_fmt(d['brake_onset_m'])} m {word} than reference.")
        if abs(d["throttle_pickup_m"]) > tol["throttle_pickup_m"]:
            m = sug["throttle_pickup"]
            word = "late" if d["throttle_pickup_m"] > 0 else "early"
            return _offer(packet, "throttle_pickup", m,
                          f"Pick up throttle {m} m past the apex; you were {_fmt(d['throttle_pickup_m'])} m {word}.")
        return _end(packet, "no_coaching_needed", "Everything is inside tolerance.")
    # retry
    dr = packet["drill"]
    key, gap = next(iter(packet["target_gap"].items()))
    tol_v = tol[key]
    if abs(gap) <= tol_v:
        return _end(packet, "drill_complete", "Target hit within tolerance.")
    tries = dr["tries"]
    prev = packet.get("vs_previous")
    if tries >= 3:
        return _end(packet, "no_progress", "Three tries without hitting the target.")
    if tries >= 2 and prev is not None:
        # improvement toward target = shrink in |gap| since the previous attempt
        move = prev.get(key, 0.0)
        improvement = abs(gap - move) - abs(gap)
        if improvement < tol_v / 2:
            return _end(packet, "no_progress", "Two tries and no progress toward the target.")
    base = dr.get("baseline_delta", {}).get(key)
    if base and abs(gap) > 2 * tol_v and (gap > 0) != (base > 0):
        m = sug["adjusted_marker_m"]
        if key == "brake_onset_m":
            cue = f"Target adjusted: brake at the {m} m board."
        else:
            cue = f"Target adjusted: throttle {m} m past the apex."
        return _offer(packet, dr["id"], m, cue, "adjust")
    m = dr["target"]["marker_m"]
    if key == "brake_onset_m":
        cue = f"Closer. Brake at the {m} m board again."
    else:
        cue = f"Closer. Throttle {m} m past the apex again."
    return _offer(packet, dr["id"], m, cue, "repeat")
