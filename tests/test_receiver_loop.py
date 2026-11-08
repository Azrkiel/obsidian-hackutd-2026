"""Receiver loop: inputs feed the evidence, an accepted drill rewinds on its own, resume ends it."""
import json

from coach.app import CoachApp
from coach.inputs import InputHub, NullPad
from coach.telemetry import SimSource


def make_app(corner, ref, tmp_path, **kw):
    return CoachApp(corner, ref, SimSource(corner, realtime=False), [], reset_mode="sim",
                    data_dir=tmp_path / "data", trace_dir=tmp_path / "traces", sound=False,
                    countdown=0, persist_checkpoint=False, **kw)


def kinds(app, *types):
    return [e for e in app.events if e["type"] in types]


async def test_auto_retry_loops_until_done_then_resumes(corner, ref, tmp_path):
    app = make_app(corner, ref, tmp_path, auto_retry=True)
    await app.start()
    try:
        await app.wait_for(lambda: app.coach.state == "OFFERED", 20)
        start_pos = app.latest.pos_m
        await app.handle_command({"type": "accept", "decision_id": app.coach.offer.decision_id})
        # one Accept: the drill loops on its own until it ends, then the car is put back
        await app.wait_for(lambda: kinds(app, "resumed"), 30)
    finally:
        await app.stop()
    retries = [e for e in kinds(app, "run") if e["role"] == "retry"]
    decisions = kinds(app, "decision")
    assert len(retries) >= 2, "expected the drill to loop more than once"
    assert decisions[-1]["action"] == "end_drill" and decisions[-1]["end_reason"] == "drill_complete"
    slots = [e["slot"] for e in kinds(app, "reset_request")]
    assert slots == ["checkpoint"] * len(retries) + ["resume"]
    (point,) = kinds(app, "resume_point")
    assert abs(point["pos_m"] - start_pos) < 60          # saved where the driver accepted the drill
    assert app.reset.resume_point is None and kinds(app, "resumed")
    assert app.coach.drill is None                        # back to free driving


async def test_resume_ends_a_drill_early(corner, ref, tmp_path):
    app = make_app(corner, ref, tmp_path)                 # no auto retry: waits on each offer
    await app.start()
    try:
        await app.wait_for(lambda: app.coach.state == "OFFERED", 20)
        await app.handle_command({"type": "accept", "decision_id": app.coach.offer.decision_id})
        await app.wait_for(lambda: app.coach.state == "OFFERED" and app.coach.drill.tries == 1, 20)
        assert app.health()["resume_available"]
        await app.handle_command({"type": "resume"})
        await app.wait_for(lambda: kinds(app, "resumed"), 20)
    finally:
        await app.stop()
    assert [e["slot"] for e in kinds(app, "reset_confirmed")] == ["checkpoint", "resume"]
    assert app.coach.offer is None and not app.health()["resume_available"]


async def test_resume_without_a_drill_is_ignored(corner, ref, tmp_path):
    app = make_app(corner, ref, tmp_path)
    await app.handle_command({"type": "resume"})
    assert app.events[-1]["message"] == "ignored: nothing to resume"


async def test_new_baseline_forgets_the_old_resume_point(corner, ref, tmp_path):
    app = make_app(corner, ref, tmp_path)
    app.reset.resume_point = {"pos_m": 1.0, "speed_kmh": 1.0}
    await app.start()
    try:
        await app.wait_for(lambda: app.baseline_run is not None, 20)
    finally:
        await app.stop()
    assert app.reset.resume_point is None


async def test_input_summary_reaches_the_coach(corner, ref, tmp_path):
    hub = InputHub(NullPad(), phone_port=0, arduino="off", clock=lambda: 0.0, advertise=False)
    hub.feed_arduino("0,900")          # frozen clock: the Arduino stays fresh for the whole run
    hub.tick()
    app = make_app(corner, ref, tmp_path, inputs=hub)
    await app.start()
    try:
        await app.wait_for(lambda: app.baseline_run is not None and kinds(app, "decision"), 20)
        health = app.health()
    finally:
        await app.stop()
    assert app.baseline_run["inputs"]["pedal_source"] == "arduino"
    packet = json.loads(app.trace.path.read_text().splitlines()[0])["packet"]
    assert packet["inputs"]["pedal_source"] == "arduino"
    assert packet["inputs"]["pedal_link_drops"] == 0
    assert health["inputs"]["pedal_source"] == "arduino"
