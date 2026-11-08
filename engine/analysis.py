"""Driving profile, micro-sector splits and run comparison: pure functions over a corner trace.

A trace is a list of rows sampled every ~2 m between the start and exit gates:
    [pos_m, brake, gas, speed_kmh, t_s, steer, yaw_rate, slip_front, slip_rear, gear, world_x, world_z]
Only the first four columns are required (older traces and the reference fixture have just
those); time is then integrated from distance and speed, and the columns that need steering,
yaw or wheel slip come back as None.
"""
from __future__ import annotations

import statistics
import math
from bisect import bisect_right
from typing import Any, Sequence

from .models import CornerConfig

POS, BRAKE, GAS, SPEED, T, STEER, YAW, SLIP_F, SLIP_R, GEAR, X, Z = range(12)
BRAKE_ON = 0.10          # brake "pressed"
GAS_ON = 0.20            # throttle "picked up"
COAST = 0.05             # both pedals below this = coasting
PEAK_HOLD = 0.90         # release starts after the last sample at >= 90% of peak
STEER_ON = 0.05          # |steer| above this counts as turning (AC steer input, normalised)
LOCK_SLIP = 0.15         # front slip above this while braking = lock-up (units: AC wheelSlip)
SPIN_SLIP = 0.15         # rear slip above this on throttle = wheelspin
STAB_S = 0.12            # brake reaching 95% of peak faster than this = "stabbing"
NEAR_MIN_KMH = 5.0       # time spent within this of the minimum speed: V vs U line
V_LINE_S = 1.0
APEX_SLACK_M = 5.0
DELTA_STEP_M = 10.0
SECTORS = (("approach", "start_m", "brake_m"), ("braking", "brake_m", "turn_in_m"),
           ("entry", "turn_in_m", "apex1_m"), ("apex", "apex1_m", "apex2_m"),
           ("exit", "apex2_m", "exit_m"))


# ---------------------------------------------------------------- helpers
def _has(trace: Sequence[Sequence[float]], col: int) -> bool:
    return bool(trace) and all(len(r) > col and isinstance(r[col], (int, float)) and math.isfinite(r[col]) for r in trace)


def times(trace: Sequence[Sequence[float]]) -> list[float]:
    """Seconds from the first row: the T column, or integrated from distance / speed."""
    if not trace:
        return []
    if _has(trace, T):
        t0 = trace[0][T]
        return [r[T] - t0 for r in trace]
    out, t = [0.0], 0.0
    for a, b in zip(trace, trace[1:]):
        v = max((a[SPEED] + b[SPEED]) / 2 / 3.6, 0.5)
        t += max(b[POS] - a[POS], 0.0) / v
        out.append(t)
    return out


def time_at(trace: Sequence[Sequence[float]], pos: float, ts: list[float] | None = None) -> float | None:
    """Interpolated time (s from the first row) at a track position; None outside the trace."""
    ts = ts if ts is not None else times(trace)
    for i in range(1, len(trace)):
        a, b = trace[i - 1][POS], trace[i][POS]
        if a <= pos <= b:
            f = 0.0 if b == a else (pos - a) / (b - a)
            return ts[i - 1] + f * (ts[i] - ts[i - 1])
    return None


def _dur(ts: list[float], idx: list[int]) -> float:
    """Total time covered by the sample indices (each sample owns the step to the next)."""
    total = 0.0
    for i in idx:
        if i + 1 < len(ts):
            total += ts[i + 1] - ts[i]
    return total


def _r(x: float | None, nd: int = 2) -> float | None:
    return None if x is None else round(x, nd)


