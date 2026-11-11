"""A crash into a barrier (or a car stuck off the track) gets the same retry offer as a corner error."""
from types import SimpleNamespace
from pathlib import Path

from coach.app import CoachApp
from coach.checkpoints import Checkpoint
from coach.crash import CRASH, STUCK, CrashWatch
from coach.events import CheckpointPicker
from coach.reference import References
from coach.telemetry import TrackSimSource
from coach.track import Track
from engine.config import load_track, load_track_reference

ROOT = Path(__file__).resolve().parents[1]
CONFIG = load_track(ROOT / "fixtures" / "track_monza.json")
LAP_REFS = load_track_reference(ROOT / "fixtures" / "track_monza_reference.json")
MODEL = Track.load()


def smp(t, kmh, status="live", out=0, g=0.0):
    return SimpleNamespace(t=t, status=status, speed_kmh=kmh, tyres_out=out, g_lon=g)


def run(w, rows):
    return [w.feed(smp(*r)) for r in rows]


def test_hard_braking_is_not_a_crash():
    w = CrashWatch()
    # 200 km/h to 120 km/h over 2 s: a strong braking zone, about 40 km/h per second
    rows = [(i * 0.1, 200 - i * 4.0) for i in range(21)]
    assert set(run(w, rows)) == {None}


def test_wall_hit_is_a_crash_once():
    w = CrashWatch()
    out = run(w, [(0.0, 150), (0.1, 150), (0.2, 148), (0.3, 60), (0.4, 10), (0.5, 2)])
    assert out.count(CRASH) == 1
    assert run(w, [(1.0, 0), (1.5, 0)]) == [None, None]            # cooled down: no repeat


def test_g_spike_with_a_speed_loss_counts():
    w = CrashWatch()
    out = run(w, [(0.0, 100, "live", 0, 0.0), (0.1, 80, "live", 0, 5.0)])
    assert out[-1] == CRASH


def test_stuck_off_the_track_after_five_seconds():
    w = CrashWatch()
    out = run(w, [(t * 0.5, 2, "live", 3) for t in range(14)])
    assert out.count(STUCK) == 1 and out.index(STUCK) >= 10


def test_standing_on_the_grid_is_not_stuck():
    w = CrashWatch()
    assert set(run(w, [(t * 0.5, 0, "live", 0) for t in range(40)])) == {None}


def test_paused_or_replay_never_fires_and_a_rewind_hold_silences_it():
    w = CrashWatch()
    assert w.feed(smp(0.0, 150, "pause")) is None and w.feed(smp(0.1, 0, "replay")) is None
    w.hold(1.0, 3.0)
    assert w.feed(smp(1.1, 150)) is None and w.feed(smp(1.2, 5)) is None     # a teleport inside the hold
    assert run(w, [(5.0, 150), (5.1, 150), (5.3, 20)]).count(CRASH) == 1     # after the hold it works again


def cp(seq, t, kmh, spline=0.2):
    return Checkpoint(seq, "t", spline, kmh, 1, None, 1.0, 5.0, 1000, t)


def test_pick_crash_prefers_a_save_about_five_seconds_back_that_was_moving():
    pk = CheckpointPicker(MODEL)
    store = SimpleNamespace(ring=[cp(1, 90.0, 120), cp(2, 94.0, 130), cp(3, 96.0, 140), cp(4, 99.0, 5)])
    s = pk.pick_crash(store, 100.0)
    assert s is not None and s.source == "crash" and s.cp.seq == 2          # the newest save that is at least 5 s old and was moving
    only_new = SimpleNamespace(ring=[cp(5, 98.0, 100), cp(6, 99.5, 110)])
    assert pk.pick_crash(only_new, 100.0).cp.seq == 5                       # nothing old enough: the oldest moving
    assert pk.pick_crash(SimpleNamespace(ring=[cp(7, 95.0, 3)]), 100.0) is None


async def test_simulated_crash_offers_a_rewind_that_counts_down_and_loads(tmp_path):
    first = CONFIG.corners[0]
    src = TrackSimSource(CONFIG, realtime=False, start_pos_m=MODEL.get("ascari").entry_m - 400)
    app = CoachApp(first, LAP_REFS[first.id][0], src, [], reset_mode="sim", data_dir=tmp_path / "d",
                   trace_dir=tmp_path / "t", sound=False, countdown=2, tick_s=0.05, persist_checkpoint=False,
                   mode="lap", track=CONFIG, track_references=LAP_REFS, track_model=MODEL,
                   references=References(MODEL, tmp_path / "pb.json"), whole_lap=True)
    await app.start()
    try:
        lc = app.lap_coach
        await app.wait_for(lambda: app.latest is not None, 20)
        await app.handle_command({"type": "simulate_crash"})
        await app.wait_for(lambda: lc.open_offer() is not None, 10)
        o = lc.open_offer()
        assert o.event.kinds == [CRASH] and o.event.corner == "Crash" and "Crashed" in o.cue and o.retryable
        await app.handle_command({"type": "accept"})
        await app.wait_for(lambda: any(e["type"] == "reset_confirmed" for e in app.events), 30)
    finally:
        await app.stop()
    counts = [e["n"] for e in app.events if e["type"] == "countdown"]
    assert counts[:3] == [2, 1, 0]                                           # the 3-2-1 plays before the rewind
    kinds = [e["type"] for e in app.events if e["type"] in ("retry_started", "reset_request", "reset_confirmed")]
    assert kinds[:3] == ["retry_started", "reset_request", "reset_confirmed"]
