"""Build the retry coach's track model (fixtures/tracks/monza.json) from the lap coach's track config.

Corner ids, names and gates come from fixtures/track_monza.json (F1-measured positions, 787B boards),
so both coaches agree on where every corner is. The AI speed / pedal profile is the lap coach's
787B simulator lap (TrackSimSource with its default boards), so the retry simulator (LapSim) and the
reference brake points match it. Curva Grande (flat out, major errors only) is added from the F1
corner marker for turn 3, which the lap coach doesn't score.

    python scripts/track_model.py                 # writes fixtures/tracks/monza.json
When the real fast_lane.ai is in, scripts/ac_track_extract.py --model-out replaces the profile.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

from ac_track_extract import track_json  # noqa: E402

from coach.telemetry import TrackSimSource  # noqa: E402
from engine.config import load_track  # noqa: E402

PROFILE_STEP_M = 10.0
BRAKE_ON = 0.1
# Curva Grande: F1 turn-3 marker at 1459 m; flat out, so no brake point (turn-in anchors the retry)
CURVA_GRANDE = {"id": "curva_grande", "name": "Curva Grande", "kind": "flat", "entry_m": 1200.0,
                "turn_in_m": 1340.0, "apex_m": [1459.0], "apex_window_m": [1440.0, 1480.0],
                "exit_m": 1640.0}


def _r(v: float) -> float:
    return round(float(v), 1)


def build(config: Path) -> dict:
    track = load_track(config)
    raw = {c["id"]: c for c in json.loads(config.read_text(encoding="utf-8"))["corners"]}
    sim = TrackSimSource(track, realtime=False)
    L = track.length_m

    def at(pos: float) -> tuple[float, float, float]:
        return sim._lookup(pos % L)

    def seg_s(a: float, b: float, step: float = 1.0) -> float:
        t, p = 0.0, a
        while p < b:
            t += step / max(at(p)[0] / 3.6, 1.0)
            p += step
        return t

    corners = []
    for c in track.corners:
        a0, a1 = c.apex_window_m
        markers = [m for m in raw[c.id].get("_f1", {}).get("markers_m", []) if a0 <= m <= a1]
        apex = markers or [round((a0 + a1) / 2, 1)]
        p = c.start_gate_m
        while p < a1 and at(p)[2] <= BRAKE_ON:
            p += 1.0
        brake = p if p < a1 else None
        corners.append({"id": c.id, "name": c.name, "kind": "brake" if brake is not None else "flat",
                        "entry_m": c.start_gate_m, "brake_m": None if brake is None else _r(brake),
                        "turn_in_m": _r(c.gate("turn_in_m")), "apex_m": apex,
                        "apex_window_m": [a0, a1], "exit_m": c.exit_gate_m,
                        "board_zero_m": c.board_zero_m})
    corners.append({**CURVA_GRANDE, "brake_m": None, "board_zero_m": CURVA_GRANDE["turn_in_m"]})
    corners.sort(key=lambda c: c["entry_m"])
    for c in corners:
        w0, w1 = c["apex_window_m"]
        mins = min((at(x)[0], x) for x in range(int(w0), int(w1) + 1))
        pick = next((x for x in range(int(mins[1]), int(c["exit_m"])) if at(x)[1] > 0.2), c["exit_m"])
        c["ai"] = {"entry_kmh": _r(at(c["entry_m"])[0]), "min_kmh": _r(mins[0]), "min_pos_m": _r(mins[1]),
                   "exit_kmh": _r(at(c["exit_m"])[0]), "throttle_pickup_m": _r(pick),
                   "segment_s": round(seg_s(c["entry_m"], c["exit_m"]), 3)}
    profile = []
    for i in range(int(L // PROFILE_STEP_M)):
        v, g, b = at(i * PROFILE_STEP_M)
        profile.append([_r(i * PROFILE_STEP_M), _r(v), round(g, 2), round(b, 2)])
    return {"_source": f"scripts/track_model.py from {config.name} (F1-measured corners, 787B sim lap)",
            "name": track.name, "length_m": _r(L), "config": config.name, "corners": corners,
            "profile": profile}


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--config", default=str(ROOT / "fixtures" / "track_monza.json"))
    ap.add_argument("--out", default=str(ROOT / "fixtures" / "tracks" / "monza.json"))
    a = ap.parse_args()
    model = build(Path(a.config))
    Path(a.out).write_text(track_json(model), encoding="utf-8")
    for c in model["corners"]:
        print(f"{c['id']:13} {c['kind']:5} entry {c['entry_m']:7.1f} brake {str(c['brake_m']):>7} "
              f"apex {c['apex_m']} exit {c['exit_m']:7.1f}  min {c['ai']['min_kmh']:5.1f} km/h "
              f"{c['ai']['segment_s']:.2f} s")
    print(f"wrote {a.out}")
