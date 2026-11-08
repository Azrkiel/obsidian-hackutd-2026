"""Track map for the dashboard: MultiViewer's Monza circuit line, indexed by lap distance.

    python scripts/monza_f1/fetch.py              # in a scratch folder: writes mv_2025.json
    python scripts/monza_f1/build_map.py W/mv_2025.json fixtures/monza_f1_corners.json fixtures/track_monza_map.json

Each point is [lap_m, x, y]: lap_m from the timing line (0..5793, F1 corner 1 marker = its measured
distance), x/y rotated like the TV graphic (MultiViewer `rotation`) and scaled into a 1000-wide box,
y down. The dashboard puts the car at lap_m = pos_m, so it works with the simulator and with AC.
"""
import json
import math
import sys

L_M = 5793.0
STEP_M = 10.0


def main(mv_path, corners_path, out_path):
    mv = json.load(open(mv_path))
    markers = json.load(open(corners_path))["corner_markers_m"]
    P = list(zip(mv["x"], mv["y"]))
    if P[0] != P[-1]:
        P.append(P[0])
    seg = [math.dist(P[i], P[i + 1]) for i in range(len(P) - 1)]
    cum = [0.0]
    for d in seg:
        cum.append(cum[-1] + d)
    LU = cum[-1]

    def project(x, y):
        best = (1e18, 0.0)
        for i in range(len(P) - 1):
            (ax, ay), (bx, by) = P[i], P[i + 1]
            dx, dy = bx - ax, by - ay
            t = max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy or 1e-9)))
            d2 = (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2
            if d2 < best[0]:
                best = (d2, cum[i] + t * seg[i])
        return best[1]

    def at(u):
        u %= LU
        i = max(0, min(len(seg) - 1, next(k for k in range(len(seg)) if cum[k + 1] >= u)))
        t = (u - cum[i]) / (seg[i] or 1e-9)
        return P[i][0] + t * (P[i + 1][0] - P[i][0]), P[i][1] + t * (P[i + 1][1] - P[i][1])

    by_num = {c["number"]: c["trackPosition"] for c in mv["corners"]}
    u1 = project(by_num[1]["x"], by_num[1]["y"])
    u0 = u1 - markers["1"] / L_M * LU  # arc position of the timing line
    check = {n: round(((project(by_num[int(n)]["x"], by_num[int(n)]["y"]) - u0) % LU) / LU * L_M - m)
             for n, m in markers.items()}
    print("corner marker error, m:", check)
    rot = math.radians(mv.get("rotation", 0))
    pts = []
    steps = [k * STEP_M for k in range(int(L_M / STEP_M) + 1)]
    if steps[-1] < L_M:
        steps.append(L_M)  # close the lap exactly at the line
    for lap_m in steps:
        x, y = at(u0 + lap_m / L_M * LU)
        pts.append((lap_m, x * math.cos(rot) - y * math.sin(rot), -(x * math.sin(rot) + y * math.cos(rot))))
    xs, ys = [p[1] for p in pts], [p[2] for p in pts]
    s = 1000.0 / max(max(xs) - min(xs), max(ys) - min(ys))
    out = {"name": mv.get("circuitName", ""), "length_m": L_M,
           "source": f"MultiViewer circuit line {mv.get('year')}, aligned to F1 corner markers (scripts/monza_f1)",
           "width": round((max(xs) - min(xs)) * s), "height": round((max(ys) - min(ys)) * s),
           "points": [[p[0], round((p[1] - min(xs)) * s, 1), round((p[2] - min(ys)) * s, 1)] for p in pts]}
    json.dump(out, open(out_path, "w"), separators=(",", ":"))
    print(f"wrote {out_path}: {len(pts)} points, {out['width']}x{out['height']}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
