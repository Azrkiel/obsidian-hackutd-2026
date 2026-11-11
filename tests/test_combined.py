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
                   trace_dir=tmp_path / "t", sound=False, countdown=3, persist_checkpoint=False, mode="lap",
                   track=CONFIG, track_references=LAP_REFS, track_model=MODEL,
                   references=References(MODEL, tmp_path / "pb.json"), whole_lap=True, speaker=speaker)
    return app


def kinds(app, *t):
    return [e["type"] for e in app.events if e["type"] in t]


async def test_error_retry_inside_the_lap_coach(tmp_path, monkeypatch):
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
        load = app.reset._request_load

        async def load_with_old_pass(decision_id, slot):
            lc.on_pass(o.event.cpass)  # a pass arriving before the rewind cannot count
            await load(decision_id, slot)

        monkeypatch.setattr(app.reset, "_request_load", load_with_old_pass)
        await app.handle_command({"type": "accept"})
        await app.wait_for(lambda: "retry_finished" in kinds(app, "retry_finished"), 30)
        await app.wait_for(lambda: len(kinds(app, "track_lap")) >= 2, 60)      # the lap coach carries on
    finally:
        await app.stop()
    judged = [e for e in app.events if e["type"] == "retry_judged"]
    assert len(judged) == 1 and judged[0]["try"] == 1 and judged[0]["fixed"]
    assert kinds(app, "retry_started", "reset_request", "reset_confirmed", "retry_judged", "resumed",
                 "retry_finished") == ["retry_started", "reset_request", "reset_confirmed",
                                       "retry_judged", "retry_finished"]
    assert [e["n"] for e in app.events if e["type"] == "countdown"][:4] == [3, 2, 1, 0]   # the rewind counts down first
    assert app.reset.resume_point is not None  # returning is still an explicit driver action
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
    judged = [e for e in app.events if e["type"] == "retry_judged"]
    assert len(judged) == 1 and not judged[0]["fixed"]
    assert kinds(app, "reset_request", "resumed") == ["reset_request"]


def _running_retry(tmp_path):
    """A one-shot retry at Lesmo 1 that has rewound (ready) but whose corner never gets completed."""
    from coach.events import RetryStart
    from test_events import detect, lap
    app = make(tmp_path, LapSim(MODEL))
    lc = app.lap_coach
    ev = detect(lap({"lesmo1": ["early_brake"]})["lesmo1"])
    o, _ = lc.offers.new(ev, RetryStart("sim", 2000, 230))
    lc.retrying, lc._retry_ready, lc._retry_at = o, True, lc.offers.clock()
    return app, lc


def test_a_retry_whose_corner_is_skipped_ends_and_the_next_corner_is_coached(tmp_path):
    from test_events import lap
    app, lc = _running_retry(tmp_path)
    spawned = []
    app._spawn = lambda coro: spawned.append(coro.cr_code.co_name) or coro.close()   # no loop needed
    lc.on_pass(lap({"roggia": ["late_brake"]})["roggia"])     # got past Lesmo 1 without completing it
    assert lc.retrying is None
    assert kinds(app, "retry_finished") == ["retry_finished"]
    assert any(e["type"] == "status" and "skipped" in e.get("message", "") for e in app.events)
    assert kinds(app, "corner_event") == ["corner_event"] and "_raise" in spawned   # Roggia is coached


def test_a_retry_not_completed_in_time_gives_up(tmp_path):
    from coach.lap_coach import RETRY_GIVE_UP_S
    app, lc = _running_retry(tmp_path)
    lc._give_up_stale_retry()
    assert lc.retrying is not None                            # still in time
    lc._retry_at -= RETRY_GIVE_UP_S + 1
    lc._give_up_stale_retry()
    assert lc.retrying is None and kinds(app, "retry_finished") == ["retry_finished"]


def test_anchor_save_stays_usable_after_a_long_off():
    from types import SimpleNamespace
    from coach.events import CheckpointPicker
    c = MODEL.get("lesmo1")
    anchor = SimpleNamespace(t=0.0, spline=(c.entry_m - 200) / MODEL.length_m, speed_kmh=180.0)
    store = SimpleNamespace(anchor=lambda i: anchor, ring=[])
    picker = CheckpointPicker(MODEL)
    assert picker.pick(c, store, now=60.0).source == "anchor"      # a minute in the corner: still this approach
    assert picker.pick(c, store, now=100.0) is None                 # that old: last lap's save


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
