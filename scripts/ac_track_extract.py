"""Extract the Monza T1 chicane from Assetto Corsa's AI racing line (fast_lane.ai).

Format sources (Content Manager / actools, gro-ove):
  https://github.com/gro-ove/actools/blob/master/AcTools/AiFile/AiSpline.cs
  https://github.com/gro-ove/actools/blob/master/AcTools/AiFile/AiPoint.cs
  https://github.com/gro-ove/actools/blob/master/AcTools/AiFile/AiPointExtra.cs

Layout (little endian, version 7 only; all structs Pack=4, no padding):
  header : int32 version (=7), int32 point_count, int32 lap_time, int32 sample_count
  points : point_count x { float32 x, y, z; float32 length; int32 id }          (20 bytes)
           `length` = cumulative distance along the line in metres
  extras : int32 extra_count, then extra_count x 18 float32 (72 bytes):
           speed, gas, brake, obsolete_lat_g, radius, side_left, side_right,
           camber, direction, normal(x,y,z), length, forward(x,y,z), tag, grade
  grid   : int32 has_grid, optional spatial grid (not needed here, ignored)

Unverified assumptions (not stated in the sources above):
  * `speed` is in m/s (SPEED_TO_KMH = 3.6); AC's AI code works in SI units.
  * point 0 sits at the start/finish line, so `length` is metres from the line.
  * `radius` may be signed (turn direction) and huge/0 on straights; we use abs(),
    with 0 treated as "straight".
  * Kunos tracks may carry zeroed brake/gas; the brake fallback covers that.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import struct
import sys
from dataclasses import dataclass, replace
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SUPPORTED_VERSION = 7
HEADER = struct.Struct("<4i")
POINT = struct.Struct("<4fi")          # x y z length id
EXTRA = struct.Struct("<18f")
EXTRA_FIELDS = (
    "speed", "gas", "brake", "obsolete_lat_g", "radius", "side_left", "side_right",
    "camber", "direction", "nx", "ny", "nz", "length", "fx", "fy", "fz", "tag", "grade",
)

SPEED_TO_KMH = 3.6                      # file speed is assumed m/s

# --- chicane detection tuning ------------------------------------------------
STRAIGHT_RADIUS_M = 5000.0              # radius used for straights / radius == 0
CORNER_RADIUS_MAX_M = 250.0             # a local radius minimum above this is not an apex
APEX_NEIGHBOURHOOD_M = 15.0             # an apex is the minimum within +-this distance
MIN_APEX_SEPARATION_M = 25.0            # the two apexes must be at least this far apart
TURN_IN_RADIUS_FACTOR = 3.0             # turn-in: radius > factor * apex1 radius, walking back
EXIT_RADIUS_FACTOR = 4.0                # exit: radius > factor * apex2 radius, walking forward
BRAKE_THRESHOLD = 0.02                  # brake value counted as "braking"
BRAKE_SEARCH_M = 600.0                  # max distance before apex1 to look for brake input
BRAKE_FALLBACK_BEFORE_BOARD_M = 150.0   # fallback brake point = board_zero_m - this
START_GATE_BEFORE_BRAKE_M = 250.0       # start gate = brake zone start - this
GAS_PICKUP_THRESHOLD = 0.2
TRACE_STEP_M = 2.0
MIN_SPEED_MS = 1.0                      # floor when integrating section time

# --- whole-lap (braking zones -> track) tuning ----------------------------------
ZONE_MIN_BRAKE = 0.3                    # brake value counted as braking when finding zones
ZONE_MIN_GAP_M = 150.0                  # brake runs closer than this merge into one zone
FALLBACK_DROP_KMH = 30.0                # zeroed-brake fallback: min must drop this far from the peak
FALLBACK_LOOKBACK_M = 600.0             # ... looking back this far for the preceding speed peak
FALLBACK_MIN_WINDOW_M = 100.0           # ... a speed minimum is the lowest within +-this distance
FALLBACK_PEAK_TOL_KMH = 1.0             # speeds this close to the peak count as the peak plateau
WINDOW_BEFORE_BRAKE_M = 50.0            # corner search window starts this far before the brake point
WINDOW_AFTER_BRAKE_M = 700.0            # ... and ends at most this far after it
SINGLE_APEX_HALF_WINDOW_M = 10.0        # single-apex corner: apex window = apex +- this
START_GATE_MIN_GAP_M = 10.0             # start gate stays this far past the previous exit gate
BOARD_ZERO_AFTER_BRAKE_M = 100.0        # new corner board_zero_m = brake_m + this
ID_MATCH_RADIUS_M = 300.0               # reuse a base corner id if its apex is this close
REMINDER_BEFORE_START_M = 200.0
REMINDER_AFTER_EXIT_M = 20.0
TALK_ZONE_MARGIN_M = 20.0               # talk zones keep this clear of corner gates
TALK_ZONE_MIN_LEN_M = 100.0
DEFAULT_TRACK_NAME = "Track"
DEFAULT_TRACK_DEFAULTS = {
    "wheelbase_m": 2.62,
    "comparable_entry_kmh": 5,
    "tolerance": {"brake_onset_m": 5, "throttle_pickup_m": 5, "section_s": 0.1, "release_s": 0.15},
    "allowed": {
        "drills": ["brake_point", "brake_release", "throttle_pickup"],
        "brake_point": {"marker_m": [50, 150], "peak_brake": [0.6, 1.0]},
        "brake_release": {"release_s": [0.2, 1.5]},
        "throttle_pickup": {"marker_m": [0, 80]},
    },
}

class AiFormatError(ValueError):
    pass


@dataclass
class LanePoint:
    index: int
    id: int
    dist_m: float
    x: float
    y: float
    z: float
    speed_kmh: float
    gas: float
    brake: float
    radius: float
    side_left: float
    side_right: float
    camber: float
    grade: float


@dataclass
class Chicane:
    brake_m: float
    turn_in_m: float
    apex1_m: float
    apex2_m: float
    exit_m: float
    slowest_m: float
    brake_from_fallback: bool


# --- parsing -----------------------------------------------------------------

def parse_bytes(data: bytes) -> list[LanePoint]:
    if len(data) < HEADER.size:
        raise AiFormatError("file too short for an fast_lane.ai header")
    version, n, _lap_time, _samples = HEADER.unpack_from(data, 0)
    if version != SUPPORTED_VERSION:
        raise AiFormatError(f"fast_lane.ai version {version} not supported (only {SUPPORTED_VERSION})")
    if n < 0 or n > 10_000_000:
        raise AiFormatError(f"implausible point count {n}")
    off = HEADER.size
    pts_end = off + n * POINT.size
    if len(data) < pts_end + 4:
        raise AiFormatError("file truncated in point block")
    raw_pts = [POINT.unpack_from(data, off + i * POINT.size) for i in range(n)]
    (m,) = struct.unpack_from("<i", data, pts_end)
    ex_off = pts_end + 4
    if m != n:
        raise AiFormatError(f"extra count {m} != point count {n}")
    if len(data) < ex_off + m * EXTRA.size:
        raise AiFormatError("file truncated in extra block")
    out = []
    for i, (x, y, z, length, pid) in enumerate(raw_pts):
        e = dict(zip(EXTRA_FIELDS, EXTRA.unpack_from(data, ex_off + i * EXTRA.size)))
        out.append(LanePoint(
            index=i, id=pid, dist_m=length, x=x, y=y, z=z,
            speed_kmh=e["speed"] * SPEED_TO_KMH, gas=e["gas"], brake=e["brake"],
            radius=e["radius"], side_left=e["side_left"], side_right=e["side_right"],
            camber=e["camber"], grade=e["grade"],
        ))
    return out


def parse_file(path: Path) -> list[LanePoint]:
    return parse_bytes(Path(path).read_bytes())


def lap_length(points: list[LanePoint]) -> float:
    """Closed-loop length: last cumulative distance plus the closing segment."""
    a, b = points[-1], points[0]
    return a.dist_m + math.dist((a.x, a.y, a.z), (b.x, b.y, b.z))


# --- chicane detection ---------------------------------------------------------

def _rad(p: LanePoint) -> float:
    r = abs(p.radius)
    return STRAIGHT_RADIUS_M if r == 0 else min(r, STRAIGHT_RADIUS_M)


def find_chicane(points: list[LanePoint], window: tuple[float, float],
                 board_zero_m: float | None = None) -> Chicane:
    idx = [i for i, p in enumerate(points) if window[0] <= p.dist_m <= window[1]]
    if len(idx) < 5:
        raise AiFormatError(f"fewer than 5 points inside window {window}")
    rad = {i: _rad(points[i]) for i in idx}

    cands = []
    for i in idx:
        r, d = rad[i], points[i].dist_m
        if r >= CORNER_RADIUS_MAX_M:
            continue
        ok = True
        for j in idx:
            dj = points[j].dist_m
            if abs(dj - d) > APEX_NEIGHBOURHOOD_M or j == i:
                continue
            if rad[j] < r or (rad[j] == r and j < i):   # plateau: keep the first point
                ok = False
                break
        if ok:
            cands.append(i)
    cands.sort(key=lambda i: rad[i])
    chosen: list[int] = []
    for i in cands:
        if all(abs(points[i].dist_m - points[j].dist_m) >= MIN_APEX_SEPARATION_M for j in chosen):
            chosen.append(i)
        if len(chosen) == 2:
            break
    if len(chosen) < 2:
        raise AiFormatError(f"found {len(chosen)} apex candidates in window {window}, need 2")
    a1, a2 = sorted(chosen)

    # turn-in: walk back from apex 1 until the radius opens up
    thr_in = TURN_IN_RADIUS_FACTOR * rad[a1]
    k = a1
    while k > idx[0] and rad[k] <= thr_in:
        k -= 1
    turn_in = points[k].dist_m
    # exit: walk forward from apex 2 until the radius opens up
    thr_out = EXIT_RADIUS_FACTOR * rad[a2]
    k = a2
    while k < idx[-1] and rad[k] <= thr_out:
        k += 1
    exit_m = points[k].dist_m

    # brake zone: contiguous brake>thr run nearest before apex 1
    apex1_m = points[a1].dist_m
    lo = max(window[0], apex1_m - BRAKE_SEARCH_M)
    run_end = next((i for i in range(a1, -1, -1)
                    if points[i].dist_m >= lo and points[i].brake > BRAKE_THRESHOLD), None)
    fallback = run_end is None
    if fallback:
        if board_zero_m is None:
            raise AiFormatError("no brake input before apex 1 and no board_zero_m for fallback")
        brake_m = board_zero_m - BRAKE_FALLBACK_BEFORE_BOARD_M
    else:
        s = run_end
        while s > 0 and points[s - 1].brake > BRAKE_THRESHOLD and points[s - 1].dist_m >= lo:
            s -= 1
        brake_m = points[s].dist_m

    slow = min((points[i] for i in range(a1, a2 + 1)), key=lambda p: p.speed_kmh)
    return Chicane(brake_m, turn_in, apex1_m, points[a2].dist_m, exit_m, slow.dist_m, fallback)


@dataclass
class BrakingZone:
    brake_m: float
    slowest_m: float
    fallback: bool


def _brake_runs(points: list[LanePoint], min_brake: float) -> list[tuple[int, int]]:
    runs: list[tuple[int, int]] = []
    start = None
    for i, p in enumerate(points):
        if p.brake > min_brake:
            start = i if start is None else start
        elif start is not None:
            runs.append((start, i - 1))
            start = None
    if start is not None:
        runs.append((start, len(points) - 1))
    return runs


def _merge_runs(points: list[LanePoint], runs: list[tuple[int, int]],
                min_gap_m: float) -> list[tuple[int, int]]:
    merged: list[tuple[int, int]] = []
    for s, e in runs:
        if merged and points[s].dist_m - points[merged[-1][1]].dist_m < min_gap_m:
            merged[-1] = (merged[-1][0], e)
        else:
            merged.append((s, e))
    return merged


def _zones_from_brake(points: list[LanePoint], min_brake: float, min_gap_m: float) -> list[BrakingZone]:
    runs = _merge_runs(points, _brake_runs(points, min_brake), min_gap_m)
    zones = []
    for k, (s, e) in enumerate(runs):
        limit = runs[k + 1][0] if k + 1 < len(runs) else len(points)
        # slowest point: from the zone start until throttle is back on (after the brake run) or the next zone
        j = next((i for i in range(e + 1, limit) if points[i].gas > GAS_PICKUP_THRESHOLD), limit)
        slow = min(points[s:max(j, e + 1)], key=lambda p: p.speed_kmh)
        zones.append(BrakingZone(points[s].dist_m, slow.dist_m, False))
    return zones


def _zones_from_speed(points: list[LanePoint]) -> list[BrakingZone]:
    zones: list[BrakingZone] = []
    prev_slow = -math.inf
    for i, p in enumerate(points):
        near = [q for q in points if abs(q.dist_m - p.dist_m) <= FALLBACK_MIN_WINDOW_M]
        if any(q.speed_kmh < p.speed_kmh or (q.speed_kmh == p.speed_kmh and q.index < i) for q in near):
            continue
        lo = max(p.dist_m - FALLBACK_LOOKBACK_M, prev_slow)
        before = [q for q in points if lo <= q.dist_m < p.dist_m]
        if not before:
            continue
        peak = max(q.speed_kmh for q in before)
        if peak - p.speed_kmh < FALLBACK_DROP_KMH:
            continue
        top = [q for q in before if q.speed_kmh >= peak - FALLBACK_PEAK_TOL_KMH][-1]
        zones.append(BrakingZone(top.dist_m, p.dist_m, True))
        prev_slow = p.dist_m
    return zones


def find_braking_zones(points: list[LanePoint], min_brake: float = ZONE_MIN_BRAKE,
                       min_gap_m: float = ZONE_MIN_GAP_M) -> list[BrakingZone]:
    """Every run of brake > min_brake (runs closer than min_gap_m merge) is a braking zone.
    With no brake input at all (zeroed column) fall back to speed minima; zones are marked."""
    if any(p.brake > min_brake for p in points):
        return _zones_from_brake(points, min_brake, min_gap_m)
    return _zones_from_speed(points)


# --- outputs -------------------------------------------------------------------

def _r(v: float) -> float:
    return round(float(v), 1)


def build_corner(base: dict, ch: Chicane, track_length_m: float) -> dict:
    out = dict(base)
    out["start_gate_m"] = _r(ch.brake_m - START_GATE_BEFORE_BRAKE_M)
    # apex window = [apex1, apex2]: the slowest point of a chicane can sit at either
    # apex or between them, and apex_kmh is "min speed in the window", so spanning
    # both apexes never misses it (a window around the slowest point alone could).
    out["apex_window_m"] = [_r(ch.apex1_m), _r(ch.apex2_m)]
    out["exit_gate_m"] = _r(ch.exit_m)
    out["track_length_m"] = _r(track_length_m)
    out["gates"] = {"brake_m": _r(ch.brake_m), "turn_in_m": _r(ch.turn_in_m),
                    "apex1_m": _r(ch.apex1_m), "apex2_m": _r(ch.apex2_m)}
    out["_source"] = "fast_lane.ai v7"
    return out


def _single_apex(points: list[LanePoint], window: tuple[float, float], brake_m: float,
                 slowest_m: float, fallback: bool) -> Chicane:
    idx = [i for i, p in enumerate(points) if window[0] <= p.dist_m <= window[1]]
    if len(idx) < 5:
        raise AiFormatError(f"fewer than 5 points inside window {window}")
    rad = {i: _rad(points[i]) for i in idx}
    a = min(idx, key=lambda i: (rad[i], i))
    k = a
    while k > idx[0] and rad[k] <= TURN_IN_RADIUS_FACTOR * rad[a]:
        k -= 1
    turn_in = points[k].dist_m
    k = a
    while k < idx[-1] and rad[k] <= EXIT_RADIUS_FACTOR * rad[a]:
        k += 1
    apex = points[a].dist_m
    # apex1/apex2 hold the apex window ends, as build_corner expects
    return Chicane(brake_m, turn_in, apex - SINGLE_APEX_HALF_WINDOW_M, apex + SINGLE_APEX_HALF_WINDOW_M,
                   points[k].dist_m, slowest_m, fallback)


def build_zone_corners(points: list[LanePoint], zones: list[BrakingZone],
                       lap_len: float) -> list[dict]:
    """One corner per braking zone: a chicane if find_chicane fits the window, else a single apex.
    Dicts carry start/apex/exit gates and gates{}; "_fallback" marks zones from the speed fallback."""
    zones = sorted(zones, key=lambda z: z.brake_m)
    corners: list[dict] = []
    prev_exit = None
    for k, z in enumerate(zones):
        hi = z.brake_m + WINDOW_AFTER_BRAKE_M
        if k + 1 < len(zones):
            hi = min(hi, zones[k + 1].brake_m - WINDOW_BEFORE_BRAKE_M)
        window = (max(0.0, z.brake_m - WINDOW_BEFORE_BRAKE_M), hi)
        try:
            ch = find_chicane(points, window, z.brake_m + BRAKE_FALLBACK_BEFORE_BOARD_M)
            ch = replace(ch, brake_m=z.brake_m, brake_from_fallback=z.fallback)
        except AiFormatError:
            ch = _single_apex(points, window, z.brake_m, z.slowest_m, z.fallback)
        c = build_corner({}, ch, lap_len)
        start = max(0.0, z.brake_m - START_GATE_BEFORE_BRAKE_M)
        if prev_exit is not None:
            start = max(start, prev_exit + START_GATE_MIN_GAP_M)
        c["start_gate_m"] = _r(start)
        c["exit_gate_m"] = _r(min(ch.exit_m, lap_len))
        del c["track_length_m"], c["_source"]
        c["_fallback"] = z.fallback
        corners.append(c)
        prev_exit = c["exit_gate_m"]
    return corners


def _apex_mid(c: dict) -> float:
    return sum(c["apex_window_m"]) / 2


def _match_base_ids(corners: list[dict], base_corners: list[dict]) -> dict[int, dict]:
    pairs = sorted((abs(_apex_mid(c) - _apex_mid(b)), i, j)
                   for i, c in enumerate(corners) for j, b in enumerate(base_corners))
    match: dict[int, dict] = {}
    used: set[int] = set()
    for d, i, j in pairs:
        if d < ID_MATCH_RADIUS_M and i not in match and j not in used:
            match[i] = base_corners[j]
            used.add(j)
    return match


def _talk_zones(corners: list[dict], lap_len: float) -> list[list[float]]:
    """Gaps between consecutive corners; the last->first gap wraps the lap line (a > b)."""
    zones = []
    for k, c in enumerate(corners):
        wraps = k + 1 == len(corners)
        a = c["exit_gate_m"] + TALK_ZONE_MARGIN_M
        b = corners[(k + 1) % len(corners)]["start_gate_m"] - TALK_ZONE_MARGIN_M
        if b - a + (lap_len if wraps else 0.0) >= TALK_ZONE_MIN_LEN_M:
            zones.append([_r(a), _r(b)])
    return zones


def build_track(base: dict | None, corners: list[dict], lap_len: float,
                name: str | None = None) -> dict:
    """Track JSON in the fixtures/track_*.json format. `base` supplies name, defaults and the
    id/name/board_zero_m of corners whose apex is within ID_MATCH_RADIUS_M of a new corner's."""
    base = base or {}
    corners = sorted(corners, key=lambda c: c["start_gate_m"])
    matched = _match_base_ids(corners, base.get("corners") or [])
    taken = {b["id"] for b in matched.values()}
    out_corners = []
    prev_exit = None
    for i, c in enumerate(corners):
        if i in matched:
            cid, cname, board = matched[i]["id"], matched[i]["name"], matched[i]["board_zero_m"]
        else:
            n = i + 1
            while f"c{n}" in taken:
                n += 1
            cid, cname = f"c{n}", f"Corner {i + 1}"
            board = _r(c["gates"]["brake_m"] + BOARD_ZERO_AFTER_BRAKE_M)
            taken.add(cid)
        reminder = c["start_gate_m"] - REMINDER_BEFORE_START_M
        if prev_exit is not None:
            reminder = max(prev_exit + REMINDER_AFTER_EXIT_M, reminder)
        out_corners.append({
            "id": cid, "name": cname, "start_gate_m": c["start_gate_m"], "board_zero_m": board,
            "apex_window_m": c["apex_window_m"], "exit_gate_m": c["exit_gate_m"],
            "reminder_m": _r(max(0.0, reminder)), "gates": c["gates"]})
        prev_exit = c["exit_gate_m"]
    return {
        "name": base.get("name") or name or DEFAULT_TRACK_NAME,
        "length_m": _r(lap_len),
        "talk_zones": _talk_zones(corners, lap_len) if corners else [],
        "defaults": base.get("defaults") or DEFAULT_TRACK_DEFAULTS,
        "corners": out_corners,
    }


