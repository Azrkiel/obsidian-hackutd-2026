"""Single-corner Monza T1 at its measured position, plus a simulator reference run for it.

    uv run python scripts/make_t1_fixture.py

Writes fixtures/corner_monza_t1_measured.json (gates from fixtures/track_monza.json "t1", measured
from F1 data, see scripts/monza_f1/README.md) and fixtures/reference_monza_t1.json (attempt + brake
trace of the simulator braking at the 100 m board). fixtures/corner_monza_t1.json keeps the old
placeholder gates because the unit tests are written against it.
"""
import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from coach.scorer import CornerScorer  # noqa: E402
from coach.telemetry import SimSource  # noqa: E402
from engine.config import load_corner  # noqa: E402

REF_BOARD_M = 100.0


def main() -> None:
    placeholder = json.loads((ROOT / "fixtures" / "corner_monza_t1.json").read_text(encoding="utf-8"))
    track = json.loads((ROOT / "fixtures" / "track_monza.json").read_text(encoding="utf-8"))
    t1 = next(c for c in track["corners"] if c["id"] == "t1")
    corner = {k: v for k, v in placeholder.items() if k != "_note"}
    corner.update({
        "_note": "Monza T1 measured from F1 data (fixtures/track_monza.json t1); made by "
                 "scripts/make_t1_fixture.py. Check the boards in the game (press B).",
        "_reference": "reference_monza_t1.json",
        "track_length_m": track["length_m"],
        "start_gate_m": t1["start_gate_m"], "board_zero_m": t1["board_zero_m"],
        "apex_window_m": t1["apex_window_m"], "exit_gate_m": t1["exit_gate_m"],
    })
    out = ROOT / "fixtures" / "corner_monza_t1_measured.json"
    out.write_text(json.dumps(corner, indent=2) + "\n", encoding="utf-8")

    cfg = load_corner(out)
    runs = []
    sc = CornerScorer(cfg, lambda a, tr: runs.append((a, tr)))

    async def drive():
        async for s in SimSource(cfg, realtime=False, brake_board_m=REF_BOARD_M, release_s=0.54).samples():
            sc.add(s)
            if runs:
                return
    asyncio.run(drive())
    attempt, trace = runs[0]
    assert attempt.valid, attempt.invalid_reason
    a = {k: v for k, v in vars(attempt).items() if v is not None}
    a["attempt_id"] = "ref"
    (ROOT / "fixtures" / "reference_monza_t1.json").write_text(
        json.dumps({"_note": f"simulator braking at the {REF_BOARD_M:g} m board on the measured T1",
                    "attempt": a, "trace": trace}) + "\n", encoding="utf-8")
    print(f"wrote {out.name}: gates {cfg.start_gate_m}-{cfg.exit_gate_m} m; reference brake "
          f"{attempt.brake_onset_m:.1f} m, section {attempt.section_s:.2f} s, {len(trace)} trace rows")


if __name__ == "__main__":
    main()