# ---------------------------------------------------------------- profile
def driving_profile(trace: Sequence[Sequence[float]], corner: CornerConfig) -> dict[str, Any]:
    """Style traits with numbers, from one run between the start and exit gates."""
    if len(trace) < 3:
        return {"error": "trace too short"}
    ts = times(trace)
    n = len(trace)
    brake = [r[BRAKE] for r in trace]
    gas = [r[GAS] for r in trace]
    speed = [r[SPEED] for r in trace]
    pos = [r[POS] for r in trace]
    out: dict[str, Any] = {}

    on = next((i for i in range(n) if brake[i] > BRAKE_ON), None)
    if on is None:
        out.update(brake_onset_m=None, brake_board_m=None, peak_brake=round(max(brake), 2))
        braking: list[int] = []
    else:
        peak = max(brake[on:])
        ipk = on + brake[on:].index(peak)
        reach = next((i for i in range(on, n) if brake[i] >= 0.95 * peak), ipk)
        hold = max(i for i in range(on, n) if brake[i] >= PEAK_HOLD * peak)
        off = next((i for i in range(hold, n) if brake[i] < BRAKE_ON), n - 1)
        braking = [i for i in range(on, off)]
        out.update(
            brake_onset_m=_r(pos[on], 1),
            brake_board_m=_r(corner.board_zero_m - pos[on], 1),
            peak_brake=_r(peak),
            time_to_peak_s=_r(ts[reach] - ts[on]),
            release_s=_r(ts[off] - ts[hold]),
            release_end_m=_r(pos[off], 1),
            braking_s=_r(ts[off] - ts[on]),
            brake_style="stabbing" if ts[reach] - ts[on] < STAB_S else "smooth",
        )
    # trail braking: share of the braking zone spent turning
    if braking and _has(trace, STEER):
        turning = [i for i in braking if abs(trace[i][STEER]) > STEER_ON]
        out["trail_brake_share"] = _r(len(turning) / len(braking))
    else:
        out["trail_brake_share"] = None
    turn = next((i for i in range(on, n) if abs(trace[i][STEER]) > STEER_ON), None) \
        if on is not None and _has(trace, STEER) else None
    out["turn_in_m"] = _r(pos[turn], 1) if turn is not None else None
    # Ignore neutral/reverse transitions, and shifts on the exit acceleration.
    shifts = []
    if _has(trace, GEAR):
        previous_gear = None
        for i, row in enumerate(trace):
            gear = row[GEAR]
            if gear < 1:  # retain the last forward gear through a neutral blip
                continue
            if previous_gear is not None and gear < previous_gear and on is not None \
                    and i >= on and pos[i] <= corner.gate("apex1_m"):
                shifts.append(i)
            previous_gear = gear
    out["last_downshift_m"] = _r(pos[shifts[-1]], 1) if shifts else None
    out["line_offset_m"] = line_offset(trace, corner)
    # coasting between brake onset and the exit
    start = on if on is not None else 0
    out["coast_s"] = _r(_dur(ts, [i for i in range(start, n - 1)
                                  if brake[i] < COAST and gas[i] < COAST]))
    # lock-up / wheelspin
    if _has(trace, SLIP_F):
        out["lockup_s"] = _r(_dur(ts, [i for i in range(n) if brake[i] > BRAKE_ON
                                       and abs(trace[i][SLIP_F]) > LOCK_SLIP]))
    else:
        out["lockup_s"] = None
    if _has(trace, SLIP_R):
        out["wheelspin_s"] = _r(_dur(ts, [i for i in range(n) if gas[i] > GAS_ON
                                          and abs(trace[i][SLIP_R]) > SPIN_SLIP]))
    else:
        out["wheelspin_s"] = None
    # minimum speed and where, relative to the apex window
    imin = min(range(n), key=lambda i: speed[i])
    a1, a2 = corner.gate("apex1_m"), corner.gate("apex2_m")
    mid = (a1 + a2) / 2
    out.update(min_kmh=_r(speed[imin], 1), min_pos_m=_r(pos[imin], 1),
               min_vs_apex_m=_r(pos[imin] - mid, 1))
    near = [i for i in range(n) if speed[i] <= speed[imin] + NEAR_MIN_KMH]
    near_s = _dur(ts, near)
    out["near_min_s"] = _r(near_s)
    # throttle pickup after the slowest point, and how fast it reaches full
    up = next((i for i in range(imin, n) if gas[i] > GAS_ON), None)
    if up is None:
        out.update(throttle_pickup_m=None, pickup_after_apex_m=None, full_throttle_s=None)
    else:
        full = next((i for i in range(up, n) if gas[i] >= 0.95), None)
        out.update(throttle_pickup_m=_r(pos[up], 1),
                   pickup_after_apex_m=_r(pos[up] - corner.apex_window_m[1], 1),
                   full_throttle_s=None if full is None else _r(ts[full] - ts[up]))
    out["understeer_index"] = _understeer(trace, corner)
    # style label
    apex = "early apex" if pos[imin] < a1 - APEX_SLACK_M else \
        "late apex" if pos[imin] > a2 + APEX_SLACK_M else "on the apex"
    line = "V line" if near_s < V_LINE_S else "U line"
    out["style"] = f"{line}, {apex}, {out.get('brake_style', 'no braking')} on the brake"
    out["section_s"] = _r(ts[-1] - ts[0])
    return out


def _understeer(trace: Sequence[Sequence[float]], corner: CornerConfig) -> float | None:
    """median(|steer| / (|yaw| * wheelbase / v)) in the turn: steering used per unit of rotation.
    Units are AC's; it means something only next to the reference lap's value."""
    if not (_has(trace, STEER) and _has(trace, YAW)):
        return None
    lo, hi = corner.gate("turn_in_m"), corner.gate("exit_m")
    vals = []
    for r in trace:
        v = r[SPEED] / 3.6
        if lo <= r[POS] <= hi and abs(r[YAW]) > 0.05 and abs(r[STEER]) > STEER_ON and v > 5:
            vals.append(abs(r[STEER]) / (abs(r[YAW]) * corner.wheelbase_m / v))
    return _r(statistics.median(vals)) if len(vals) >= 3 else None


# ---------------------------------------------------------------- splits
def gates(corner: CornerConfig) -> list[tuple[str, float]]:
    names = ["start_m", "brake_m", "turn_in_m", "apex1_m", "apex2_m", "exit_m"]
    return [(g, corner.gate(g)) for g in names]


