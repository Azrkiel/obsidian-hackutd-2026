"""A synthetic Monza AI line, written as a real fast_lane.ai v7 file, until the game PC's copy is in.

NOT the real track: corner positions and radii are approximations of Monza's layout on a 5793 m lap,
with Rettifilo kept where the placeholder T1 config has it (~450 m). Speeds come from a simple model
(lateral grip limit per radius, constant braking and acceleration). Good enough to build and test the
whole-lap flow; the real file replaces it (scripts/ac_track_extract.py --track-out).

    python scripts/synth_track.py --ai /tmp/fast_lane.ai      # write the binary
"""
from __future__ import annotations

import argparse
import math
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ac_track_extract import EXTRA, HEADER, POINT, SPEED_TO_KMH, LanePoint  # noqa: E402

LAP_M = 5793.0
STEP_M = 2.0
VMAX_KMH = 320.0
LAT_MS2 = 24.0      # lateral grip
BRAKE_MS2 = 16.0
ACCEL_MS2 = 5.0

# (start_m, end_m, radius_m) arcs; anything else is straight
MONZA_ARCS = [
    (440, 470, 25), (485, 515, 30),                    # Rettifilo (T1-2)
    (800, 1250, 380),                                  # Curva Grande (flat)
    (1605, 1635, 30), (1650, 1680, 35),                # Roggia (T4-5)
    (1900, 2010, 110),                                 # Lesmo 1
    (2210, 2300, 80),                                  # Lesmo 2
    (3300, 3360, 120), (3380, 3420, 90), (3450, 3500, 140),   # Ascari (T8-10)
    (4700, 4850, 90), (4850, 4950, 150), (4950, 5050, 300),   # Parabolica, opening up
]
MONZA_NAMES = ["Rettifilo", "Curva Grande", "Roggia", "Lesmo 1", "Lesmo 2", "Ascari", "Parabolica"]


def radius_at(d: float) -> float:
    for a, b, r in MONZA_ARCS:
        if a <= d < b:
            return float(r)
    return 0.0  # straight (the AI file's convention for "no radius")


def monza_points() -> list[LanePoint]:
    n = int(LAP_M / STEP_M)
    dist = [i * STEP_M for i in range(n)]
    rad = [radius_at(d) for d in dist]
    vmax = VMAX_KMH / SPEED_TO_KMH
    lim = [min(vmax, math.sqrt(LAT_MS2 * r)) if r else vmax for r in rad]
    v = lim[:]
    for _ in range(2):  # two laps of passes so the lap wraps cleanly
        for i in range(1, 2 * n):                      # acceleration limit, forward
            a, b = (i - 1) % n, i % n
            v[b] = min(v[b], math.sqrt(v[a] ** 2 + 2 * ACCEL_MS2 * STEP_M))
        for i in range(2 * n - 2, -1, -1):             # braking limit, backward
            a, b = i % n, (i + 1) % n
            v[a] = min(v[a], math.sqrt(v[b] ** 2 + 2 * BRAKE_MS2 * STEP_M))
    pts = []
    for i, d in enumerate(dist):
        nxt = v[(i + 1) % n]
        dv = (nxt ** 2 - v[i] ** 2) / (2 * STEP_M)     # longitudinal acceleration
        if dv < -0.5:
            gas, brake = 0.0, min(1.0, -dv / BRAKE_MS2)
        elif dv > 0.5:
            gas, brake = 1.0, 0.0
        else:
            gas, brake = (1.0 if v[i] >= vmax - 0.1 else 0.55), 0.0
        ang = 2 * math.pi * d / LAP_M                  # placed on a circle: only the closing gap matters
        R = LAP_M / (2 * math.pi)
        pts.append(LanePoint(i, i, d, R * math.cos(ang), 0.0, R * math.sin(ang), v[i] * SPEED_TO_KMH,
                             gas, brake, rad[i], 6.0, 6.0, 0.0, 0.0))
    return pts


def ai_bytes(points: list[LanePoint]) -> bytes:
    out = [HEADER.pack(7, len(points), 0, 0)]
    out += [POINT.pack(p.x, p.y, p.z, p.dist_m, p.id) for p in points]
    out.append(struct.pack("<i", len(points)))
    for p in points:
        out.append(EXTRA.pack(p.speed_kmh / SPEED_TO_KMH, p.gas, p.brake, 0.0, p.radius, p.side_left,
                              p.side_right, p.camber, 0.0, 0.0, 1.0, 0.0, p.dist_m, 1.0, 0.0, 0.0,
                              0.0, p.grade))
    out.append(struct.pack("<i", 0))  # no spatial grid
    return b"".join(out)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--ai", required=True, help="write the synthetic fast_lane.ai here")
    a = ap.parse_args()
    Path(a.ai).write_bytes(ai_bytes(monza_points()))
    print(f"wrote {a.ai}")
