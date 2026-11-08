"""Deterministic fallback coach."""
from __future__ import annotations

import uuid

from .evidence import DRILL_METRIC, DRILL_TARGET
from .models import Decision

BASELINE_ORDER = ("brake_point", "brake_release", "throttle_pickup")


def new_decision_id() -> str:
    return "d-" + uuid.uuid4().hex[:8]


def _end(packet: dict, reason: str, summary: str) -> Decision:
    return Decision(new_decision_id(), packet["attempt_id"], "end_drill", end_reason=reason,
                    summary=summary, mode="rules")


def _offer(packet: dict, drill: str, target: dict, cue: str, verdict: str | None = None,
           reminder: str = "") -> Decision:
    return Decision(new_decision_id(), packet["attempt_id"], "offer_drill", drill_id=drill,
                    target=dict(target), cue=cue, verdict=verdict, summary=cue, mode="rules",
                    reminder=reminder if packet.get("voice") else "")


def _fmt(x: float) -> str:
    return f"{abs(round(x)):d}"


def reminder_for(drill_id: str, gap: float | None) -> str:
    """Up to 4 spoken words for the approach. gap = attempt minus target (or reference)."""
    late = gap is None or gap > 0
    if drill_id == "brake_point":
        return "Brake earlier." if late else "Brake later."
    if drill_id == "brake_release":
        return "Ease off slowly." if gap is None or gap < 0 else "Release sooner."
    return "Throttle earlier." if late else "Wait for throttle."


def _baseline_cue(packet: dict, drill: str) -> tuple[dict, str]:
    d, sug = packet["delta"], packet["suggested"]
    if packet.get("voice"):  # spoken: one short sentence, the action first
        if drill == "brake_point":
            m, x = sug["brake_point"], d["brake_onset_m"]
            return {"marker_m": m}, f"Brake {_fmt(x)} m {'earlier' if x > 0 else 'later'}, at the {m} m board."
        if drill == "brake_release":
            t = sug["brake_release"]
            if d["release_s"] < 0:
                return {"release_s": t}, "Ease off the brake slower as you turn in."
            return {"release_s": t}, "Release the brake sooner as you turn in."
        m, x = sug["throttle_pickup"], d["throttle_pickup_m"]
        return {"marker_m": m}, f"Throttle {_fmt(x)} m {'earlier' if x > 0 else 'later'}, {m} m past the apex."
    if drill == "brake_point":
        m = sug["brake_point"]
        word = "later" if d["brake_onset_m"] > 0 else "earlier"
        return {"marker_m": m}, \
            f"Brake at the {m} m board; you braked {_fmt(d['brake_onset_m'])} m {word} than reference."
    if drill == "brake_release":
        t = sug["brake_release"]
        if d["release_s"] < 0:
            return {"release_s": t}, f"Ease off the brake slower, over {t} s into the turn."
        return {"release_s": t}, f"Release the brake sooner, over {t} s."
    m = sug["throttle_pickup"]
    word = "late" if d["throttle_pickup_m"] > 0 else "early"
    return {"marker_m": m}, \
        f"Pick up throttle {m} m past the apex; you were {_fmt(d['throttle_pickup_m'])} m {word}."


def rule_decide(packet: dict) -> Decision:
    """Rule-based decision from an evidence packet."""
    tol = packet["tolerance"]
    d = packet["delta"]
    retry = packet["phase"] == "retry"
    voice = bool(packet.get("voice"))
    if not packet["valid"]:
        if retry:
            dr = packet["drill"]
            return _offer(packet, dr["id"], dr["target"],
                          "That run was invalid. Repeat the same drill.", "repeat",
                          reminder_for(dr["id"], None))
        return _end(packet, "invalid_run",
                    "That lap did not count." if voice else "Run invalid; nothing to coach.")
    if not packet["comparable"]:
        return _end(packet, "not_comparable",
                    "Entry speed was off, so no comparison." if voice
                    else "Entry speed too far from reference to compare.")
    allowed = packet["allowed"]["drills"]
    if not retry:
        for drill in BASELINE_ORDER:
            key = DRILL_METRIC[drill]
            if drill in allowed and drill in packet["suggested"] and key in d and key in tol \
                    and abs(d[key]) > tol[key]:
                target, cue = _baseline_cue(packet, drill)
                return _offer(packet, drill, target, cue, reminder=reminder_for(drill, d[key]))
        return _end(packet, "no_coaching_needed",
                    "Clean corner. Keep it up." if voice else "Everything is inside tolerance.")
    # retry
    dr = packet["drill"]
    key, gap = next(iter(packet["target_gap"].items()))
    tol_v = tol[key]
    if abs(gap) <= tol_v:
        return _end(packet, "drill_complete",
                    "On target. Keep that." if voice else "Target hit within tolerance.")
    tries = dr["tries"]
    prev = packet.get("vs_previous")
    if tries >= 3:
        return _end(packet, "no_progress",
                    "Not there yet. We will leave that one." if voice
                    else "Three tries without hitting the target.")
    if tries >= 2 and prev is not None:
        # improvement toward target = shrink in |gap| since the previous attempt
        move = prev.get(key, 0.0)
        improvement = abs(gap - move) - abs(gap)
        if improvement < tol_v / 2:
            return _end(packet, "no_progress",
                        "No change there. We will leave that one." if voice
                        else "Two tries and no progress toward the target.")
    base = dr.get("baseline_delta", {}).get(key)
    tkey = DRILL_TARGET[dr["id"]]
    if base and abs(gap) > 2 * tol_v and (gap > 0) != (base > 0):
        t = packet["suggested"]["adjusted_target"]
        v = t[tkey]
        if key == "brake_onset_m":
            cue = f"Target adjusted: brake at the {v} m board."
        elif key == "release_s":
            cue = f"Target adjusted: release over {v} s."
        else:
            cue = f"Target adjusted: throttle {v} m past the apex."
        return _offer(packet, dr["id"], t, cue, "adjust", reminder_for(dr["id"], gap))
    v = dr["target"][tkey]
    if voice:
        move = (prev or {}).get(key)
        if move is not None and abs(gap) < abs(gap - move):
            if key == "release_s":
                head = "Better."
            else:
                head = f"Better, {_fmt(move)} m {'earlier' if move < 0 else 'later'}."
        else:
            head = "Same as before."
        tail = {"brake_onset_m": f"Again, the {v} m board.", "release_s": "Again, ease off slowly.",
                "throttle_pickup_m": f"Again, {v} m past the apex."}[key]
        return _offer(packet, dr["id"], dr["target"], f"{head} {tail}", "repeat",
                      reminder_for(dr["id"], gap))
    if key == "brake_onset_m":
        cue = f"Closer. Brake at the {v} m board again."
    elif key == "release_s":
        cue = f"Closer. Release over {v} s again."
    else:
        cue = f"Closer. Throttle {v} m past the apex again."
    return _offer(packet, dr["id"], dr["target"], cue, "repeat", reminder_for(dr["id"], gap))