def splits(trace: Sequence[Sequence[float]], ref_trace: Sequence[Sequence[float]] | None,
           corner: CornerConfig) -> dict[str, Any]:
    """Micro-sector times (approach, braking, entry, apex, exit) and the gain/loss against ref."""
    ts = times(trace)
    rts = times(ref_trace) if ref_trace else None
    g = dict(gates(corner))
    sectors = []
    for name, a, b in SECTORS:
        ta, tb = time_at(trace, g[a], ts), time_at(trace, g[b], ts)
        t = None if ta is None or tb is None else tb - ta
        row: dict[str, Any] = {"sector": name, "from_m": g[a], "to_m": g[b], "time_s": _r(t, 3)}
        if rts is not None:
            ra, rb = time_at(ref_trace, g[a], rts), time_at(ref_trace, g[b], rts)
            rt = None if ra is None or rb is None else rb - ra
            row["ref_s"] = _r(rt, 3)
            row["delta_s"] = None if t is None or rt is None else _r(t - rt, 3)
        sectors.append(row)
    total = [s["time_s"] for s in sectors]
    out: dict[str, Any] = {"sectors": sectors,
                           "total_s": None if None in total else _r(sum(total), 3)}
    if rts is not None:
        ds = [s.get("delta_s") for s in sectors]
        out["total_delta_s"] = None if None in ds else _r(sum(ds), 3)
        out["delta_trace"] = delta_trace(trace, ref_trace, corner)
        out["summary"] = _split_summary(sectors)
    return out


def delta_trace(trace, ref_trace, corner: CornerConfig, step: float = DELTA_STEP_M) -> list[list[float]]:
    """[pos, running time gained (-) or lost (+) against the reference] every `step` metres."""
    ts, rts = times(trace), times(ref_trace)
    start = corner.gate("start_m")
    t0, r0 = time_at(trace, start, ts), time_at(ref_trace, start, rts)
    out, p = [], start
    while p <= corner.gate("exit_m") + 1e-6:
        a, b = time_at(trace, p, ts), time_at(ref_trace, p, rts)
        if None not in (a, b, t0, r0):
            out.append([round(p, 1), round((a - t0) - (b - r0), 3)])
        p += step
    return out


def _split_summary(sectors: list[dict]) -> str:
    ds = [s for s in sectors if s.get("delta_s") is not None]
    if not ds:
        return ""
    worst = max(ds, key=lambda s: s["delta_s"])
    best = min(ds, key=lambda s: s["delta_s"])
    parts = []
    if worst["delta_s"] > 0.005:
        parts.append(f"you lose {worst['delta_s']:.2f} s in {worst['sector']}")
    if best["delta_s"] < -0.005:
        parts.append(f"gain {-best['delta_s']:.2f} s in {best['sector']}")
    return ", ".join(parts) or "level with the reference"


# ---------------------------------------------------------------- comparison
def compare_runs(a: dict[str, Any], b: dict[str, Any]) -> dict[str, Any]:
    """Metric-by-metric a minus b over two profiles (numbers only; labels side by side)."""
    out: dict[str, Any] = {}
    for k in sorted(set(a) | set(b)):
        x, y = a.get(k), b.get(k)
        if isinstance(x, (int, float)) and isinstance(y, (int, float)) \
                and not isinstance(x, bool) and not isinstance(y, bool):
            out[k] = round(x - y, 3)
        elif isinstance(x, str) or isinstance(y, str):
            if x != y:
                out[k] = {"a": x, "b": y}
    return out


def line_offset(trace: Sequence[Sequence[float]], corner: CornerConfig) -> float | None:
    """RMS lateral distance to nearby AI line segments in world x/z metres.

    Progress confines projection to the local section, avoiding a nearby parallel
    part of a chicane. No extrapolation beyond the supplied AI line is allowed.
    O2 coordinate calibration is enforced by drill eligibility, independently.
    """
    line = corner.racing_line
    if not line or len(line) < 2 or not (_has(trace, X) and _has(trace, Z)):
        return None
    if any(len(p) != 3 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in p)
           for p in line) or any(b[0] <= a[0] for a, b in zip(line, line[1:])):
        return None
    progress = [p[0] for p in line]
    distances = []
    for r in trace:
        if not corner.gate("turn_in_m") <= r[POS] <= corner.exit_gate_m:
            continue
        if not progress[0] <= r[POS] <= progress[-1]:
            return None
        i = min(max(bisect_right(progress, r[POS]) - 1, 0), len(line) - 2)
        candidates = []
        for j in range(max(0, i - 2), min(len(line) - 1, i + 3)):
            a, b = line[j], line[j + 1]
            dx, dz = b[1] - a[1], b[2] - a[2]
            length2 = dx * dx + dz * dz
            if length2 <= 1e-12:
                continue
            f = min(1.0, max(0.0, ((r[X] - a[1]) * dx + (r[Z] - a[2]) * dz) / length2))
            candidates.append((r[X] - a[1] - f * dx) ** 2 + (r[Z] - a[2] - f * dz) ** 2)
        if not candidates:
            return None
        distances.append(min(candidates))
    return round(math.sqrt(sum(distances) / len(distances)), 2) if distances else None
