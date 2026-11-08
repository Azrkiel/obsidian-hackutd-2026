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
from dataclasses import dataclass
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
    ap.add_argument("track", help="track folder or path to fast_lane.ai")
    ap.add_argument("--corner", default=str(ROOT / "fixtures" / "corner_monza_t1.json"),
                    help="existing corner config to copy keys from")
    ap.add_argument("--out", help="write updated corner JSON here (omit to only print the diff)")
    ap.add_argument("--ref-out", help="write AI reference attempt + trace JSON here")
    ap.add_argument("--window", nargs=2, type=float, default=[0.0, 1200.0], metavar=("START_M", "END_M"))
    ap.add_argument("--dump", help="write all points to this CSV")
    args = ap.parse_args(argv)

    try:
        path = resolve_ai_path(Path(args.track))
        points = parse_file(path)
        base = json.loads(Path(args.corner).read_text(encoding="utf-8"))
        ch = find_chicane(points, (args.window[0], args.window[1]), base.get("board_zero_m"))
    except (OSError, AiFormatError, json.JSONDecodeError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    if ch.brake_from_fallback:
        print(f"warning: no AI brake input before apex 1; brake point falls back to "
              f"board_zero_m - {BRAKE_FALLBACK_BEFORE_BOARD_M:g} = {ch.brake_m:g} m", file=sys.stderr)

    if args.dump:
        dump_csv(points, Path(args.dump))
    corner = build_corner(base, ch, lap_length(points))
    # Preserve world coordinates for racing-line comparisons. Calibration stays
    # explicitly false until O2 checks the mapping against live carCoordinates.
    corner["racing_line"] = [[round(p.dist_m, 3), p.x, p.z] for p in points]
    diff = corner_diff(base, corner)
    print(f"{len(points)} points from {path}")
    print("corner changes:\n" + ("\n".join(diff) if diff else "  (none)"))
    if args.out:
        Path(args.out).write_text(json.dumps(corner, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {args.out}")
    if args.ref_out:
        Path(args.ref_out).write_text(json.dumps(build_reference(points, corner)) + "\n", encoding="utf-8")
        print(f"wrote {args.ref_out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
