"""The existing drill loop, pointed at any corner of the track (whole-lap mode, stage D)."""
from pathlib import Path

import pytest

from coach.app import CoachApp
from coach.lap_sim import LapSim
from coach.reference import References
from coach.track import Track
from engine.config import load_corner

ROOT = Path(__file__).resolve().parents[1]
TRACK = Track.load()
BASE = load_corner(ROOT / "fixtures" / "corner_monza_t1.json")


def make(tmp_path, errors, start_m):
    refs = References(TRACK, tmp_path / "pb.json")
    sim = LapSim(TRACK, errors=errors, start_m=start_m)
    app = CoachApp(BASE, refs.get("c1").as_attempt(), sim, [], reset_mode="sim",
                   data_dir=tmp_path / "data", trace_dir=tmp_path / "traces", sound=False, countdown=0,
                   persist_checkpoint=False, track_model=TRACK, references=refs)
    return app, sim


async def test_drill_loop_runs_at_lesmo(tmp_path):
    les = TRACK.get("c4")
    app, sim = make(tmp_path, {"c4": ["early_brake", None, None, None, None]}, les.entry_m - 400)
    assert app.select_corner("c4")
    assert app.corner.name == "Lesmo 1" and app.scorer.corner is app.corner
    assert app.coach.reference.attempt_id == "ref-ai-c4"
    anchor = TRACK.anchor_m(les, 4.0)
    assert app.reset.checkpoint["pos_m"] == pytest.approx(anchor)
    await app.start()
    try:
        await app.wait_for(lambda: app.coach.state in ("OFFERED", "DONE"), 30)
        assert app.coach.state == "OFFERED", app.coach.last_decision
        base = app.baseline_run["attempt"]
        assert base["valid"] and base["brake_onset_m"] < les.brake_m - 40   # braked early
        did = app.coach.offer.decision_id
        await app.handle_command({"type": "accept", "decision_id": did})
        await app.wait_for(lambda: app.retry_run is not None, 30)
    finally:
        await app.stop()
    kinds = [e["type"] for e in app.events if e["type"] in ("corner", "run", "decision", "reset_request",
                                                             "reset_confirmed")]
    assert kinds[:6] == ["corner", "run", "decision", "reset_request", "reset_confirmed", "run"]
    retry = app.retry_run["attempt"]
    assert retry["brake_onset_m"] == pytest.approx(les.brake_m, abs=12)       # the clean retry
    les_log = [e for e in sim.log if e[0] == "c4"]
    assert les_log[0] == ("c4", 0, "early_brake") and les_log[-1][2] is None


async def test_corner_change_waits_for_the_drill(tmp_path):
    app, _ = make(tmp_path, {}, 0)
    assert app.select_corner("c1")
    app.coach.state = "RETRY"
    assert not app.select_corner("c4") and app.corner.name == "Rettifilo"
    app.coach.state = "IDLE"
    await app.handle_command({"type": "select_corner", "corner_id": "c4"})
    assert app.corner.name == "Lesmo 1"
    assert not app.select_corner("nope")


def test_flat_corner_has_no_drills(tmp_path):
    app, _ = make(tmp_path, {}, 0)
    assert app.select_corner("c2") and app.corner.allowed["drills"] == []
