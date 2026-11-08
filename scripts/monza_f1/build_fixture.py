import json, sys
from pathlib import Path
W = Path(sys.argv[1]); out = Path(sys.argv[2])
m = json.load(open(W / "monza_f1.json"))["corners"]
L = 5793.0
r = lambda x: round(x)
corners, prev_exit = [], None
for cid in ["t1", "roggia", "lesmo1", "lesmo2", "ascari", "parabolica"]:
    c = m[cid]
    mk, slow = c["markers_m"], c["slowest_m"]
    a0 = min(mk[0], slow) - 10
    a1 = max(mk[-1], slow) + 8 if len(mk) > 1 else max(mk[0], slow) + 12
    if cid == "ascari":
        a1 = mk[-1] + 5
    board0 = min(mk[0], slow) - 15
    exit_ = max(c["full_throttle_m"] + 30, a1 + 30)
    start = c["brake_onset_m"] - 250
    if prev_exit is not None:
        start = max(start, prev_exit + 80)
    reminder = (start - 200) if prev_exit is None else max(prev_exit + 15, start - 200)
    if cid == "t1":
        reminder = 300.0
    corners.append({"id": cid, "name": c["name"], "start_gate_m": r(start), "board_zero_m": r(board0),
                    "apex_window_m": [r(a0), r(a1)], "exit_gate_m": r(exit_), "reminder_m": r(reminder),
                    "_f1": {"brake_onset_m": c["brake_onset_m"], "board": round(board0 - c["brake_onset_m"]),
                            "slowest_m": slow, "slowest_kmh": c["slowest_kmh"], "full_throttle_m": c["full_throttle_m"],
                            "markers_m": mk}})
    prev_exit = exit_
talk = []
for a, b in zip(corners, corners[1:] + corners[:1]):
    lo, hi = a["exit_gate_m"] + 10, b["start_gate_m"] - 10
    talk.append([lo, hi])
doc = {
  "_note": ("Corner positions measured from real F1 data (W3, 2026-11-08): MultiViewer's official Monza circuit line and corner markers, "
            "plus 20 fastest 2024/2025 qualifying laps from OpenF1 (speed, brake, throttle, x/y). Distances are fractions of the lap x 5793 m "
            "from the F1 timing line, assumed to be AC's lap line. Board zero = 15 m before the first apex (F1 then brakes at the T1 100 board). "
            "Start gates sit 250 m before F1's brake onset so the slower 787B's braking is inside them. _f1 = what F1 did there. "
            "Still to check in the game: lap line, boards (press B at each board), 787B brake points. See scripts/monza_f1_corners.py."),
  "name": "Monza", "length_m": L, "reference": "track_monza_reference.json",
  "talk_zones": talk,
  "defaults": {
    "wheelbase_m": 2.62, "comparable_entry_kmh": 8,
    "tolerance": {"brake_onset_m": 5, "throttle_pickup_m": 5, "section_s": 0.1, "release_s": 0.15},
    "allowed": {"drills": ["brake_point", "brake_release", "throttle_pickup"],
                "brake_point": {"marker_m": [30, 250], "peak_brake": [0.6, 1.0]},
                "brake_release": {"release_s": [0.2, 1.5]},
                "throttle_pickup": {"marker_m": [0, 80]}}},
  "corners": corners}
out.write_text(json.dumps(doc, indent=1) + "\n", encoding="utf-8")
for c in corners: print(c["id"], c["start_gate_m"], c["board_zero_m"], c["apex_window_m"], c["exit_gate_m"], c["reminder_m"], "F1 board", c["_f1"]["board"])
print("talk", talk)
