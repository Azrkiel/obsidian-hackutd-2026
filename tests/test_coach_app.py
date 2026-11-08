import json

import pytest

from coach.app import CoachApp
from coach.telemetry import SimSource


def make_app(corner, ref, tmp_path, **kw):
    return CoachApp(corner, ref, SimSource(corner, realtime=False), [], reset_mode="sim",
                    data_dir=tmp_path / "data", trace_dir=tmp_path / "traces", sound=False,
                    countdown=0, persist_checkpoint=False, **kw)


async def drive_to_done(app, max_accepts=6):
    accepts = 0
    while True:
        await app.wait_for(lambda: app.coach.state in ("OFFERED", "DONE"), 20)
        if app.coach.state == "DONE":
            return accepts
        accepts += 1
        assert accepts <= max_accepts
        did = app.coach.offer.decision_id
        await app.handle_command({"type": "accept", "decision_id": did})
        # the offline sim can go OFFERED -> ... -> OFFERED between polls: wait for a new offer
        await app.wait_for(lambda: app.coach.state != "OFFERED" or app.coach.offer.decision_id != did, 20)


async def test_full_sim_loop(corner, ref, tmp_path):
    app = make_app(corner, ref, tmp_path)
    await app.start()
    try:
        accepts = await drive_to_done(app)
        await app.wait_for(lambda: not app._tasks or app.coach.state == "DONE", 5)
    finally:
        await app.stop()
    ev = [e for e in app.events if e["type"] in ("run", "decision", "reset_request", "reset_confirmed")]
    kinds = [(e["type"], e.get("role") or e.get("action")) for e in ev]
    assert kinds[0] == ("run", "baseline") and kinds[1] == ("decision", "offer_drill")
    assert kinds[2:4] == [("reset_request", None), ("reset_confirmed", None)]
    assert kinds[4] == ("run", "retry")
    assert kinds[-1] == ("decision", "end_drill")
    retries = [e for e in ev if e["type"] == "run" and e["role"] == "retry"]
    assert 1 <= len(retries) <= 4 and accepts == len(retries)
    assert app.coach.last_decision.end_reason == "drill_complete"
    # baseline was a late brake (86 m board), retries moved toward the 100 m board
    base = app.baseline_run["attempt"]
    assert base["brake_board_m"] == pytest.approx(86, abs=1.5)
    assert retries[-1]["attempt"]["brake_board_m"] == pytest.approx(100, abs=5.5)
    assert all(r["trace"] for r in retries)
    lines = (app.trace.path).read_text().splitlines()
    assert len(lines) == len([e for e in ev if e["type"] == "decision"])
    assert json.loads(lines[0])["decision"]["drill_id"] == "brake_point"
    assert app.activity and app.snapshot()["state"] == "DONE"


async def test_next_lap_after_done_is_new_baseline(corner, ref, tmp_path):
    app = make_app(corner, ref, tmp_path)
    await app.start()
    try:
        await drive_to_done(app)
        assert app.coach.state == "DONE"
        n_base = sum(1 for e in app.events if e["type"] == "run" and e["role"] == "baseline")
        n_dec = sum(1 for e in app.events if e["type"] == "decision")
        # the driver just drives another lap (no dashboard command): it must be a fresh baseline
        app.sim.teleport_to(app.sim.start_pos_m, app.sim.v0_kmh)
        await app.wait_for(lambda: sum(1 for e in app.events if e["type"] == "decision") > n_dec, 20)
    finally:
        await app.stop()
    runs = [e for e in app.events if e["type"] == "run"]
    assert sum(1 for e in runs if e["role"] == "baseline") == n_base + 1
    assert runs[-1]["role"] == "baseline"
    assert [e for e in app.events if e["type"] == "decision"][-1]["attempt_id"] == runs[-1]["attempt"]["attempt_id"]


async def test_commands_and_stale_ignored(corner, ref, tmp_path):
    app = make_app(corner, ref, tmp_path)
    await app.handle_command({"type": "accept", "decision_id": "d-nope"})
    await app.handle_command({"type": "bogus"})
    await app.handle_command("junk")
    await app.handle_command({"type": "retry_reset"})
    notes = [e["message"] for e in app.events if e["type"] == "status"]
    assert len(notes) == 4 and all(n.startswith("ignored") for n in notes)
    await app.handle_command({"type": "toggle_cue_next"})
    assert app.cue_next_off is True
    await app.handle_command({"type": "set_reference"})  # no valid run yet
    assert app.events[-1]["message"].startswith("ignored")


async def test_set_reference_and_new_session(corner, ref, tmp_path):
    app = make_app(corner, ref, tmp_path)
    await app.start()
    try:
        await app.wait_for(lambda: app.coach.state == "OFFERED", 20)
        await app.handle_command({"type": "set_reference"})
        assert app.reference.attempt_id == "a-0001" and app.coach.reference is app.reference
        assert json.loads((tmp_path / "data" / "reference.json").read_text())["attempt_id"] == "a-0001"
        assert (tmp_path / "data" / "reference_trace.json").exists()
        await app.handle_command({"type": "new_session"})
        assert app.coach.state == "IDLE" and app.snapshot()["baseline"] is None
    finally:
        await app.stop()


async def test_free_retry_from_idle_resets(corner, ref, tmp_path):
    app = make_app(corner, ref, tmp_path)
    await app.start()
    try:
        await app.wait_for(lambda: app.coach.state == "OFFERED", 20)
        await app.handle_command({"type": "new_session"})
        await app.handle_command({"type": "retry"})
        await app.wait_for(lambda: any(e["type"] == "reset_confirmed" for e in app.events), 20)
        await app.wait_for(lambda: app.coach.state == "OFFERED", 20)  # new baseline scored
    finally:
        await app.stop()


async def test_health_shows_rules_and_no_data(corner, ref, tmp_path):
    app = make_app(corner, ref, tmp_path)
    h = app.health()
    assert h["ai"]["label"] == "Rules (AI unavailable)" and h["telemetry"]["state"] == "no data"
    assert h["providers"] == {}


class Boom:
    finite = False

    def __init__(self):
        self.calls = 0

    async def samples(self):
        self.calls += 1
        raise RuntimeError("Assetto Corsa is not running")
        yield


async def test_telemetry_failure_keeps_running_and_retries(corner, ref, tmp_path):
    src = Boom()
    app = CoachApp(corner, ref, src, [], reset_mode="manual", data_dir=tmp_path, trace_dir=tmp_path,
                   sound=False, persist_checkpoint=False, reconnect_s=0.01)
    await app.start()
    try:
        await app.wait_for(lambda: src.calls >= 3, 5)
        h = app.health()["telemetry"]
        assert h["state"] == "no data" and "not running" in h["error"]
    finally:
        await app.stop()
