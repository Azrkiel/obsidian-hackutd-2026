"""Monza corner positions from MultiViewer's circuit line + 20 OpenF1 qualifying laps.

Distances are fractions of the lap scaled to 5793 m, measured from the F1 timing line (lap start).
"""
import bisect
import json
import math
import statistics as st
import sys
from datetime import datetime
from pathlib import Path

W = Path(sys.argv[1])
L_M = 5793.0
mv = json.load(open(W / "mv_2025.json"))
X, Y = mv["x"], mv["y"]
P = list(zip(X, Y))
if P[0] != P[-1]:
    P.append(P[0])
seg = [math.dist(P[i], P[i + 1]) for i in range(len(P) - 1)]
cum = [0.0]
for d in seg:
    cum.append(cum[-1] + d)
LU = cum[-1]  # polyline length, MultiViewer units


def project(x, y):
    """Arc length (units) of the closest point on the polyline."""
    best = (1e18, 0.0)
    for i in range(len(P) - 1):
        (ax, ay), (bx, by) = P[i], P[i + 1]
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy or 1e-9
        t = max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / L2))
        px, py = ax + t * dx, ay + t * dy
        d2 = (x - px) ** 2 + (y - py) ** 2
        if d2 < best[0]:
            best = (d2, cum[i] + t * seg[i])
    return best[1], math.sqrt(best[0])


def ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()


corners_u = {c["number"]: project(c["trackPosition"]["x"], c["trackPosition"]["y"])[0] for c in mv["corners"]}
print(f"polyline {LU:.0f} units; MV corner 'length' field T1 {mv['corners'][0]['length']:.0f}")

laps = []
for f in sorted(W.glob("lap_*.json")):
    d = json.load(open(f))
    lap = d["lap"]
    loc = sorted((ts(r["date"]), r["x"], r["y"]) for r in d["loc"] if r.get("x") is not None)
    car = sorted((ts(r["date"]), r["speed"], r["throttle"], r["brake"], r.get("n_gear")) for r in d["car"])
    t0, t1 = ts(lap["date_start"]), ts(lap["date_start"]) + lap["lap_duration"]
    # unwrap arc along time
    us, last, off, offs = [], None, 0.0, []
    for t, x, y in loc:
        u, err = project(x, y)
        if last is not None and u - last < -LU / 2:
            off += LU
        last = u
        us.append(u + off)
        offs.append(err)
    lt = [r[0] for r in loc]

    def u_at(t):
        i = bisect.bisect_left(lt, t)
        i = min(max(i, 1), len(lt) - 1)
        a, b = lt[i - 1], lt[i]
        f_ = (t - a) / (b - a) if b != a else 0
        return us[i - 1] + f_ * (us[i] - us[i - 1])
    u0 = u_at(t0)
    rows = []
    for t, v, thr, br, g in car:
        if t0 <= t <= t1:
            s = (u_at(t) - u0) / LU * L_M
            rows.append((s % L_M if s >= 0 else s + L_M, v, thr, br, g, t - t0))
    rows.sort(key=lambda r: r[5])
    # speed-integrated distance as a scale check
    dist = sum((rows[i + 1][5] - rows[i][5]) * (rows[i][1] + rows[i + 1][1]) / 2 / 3.6 for i in range(len(rows) - 1))
    laps.append({"name": f.stem, "rows": rows, "u0": u0 % LU, "lap": lap["lap_duration"], "dist": dist,
                 "err": st.median(offs)})

print("lap start on the polyline (m):", round(st.median(l["u0"] for l in laps) / LU * L_M, 1),
      "spread", round((max(l["u0"] for l in laps) - min(l["u0"] for l in laps)) / LU * L_M, 1))
print("speed-integrated lap distance (m): median", round(st.median(l["dist"] for l in laps)),
      "projection error median (units)", round(st.median(l["err"] for l in laps), 1))
u_line = st.median(l["u0"] for l in laps)
corner_s = {n: ((u - u_line) % LU) / LU * L_M for n, u in corners_u.items()}
print("MultiViewer corner markers, m from the timing line:", {n: round(s) for n, s in corner_s.items()})

# per-corner zones: look between (prev corner group last marker + 60) and this group's last marker + 150
GROUPS = [("t1", "Rettifilo", [1, 2]), ("roggia", "Roggia", [4, 5]), ("lesmo1", "Lesmo 1", [6]),
          ("lesmo2", "Lesmo 2", [7]), ("ascari", "Ascari", [8, 9, 10]), ("parabolica", "Parabolica", [11])]
out = {}
for cid, name, nums in GROUPS:
    a0 = min(corner_s[n] for n in nums)
    a1 = max(corner_s[n] for n in nums)
    on, mins, minv, pick, fullt, vmax_before = [], [], [], [], [], []
    for l in laps:
        r = l["rows"]
        win = [x for x in r if a0 - 450 <= x[0] <= a1 + 250]
        if not win:
            continue
        # slowest point near the apexes
        near = [x for x in win if a0 - 60 <= x[0] <= a1 + 80]
        m = min(near, key=lambda x: x[1])
        mins.append(m[0]); minv.append(m[1])
        # brake onset: walk back from the slowest point to the last sample without brake
        i = win.index(m)
        j = i
        while j > 0 and (win[j][3] > 0 or win[j][2] < 90):
            j -= 1
        if j < len(win) - 1 and win[j + 1][3] > 0:
            on.append((win[j][0] + win[j + 1][0]) / 2)  # onset between the two samples
        elif j < len(win) - 1:
            # lift (no brake): first throttle drop
            on.append((win[j][0] + win[j + 1][0]) / 2)
        vmax_before.append(max(x[1] for x in win[:i + 1]))
        k = next((k for k in range(i, len(win)) if win[k][2] >= 20), None)
        if k is not None:
            pick.append(win[k][0])
        k2 = next((k for k in range(i, len(win)) if win[k][2] >= 98), None)
        if k2 is not None:
            fullt.append(win[k2][0])
    used_brake = sum(1 for l in laps for x in l["rows"] if a0 - 450 <= x[0] <= a1 and x[3] > 0)
    out[cid] = {"name": name, "markers_m": [round(corner_s[n], 1) for n in nums],
                "brake_onset_m": round(st.median(on), 1) if on else None,
                "brake_onset_iqr": round(st.quantiles(on, n=4)[2] - st.quantiles(on, n=4)[0], 1) if len(on) > 3 else None,
                "slowest_m": round(st.median(mins), 1), "slowest_kmh": round(st.median(minv), 1),
                "slowest_iqr": round(st.quantiles(mins, n=4)[2] - st.quantiles(mins, n=4)[0], 1),
                "throttle20_m": round(st.median(pick), 1) if pick else None,
                "full_throttle_m": round(st.median(fullt), 1) if fullt else None,
                "entry_kmh": round(st.median(vmax_before), 1), "brake_samples": used_brake, "n": len(mins)}
for cid, v in out.items():
    print(cid, json.dumps(v))
json.dump({"corner_markers_m": corner_s, "corners": out}, open(W / "monza_f1.json", "w"), indent=1)
