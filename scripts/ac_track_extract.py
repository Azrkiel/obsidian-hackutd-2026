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


# --- every corner on the lap (docs/ROLLING_CHECKPOINTS.md, D) --------------------

TRACK_CORNER_RADIUS_M = 450.0           # tighter than this is part of a corner (Curva Grande ~ 380 m)
MERGE_GAP_M = 100.0                     # turns closer than this are one corner (a chicane)
ENTRY_BEFORE_M = 150.0                  # entry gate this far before the brake point (or turn-in)
EXIT_FULL_GAS = 0.95                    # exit once the AI is back to (nearly) full throttle ...
EXIT_MAX_AFTER_M = 150.0                # ... but no more than this after the last turn
EXIT_PAD_M = 30.0
APEX_PAD_M = 10.0
PROFILE_STEP_M = 10.0


def _segments(points: list[LanePoint]) -> list[tuple[int, int]]:
    segs, start = [], None
    for i, p in enumerate(points):
        tight = 0 < abs(p.radius) < TRACK_CORNER_RADIUS_M
        if tight and start is None:
            start = i
        elif not tight and start is not None:
            segs.append((start, i - 1))
            start = None
    if start is not None:
        segs.append((start, len(points) - 1))
    return segs


def _section_s(points: list[LanePoint], a: float, b: float) -> float:
    sel = [p for p in points if a <= p.dist_m <= b]
    t = 0.0
    for p0, p1 in zip(sel, sel[1:]):
        v0 = max(p0.speed_kmh / SPEED_TO_KMH, MIN_SPEED_MS)
        v1 = max(p1.speed_kmh / SPEED_TO_KMH, MIN_SPEED_MS)
        t += (p1.dist_m - p0.dist_m) * 0.5 * (1 / v0 + 1 / v1)
    return t


def find_corners(points: list[LanePoint], names: list[str] | None = None) -> list[dict]:
    """Split the lap into corners from the AI line: turn = radius under TRACK_CORNER_RADIUS_M,
    turns within MERGE_GAP_M are one corner. A corner with no AI braking before it is "flat"."""
    groups: list[list[tuple[int, int]]] = []
    for seg in _segments(points):
        if groups and points[seg[0]].dist_m - points[groups[-1][-1][1]].dist_m < MERGE_GAP_M:
            groups[-1].append(seg)
        else:
            groups.append([seg])
    if names and len(names) != len(groups):
        raise AiFormatError(f"{len(names)} names for {len(groups)} corners found")
    corners, prev_exit = [], 0.0
    for n, group in enumerate(groups):
        first, last = group[0][0], group[-1][1]
        # braking: the AI brake run nearest before turn-in (it may carry on past it), not reaching
        # back into the previous corner
        lo = max(points[first].dist_m - BRAKE_SEARCH_M, prev_exit)
        start = next((i for i in range(first, len(points)) if points[i].dist_m >= points[first].dist_m + 20.0), first)
        run_end = next((i for i in range(start, -1, -1)
                        if points[i].dist_m >= lo and points[i].brake > BRAKE_THRESHOLD), None)
        if run_end is not None and points[run_end].dist_m < lo:
            run_end = None
        brake_m = None
        if run_end is not None:
            k = run_end
            while k > 0 and points[k - 1].brake > BRAKE_THRESHOLD and points[k - 1].dist_m >= lo:
                k -= 1
            brake_m = points[k].dist_m
        apexes = []
        for a, b in group:
            mid = (a + b) / 2
            if brake_m is not None:   # slowest point of each turn
                key = lambda k: (round(points[k].speed_kmh, 1), _rad(points[k]), abs(k - mid))  # noqa: E731
            else:                     # flat out: speed says nothing, take the tightest point
                key = lambda k: (_rad(points[k]), abs(k - mid))  # noqa: E731
            apexes.append(min(range(a, b + 1), key=key))
        k, end_m = last, points[last].dist_m
        while k < len(points) - 1 and points[k].gas < EXIT_FULL_GAS and points[k].dist_m < end_m + EXIT_MAX_AFTER_M:
            k += 1
        exit_m = points[k].dist_m + EXIT_PAD_M
        entry_m = max((brake_m if brake_m is not None else points[first].dist_m) - ENTRY_BEFORE_M,
                      prev_exit + 2.0)
        prev_exit = exit_m
        window = [points[apexes[0]].dist_m - APEX_PAD_M, points[apexes[-1]].dist_m + APEX_PAD_M]
        in_win = [p for p in points if window[0] <= p.dist_m <= window[1]]
        slowest = min(in_win, key=lambda p: p.speed_kmh)
        pickup = next((p.dist_m for p in points if slowest.dist_m < p.dist_m <= exit_m
                       and p.gas > GAS_PICKUP_THRESHOLD), exit_m)
        corners.append({
            "id": f"c{n + 1}", "name": names[n] if names else f"T{n + 1}",
            "kind": "brake" if brake_m is not None else "flat",
            "entry_m": _r(entry_m), "brake_m": None if brake_m is None else _r(brake_m),
            "turn_in_m": _r(points[first].dist_m), "apex_m": [_r(points[i].dist_m) for i in apexes],
            "apex_window_m": [_r(window[0]), _r(window[1])], "exit_m": _r(exit_m),
            "ai": {"entry_kmh": _r(_interp(points, entry_m, "speed_kmh")), "min_kmh": _r(slowest.speed_kmh),
                   "min_pos_m": _r(slowest.dist_m), "exit_kmh": _r(_interp(points, exit_m, "speed_kmh")),
                   "throttle_pickup_m": _r(pickup), "segment_s": round(_section_s(points, entry_m, exit_m), 3)},
        })
    return corners