def _interp(points: list[LanePoint], s: float, attr: str) -> float:
    lo, hi = 0, len(points) - 1
    if s <= points[0].dist_m:
        return getattr(points[0], attr)
    if s >= points[hi].dist_m:
        return getattr(points[hi], attr)
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if points[mid].dist_m <= s:
            lo = mid
        else:
            hi = mid
    a, b = points[lo], points[hi]
    span = b.dist_m - a.dist_m
    t = 0.0 if span <= 0 else (s - a.dist_m) / span
    return getattr(a, attr) * (1 - t) + getattr(b, attr) * t


def build_reference(points: list[LanePoint], corner: dict) -> dict:
    start, end = corner["start_gate_m"], corner["exit_gate_m"]
    a1, a2 = corner["apex_window_m"]
    brake_m = corner["gates"]["brake_m"]
    n = int(math.floor((end - start) / TRACE_STEP_M)) + 1
    positions = [start + i * TRACE_STEP_M for i in range(n)]
    if positions[-1] < end - 1e-9:
        positions.append(end)
    trace = [[_r(s), round(_interp(points, s, "brake"), 3), round(_interp(points, s, "gas"), 3),
              round(_interp(points, s, "speed_kmh"), 2)] for s in positions]

    in_apex = [p for p in points if a1 <= p.dist_m <= a2]
    slowest = min(in_apex, key=lambda p: p.speed_kmh)
    pickup = next((p.dist_m for p in points
                   if p.dist_m > slowest.dist_m and p.gas > GAS_PICKUP_THRESHOLD), end)
    pickup = min(pickup, end)
    braking = [row[1] for row in trace if brake_m <= row[0] <= a1]
    peak = max(braking) if braking else 0.0

    t = 0.0
    for r0, r1 in zip(trace, trace[1:]):
        v0 = max(r0[3] / SPEED_TO_KMH, MIN_SPEED_MS)
        v1 = max(r1[3] / SPEED_TO_KMH, MIN_SPEED_MS)
        t += (r1[0] - r0[0]) * 0.5 * (1 / v0 + 1 / v1)

    attempt = {
        "attempt_id": "ai", "valid": True, "invalid_reason": None,
        "entry_kmh": round(trace[0][3], 1),
        "apex_kmh": round(slowest.speed_kmh, 1),
        "exit_kmh": round(trace[-1][3], 1),
        "brake_onset_m": _r(brake_m),
        "peak_brake": round(peak, 2),
        "throttle_pickup_m": _r(pickup),
        "section_s": round(t, 2),
    }
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    from engine.analysis import driving_profile
    from engine.models import Attempt, CornerConfig
    cfg = CornerConfig(**{k: v for k, v in corner.items() if not k.startswith("_")})
    profile = driving_profile(trace, cfg)
    for key in Attempt.__dataclass_fields__:
        if key not in attempt and profile.get(key) is not None:
            attempt[key] = profile[key]
    # The AI reference itself follows its line; a car trace must carry x/z.
    if corner.get("racing_line"):
        attempt["line_offset_m"] = 0.0
    return {"attempt": attempt, "trace": trace}


