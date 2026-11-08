"""Combined demo: the lap coach (PR #7) and retry offers in one app (--track ... --mode lap)."""
from pathlib import Path

from coach.app import CoachApp
from coach.lap_sim import LapSim
from coach.reference import References
from coach.telemetry import TrackSimSource
from coach.track import Track
from engine.config import load_track, load_track_reference
from engine.voice import ADVICE, OFFER, Announcer

ROOT = Path(__file__).resolve().parents[1]
CONFIG = load_track(ROOT / "fixtures" / "track_monza.json")
LAP_REFS = load_track_reference(ROOT / "fixtures" / "track_monza_reference.json")
MODEL = Track.load()


def make(tmp_path, source, speaker=None):
    first = CONFIG.corners[0]
    app = CoachApp(first, LAP_REFS[first.id][0], source, [], reset_mode="sim", data_dir=tmp_path / "d",
                   trace_dir=tmp_path / "t", sound=False, countdown=0, persist_checkpoint=False, mode="lap",
                   track=CONFIG, track_references=LAP_REFS, track_model=MODEL,
                   references=References(MODEL, tmp_path / "pb.json"), whole_lap=True, speaker=speaker)
    return app


def kinds(app, *t):
    return [e["type"] for e in app.events if e["type"] in t]


async def test_error_retry_inside_the_lap_coach(tmp_path):
    les = MODEL.get("lesmo1")
    sim = LapSim(MODEL, errors={"lesmo1": ["early_brake"]}, start_m=les.entry_m - 300)
    app = make(tmp_path, sim)
    assert type(app.coach).__name__ == "TrackCoach" and app.lap_coach.standalone
    await app.start()
    try:
        lc = app.lap_coach
        await app.wait_for(lambda: lc.open_offer() is not None, 20)
        o = lc.open_offer()
        assert o.event.corner_id == "lesmo1" and "brake_early" in o.event.kinds
        assert o.cue and o.cue_source == "rules" and "packet" in o.extra   # ladder (rules) on the event
        await app.handle_command({"type": "accept"})
        await app.wait_for(lambda: "retry_finished" in kinds(app, "retry_finished"), 30)
        await app.wait_for(lambda: len(kinds(app, "track_lap")) >= 2, 60)      # the lap coach carries on
    finally:
        await app.stop()
    judged = [e for e in app.events if e["type"] == "retry_judged"]
    assert judged and judged[-1]["fixed"]
    seq = kinds(app, "retry_started", "reset_confirmed", "resumed", "retry_finished")
    assert seq[0] == "retry_started" and seq[-2:] == ["resumed", "retry_finished"]
    assert app.coach.state != "AWAIT_RESET" and app.auto_retry is False


async def test_lap_coachs_sim_errors_get_offers(tmp_path):
    # PR #7's demo knobs: Ascari braked 35 m early (230 m board vs 195 m)
    sim = TrackSimSource(CONFIG, realtime=False, corners={"ascari": {"board_m": 230}},
                         start_pos_m=MODEL.get("ascari").entry_m - 400)
    app = make(tmp_path, sim)
    await app.start()
    try:
        lc = app.lap_coach
        await app.wait_for(lambda: lc.offers.current is not None and lc.offers.current.state == "open", 20)
        o = lc.offers.current
        assert o.event.corner_id == "ascari" and "brake_early" in o.event.kinds
        await app.handle_command({"type": "accept"})
        await app.wait_for(lambda: "retry_finished" in kinds(app, "retry_finished"), 60)
    finally:
        await app.stop()
    assert len([e for e in app.events if e["type"] == "retry_judged"]) >= 1


class Mute:
    def speak(self, text):
        pass


def test_offer_cue_goes_before_lap_advice_and_the_countdown_waits_for_it(tmp_path):
    clock = [0.0]
    ann = Announcer(Mute(), talk_zones=[(0, 10)], clock=lambda: clock[0])
    ann.on_position(500.0)                                   # in a corner: both wait for the straight
    ann.say("Lap: Ascari, brake later.", ADVICE)
    ann.say("Lesmo 1: braked early.", OFFER, offer_id="e1")
    assert [m.kind for m in ann.queue] == [OFFER, ADVICE]
    app = make(tmp_path, LapSim(MODEL))
    lc = app.lap_coach
    from coach.events import RetryStart
    from test_events import detect, lap
    ev = detect(lap({"lesmo1": ["early_brake"]})["lesmo1"])
    o, _ = lc.offers.new(ev, RetryStart("sim", 2000, 230))
    app.announcer = type("A", (), {"muted": False, "say": lambda self, *a, **k: None})()
    lc._deliver(o, "Lesmo 1: braked early.", "rules")
    assert o.state == "waiting_cue"                         # queued for the next talk zone
    lc.on_voice({"type": "voice", "offer_id": o.id, "status": "speaking"})
    assert o.state == "open"