def build_track(points: list[LanePoint], name: str, names: list[str] | None = None,
                source: str = "fast_lane.ai v7") -> dict:
    L = lap_length(points)
    n = int(L // PROFILE_STEP_M)
    profile = [[_r(i * PROFILE_STEP_M), _r(_interp(points, i * PROFILE_STEP_M, "speed_kmh")),
                round(_interp(points, i * PROFILE_STEP_M, "gas"), 2),
                round(_interp(points, i * PROFILE_STEP_M, "brake"), 2)] for i in range(n)]
    return {"_source": source, "name": name, "length_m": _r(L), "corners": find_corners(points, names),
            "profile": profile}


def track_json(track: dict) -> str:
    """Readable: one corner per block, one profile row per line."""
    head = {k: v for k, v in track.items() if k not in ("corners", "profile")}
    lines = ["{"] + [f"  {json.dumps(k)}: {json.dumps(v)}," for k, v in head.items()]
    lines.append('  "corners": [')
    lines.append(",\n".join("    " + json.dumps(c) for c in track["corners"]))
    lines.append("  ],")
    lines.append('  "profile": [')
    lines.append(",\n".join("    " + json.dumps(r) for r in track["profile"]))
    lines.append("  ]")
    lines.append("}")
    return "\n".join(lines) + "\n"


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
    ap.add_argument("--track-out", help="write the whole-lap track model (every corner) here")
    ap.add_argument("--track-name", default="Monza")
    ap.add_argument("--names", help="corner names in lap order, comma separated")
    args = ap.parse_args(argv)

    if args.track_out:
        try:
            points = parse_file(resolve_ai_path(Path(args.track)))
            names = [n.strip() for n in args.names.split(",")] if args.names else None
            track = build_track(points, args.track_name, names)
        except (OSError, AiFormatError) as e:
            print(f"error: {e}", file=sys.stderr)
            return 1
        Path(args.track_out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.track_out).write_text(track_json(track), encoding="utf-8")
        for c in track["corners"]:
            print(f"{c['id']:4} {c['name']:14} {c['kind']:5} entry {c['entry_m']:7.1f}  brake "
                  f"{c['brake_m'] if c['brake_m'] is not None else '-':>7}  apex {c['apex_m']}  exit "
                  f"{c['exit_m']:7.1f}  AI min {c['ai']['min_kmh']:5.1f} km/h  {c['ai']['segment_s']:.2f} s")
        print(f"wrote {args.track_out} ({len(track['corners'])} corners, lap {track['length_m']} m)")
        return 0

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
