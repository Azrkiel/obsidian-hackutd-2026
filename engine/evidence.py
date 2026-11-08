"""Build the evidence packet the model (and rules) reason over."""
from __future__ import annotations

from .models import Attempt, CornerConfig, DrillState

from .drills import DRILLS, DRILL_METRIC, DRILL_TARGET, finite

EXTRAS = tuple((k, 2 if not k.endswith(("_m", "_kmh")) else 1)
               for k in dict.fromkeys(["release_s", "trail_brake_share", "lockup_s", "wheelspin_s",
                                      "min_kmh", "min_pos_m"] + list(DRILL_METRIC.values()))
               if k not in ("brake_onset_m", "throttle_pickup_m"))


def _side(a: Attempt, corner: CornerConfig) -> dict:
    out = {
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
    for k, nd in EXTRAS:
        v = getattr(a, k, None)
        if finite(v):
            out[k] = round(v, nd)
    return out


def _round10(x: float, lo: float, hi: float) -> int:
    return int(min(max(round(x / 10.0) * 10, lo), hi))


def _clamp(x: float, lo: float, hi: float) -> float:
    return min(max(x, lo), hi)


def suggested_markers(reference: Attempt, corner: CornerConfig) -> dict:
    """Target values rules/model may offer, derived from the reference run."""
    al = corner.allowed
    board = corner.board_zero_m - reference.brake_onset_m
    after = reference.throttle_pickup_m - corner.apex_window_m[1]
    bl, bh = al["brake_point"]["marker_m"]
    tl, th = al["throttle_pickup"]["marker_m"]
    out: dict = {"brake_point": _round10(board, bl, bh), "throttle_pickup": _round10(after, tl, th)}
    rel = al.get("brake_release", {}).get("release_s")
    if rel and reference.release_s is not None:
        out["brake_release"] = round(_clamp(reference.release_s, *rel), 1)
    for name, drill in DRILLS.items():
        if name in out or name not in al:
            continue
        value = getattr(reference, drill.metric, None)
        bounds = al[name].get(drill.target_key)
        if finite(value) and bounds:
            out[name] = round(_clamp(value, *bounds), 2)
    return out


def target_onset(drill_id: str, target: dict, corner: CornerConfig) -> tuple[str, float]:
    """(metric key, value of that metric the target asks for). Positions are absolute track metres."""
    if drill_id == "brake_point":
        return "brake_onset_m", corner.board_zero_m - target["marker_m"]
    if drill_id == "brake_release":
        return "release_s", float(target["release_s"])
    if drill_id == "throttle_pickup":
        return "throttle_pickup_m", corner.apex_window_m[1] + target["marker_m"]
    drill = DRILLS[drill_id]
    return drill.metric, float(target[drill.target_key])


def _diff(a: Attempt, b: Attempt, key: str, nd: int) -> float | None:
    x, y = getattr(a, key, None), getattr(b, key, None)
    return None if not finite(x) or not finite(y) else round(x - y, nd)


def build_packet(attempt: Attempt, reference: Attempt, baseline: Attempt | None,
                 corner: CornerConfig, drill_state: DrillState | None,
                 previous_attempt: Attempt | None, voice: dict | None = None) -> dict:
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
    for key, nd in EXTRAS:
        value = _diff(attempt, reference, key, nd)
        if value is not None:
            delta[key] = value
    rd = _diff(attempt, reference, "release_s", 2)
    if rd is not None:
        delta["release_s"] = rd
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
            for k, nd in EXTRAS:
                value = _diff(baseline, reference, k, nd)
                if value is not None:
                    drill["baseline_delta"][k] = value
            bd = _diff(baseline, reference, "release_s", 2)
            if bd is not None:
                drill["baseline_delta"]["release_s"] = bd
        key, pos = target_onset(drill_state.drill_id, drill_state.target, corner)
        val = getattr(attempt, key, None)
        nd = 1 if key.endswith(("_m", "_kmh")) else 2
        target_gap = {key: round(val - pos, nd)} if finite(val) else {}
        if drill_state.drill_id not in ("brake_point", "throttle_pickup", "brake_release"):
            # Keep the reference target stable for non-marker drills.
            suggested["adjusted_target"] = dict(drill_state.target)
        elif drill_state.drill_id == "brake_release":
            lo, hi = corner.allowed["brake_release"]["release_s"]
            t = float(drill_state.target["release_s"])
            step = 0.1 if target_gap.get(key, 0) > 0 else -0.1
            suggested["adjusted_target"] = {"release_s": round(_clamp(t + step, lo, hi), 1)}
        else:
            m = drill_state.target["marker_m"]
            if drill_state.drill_id == "brake_point":
                lo, hi = corner.allowed["brake_point"]["marker_m"]
                toward = 1 if att["brake_board_m"] > m else -1
            else:
                lo, hi = corner.allowed["throttle_pickup"]["marker_m"]
                toward = 1 if target_gap.get(key, 0) > 0 else -1
            suggested["adjusted_marker_m"] = int(_clamp(m + 10 * toward, lo, hi))
            suggested["adjusted_target"] = {"marker_m": suggested["adjusted_marker_m"]}
    if previous_attempt is not None:
        vs_prev = {
            "brake_onset_m": round(attempt.brake_onset_m - previous_attempt.brake_onset_m, 1),
            "throttle_pickup_m": round(attempt.throttle_pickup_m - previous_attempt.throttle_pickup_m, 1),
            "section_s": round(attempt.section_s - previous_attempt.section_s, 2),
        }
        for k, nd in EXTRAS:
            value = _diff(attempt, previous_attempt, k, nd)
            if value is not None:
                vs_prev[k] = value
        pd = _diff(attempt, previous_attempt, "release_s", 2)
        if pd is not None:
            vs_prev["release_s"] = pd
    packet = {
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
        "telemetry_verified": dict(corner.telemetry_verified),
    }
    if voice:
        packet["voice"] = dict(voice)
    return packet


# --- whole lap (W6) -------------------------------------------------------------------------------
LAP_METRICS = ("brake_onset_m", "release_s", "throttle_pickup_m")
TOP_CORNERS = 3


def worst_metric(packet: dict) -> dict | None:
    """The coachable metric furthest over tolerance (in multiples of it) on a valid, comparable run."""
    if not packet["valid"] or not packet["comparable"]:
        return None
    d, tol, best = packet["delta"], packet["tolerance"], None
    for k in LAP_METRICS:
        if k in d and k in tol and tol[k] and abs(d[k]) > tol[k]:
            over = abs(d[k]) / tol[k]
            if best is None or over > best[0]:
                best = (over, {"metric": k, "delta": d[k], "tolerance": tol[k]})
    return best[1] if best else None


def lap_summary(lap: int, runs: dict[str, Attempt], references: dict[str, Attempt],
                packets: dict[str, dict], names: dict[str, str], lap_time_s: float | None = None,
                top: int = TOP_CORNERS) -> dict:
    """Per-lap evidence, about 1.5 KB: time lost in the scored corners and the top corners by time
    lost that have a metric over tolerance (biggest first). Corner order in `runs` = lap order."""
    corners, lost_total = [], 0.0
    for cid, a in runs.items():
        ref = references.get(cid)
        lost = round(a.section_s - ref.section_s, 2) if a.valid and ref is not None else None
        lost_total += lost or 0.0
        corners.append({"corner_id": cid, "time_lost_s": lost, "valid": a.valid,
                        "worst": worst_metric(packets[cid]) if cid in packets else None})
    ranked = sorted((c for c in corners if c["worst"] is not None and c["time_lost_s"] is not None),
                    key=lambda c: -c["time_lost_s"])
    top_list = []
    for c in ranked[:top]:
        p = packets[c["corner_id"]]
        top_list.append({"corner_id": c["corner_id"], "name": names.get(c["corner_id"], c["corner_id"]),
                         "attempt_id": p["attempt_id"], "time_lost_s": c["time_lost_s"], "worst": c["worst"],
                         "delta": {k: p["delta"][k] for k in LAP_METRICS if k in p["delta"]},
                         "suggested": {k: v for k, v in p["suggested"].items() if k in p["allowed"]["drills"]}})
    # the decision runs at the last corner, before the lap line: lap_time_s is the last full lap
    return {"lap": lap, "last_lap_time_s": lap_time_s, "delta_s": round(lost_total, 2),
            "corners_scored": len(corners),
            "invalid": [{"corner_id": cid, "reason": a.invalid_reason} for cid, a in runs.items() if not a.valid],
            "top": top_list}


def focus_corner(summary: dict, runs: dict[str, Attempt]) -> str:
    """Corner to decide on: the top corner by time lost; else the first valid one; else any."""
    if summary["top"]:
        return summary["top"][0]["corner_id"]
    return next((cid for cid, a in runs.items() if a.valid), next(iter(runs)))