def lap_time_s(points: list[LanePoint]) -> float:
    """Whole-lap time integrated from the speed column (closing segment included)."""
    ends = [p.dist_m for p in points[1:]] + [lap_length(points)]
    speeds = [max(p.speed_kmh / SPEED_TO_KMH, MIN_SPEED_MS) for p in points]
    speeds.append(speeds[0])
    return sum((d1 - p.dist_m) * 0.5 * (1 / v0 + 1 / v1)
               for p, d1, v0, v1 in zip(points, ends, speeds, speeds[1:]))


def build_track_reference(points: list[LanePoint], track: dict) -> dict:
    # Same merge as engine.config.load_track: build_reference needs a full CornerConfig
    defaults = {k: v for k, v in (track.get("defaults") or {}).items() if not k.startswith("_")}
    full = [{"track_length_m": track["length_m"], **defaults, **c} for c in track["corners"]]
    return {"source": "fast_lane.ai v7", "lap_time_s": round(lap_time_s(points), 2),
            "corners": {c["id"]: build_reference(points, c) for c in full}}


# --- CLI -----------------------------------------------------------------------

def resolve_ai_path(p: Path) -> Path:
    p = Path(p)
    if p.is_file():
        return p
    for cand in (p / "ai" / "fast_lane.ai", p / "fast_lane.ai"):
        if cand.is_file():
            return cand
    raise FileNotFoundError(f"no fast_lane.ai found at or under {p}")


def corner_diff(old: dict, new: dict) -> list[str]:
    lines = []
    for k in sorted(set(old) | set(new)):
        if old.get(k, "<absent>") != new.get(k, "<absent>"):
            lines.append(f"  {k}: {json.dumps(old.get(k, '<absent>'))} -> {json.dumps(new.get(k, '<absent>'))}")
    return lines


def dump_csv(points: list[LanePoint], path: Path) -> None:
    fields = list(LanePoint.__dataclass_fields__)
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(fields)
        for p in points:
            w.writerow([getattr(p, k) for k in fields])


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("track_dir", metavar="track", help="track folder or path to fast_lane.ai")
    ap.add_argument("--corner", default=str(ROOT / "fixtures" / "corner_monza_t1.json"),
                    help="existing corner config to copy keys from")
    ap.add_argument("--out", help="write updated corner JSON here (omit to only print the diff)")
    ap.add_argument("--ref-out", help="write AI reference attempt + trace JSON here")
    ap.add_argument("--window", nargs=2, type=float, default=[0.0, 1200.0], metavar=("START_M", "END_M"))
    ap.add_argument("--dump", help="write all points to this CSV")
    ap.add_argument("--track-out", help="whole lap: write track JSON (a corner per braking zone) here")
    ap.add_argument("--track", help="base track JSON for ids/names/defaults "
                    "(default fixtures/track_monza.json if it exists)")
    ap.add_argument("--track-ref-out", help="whole lap: write per-corner AI reference JSON here")
    args = ap.parse_args(argv)

    track_mode = bool(args.track_out or args.track_ref_out)
    single = bool(args.out or args.ref_out) or not track_mode
    try:
        path = resolve_ai_path(Path(args.track_dir))
        points = parse_file(path)
        if single:
            base = json.loads(Path(args.corner).read_text(encoding="utf-8"))
            ch = find_chicane(points, (args.window[0], args.window[1]), base.get("board_zero_m"))
    except (OSError, AiFormatError, json.JSONDecodeError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1

    if args.dump:
        dump_csv(points, Path(args.dump))
    print(f"{len(points)} points from {path}")
    if single:
        if ch.brake_from_fallback:
            print(f"warning: no AI brake input before apex 1; brake point falls back to "
                  f"board_zero_m - {BRAKE_FALLBACK_BEFORE_BOARD_M:g} = {ch.brake_m:g} m", file=sys.stderr)
        corner = build_corner(base, ch, lap_length(points))
        # Preserve world coordinates for racing-line comparisons. Calibration stays
        # explicitly false until O2 checks the mapping against live carCoordinates.
        corner["racing_line"] = [[round(p.dist_m, 3), p.x, p.z] for p in points]
        diff = corner_diff(base, corner)
        print("corner changes:\n" + ("\n".join(diff) if diff else "  (none)"))
        if args.out:
            Path(args.out).write_text(json.dumps(corner, indent=2) + "\n", encoding="utf-8")
            print(f"wrote {args.out}")
        if args.ref_out:
            Path(args.ref_out).write_text(json.dumps(build_reference(points, corner)) + "\n", encoding="utf-8")
            print(f"wrote {args.ref_out}")
    if track_mode:
        try:
            return _run_track(args, points, path)
        except (OSError, AiFormatError, json.JSONDecodeError) as e:
            print(f"error: {e}", file=sys.stderr)
            return 1
    return 0


def _run_track(args, points: list[LanePoint], path: Path) -> int:
    base_path = Path(args.track) if args.track else ROOT / "fixtures" / "track_monza.json"
    base = None
    if args.track or base_path.is_file():
        base = json.loads(base_path.read_text(encoding="utf-8"))
    lap_len = lap_length(points)
    zones = find_braking_zones(points)
    if not zones:
        raise AiFormatError("no braking zones found")
    corners = build_zone_corners(points, zones, lap_len)
    track = build_track(base, corners, lap_len, name=path.parent.parent.name or None)
    print(f"track {track['name']}: {len(track['corners'])} corners")
    for c, raw in zip(track["corners"], corners):
        print(f"  {c['id']}: brake_m={c['gates']['brake_m']:g}")
        if raw["_fallback"]:
            print(f"warning: {c['id']} brake point from speed minimum (no AI brake input)", file=sys.stderr)
    if args.track_out:
        Path(args.track_out).write_text(json.dumps(track, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {args.track_out}")
    if args.track_ref_out:
        Path(args.track_ref_out).write_text(
            json.dumps(build_track_reference(points, track)) + "\n", encoding="utf-8")
        print(f"wrote {args.track_ref_out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
