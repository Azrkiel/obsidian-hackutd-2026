"""EventDetector, CheckpointPicker and OfferManager."""
import asyncio
import dataclasses

import pytest

from coach.checkpoints import CheckpointStore, parse_ck
from coach.events import MAJOR, MINOR, CheckpointPicker, EventDetector, RetryStart, Thresholds
from coach.lap_sim import LapSim
from coach.offers import ACCEPTED, EXPIRED, OPEN, SUPERSEDED, WAITING, OfferManager
from coach.reference import References
from coach.track import Track
from coach.corner_pass import PassScorer
from engine.config import load_corner

TRACK = Track.load()
REFS = References(TRACK, None)
BASE = load_corner("fixtures/corner_monza_t1.json")


def lap(errors):
    passes = []
    sc = PassScorer(TRACK, BASE, passes.append)
    sim = LapSim(TRACK, errors=errors, laps=1.05, start_m=TRACK.length_m - 400)

    async def go():
        async for s in sim.samples():
            sc.add(s)
    asyncio.run(go())
    return {p.corner_id: p for p in passes}


@pytest.fixture(scope="module")
def clean():
    return lap({})


@pytest.fixture(scope="module")
def bad():
    return lap({"t1": ["late_brake"], "roggia": ["early_brake"], "lesmo1": ["spin"], "lesmo2": ["run_wide"],
                "ascari": ["slow_exit"], "parabolica": ["lockup"]})


def detect(p, th=None):
    c = TRACK.get(p.corner_id)
    return EventDetector(th).detect(p, REFS.get(c.id), flat=c.major_only)


def test_clean_lap_raises_nothing(clean):
    assert [detect(p) for p in clean.values()] == [None] * 7


def test_each_mistake_raises_its_event(bad):
    ev = {k: detect(p) for k, p in bad.items()}
    assert ev["curva_grande"] is None
    assert ev["t1"].severity == MAJOR and {"wheels_off", "lockup", "brake_late"} <= set(ev["t1"].kinds)
    assert ev["roggia"].severity == MINOR and set(ev["roggia"].kinds) == {"time_lost", "brake_early"}
    assert ev["lesmo1"].severity == MAJOR and "spin" in ev["lesmo1"].kinds
    assert "wheels_off" in ev["lesmo2"].kinds
    assert ev["ascari"].kinds == ["time_lost"] and ev["ascari"].facts["time_lost_s"] > 0.25
    assert ev["parabolica"].kinds == ["lockup"]
    assert ev["roggia"].facts["brake_delta_m"] < -15 and ev["t1"].summary()["reference"] == "ai"


def test_sensitivity_setting(bad):
    p = bad["ascari"]
    assert detect(p, Thresholds(time_lost_s=0.5)) is None
    assert detect(p, Thresholds(time_lost_s=0.1)) is not None


def test_flat_corner_only_major(clean):
    p = dataclasses.replace(clean["curva_grande"], segment_s=clean["curva_grande"].segment_s + 1.0)
    assert detect(p) is None                                     # slow, but flat: minor ignored
    assert detect(dataclasses.replace(p, tyres_out_s=0.8)).kinds == ["wheels_off"]


def test_bad_data_raises_nothing(bad):
    assert detect(dataclasses.replace(bad["t1"], valid=False, invalid_reason="data gap")) is None


# -- picker --
def store_with(lines, now=100.0):
    st = CheckpointStore(listen=("127.0.0.1", 0), clock=lambda: now)
    for ln in lines:
        st.feed(ln)
    return st


def ck(seq, kind, pos_m, kmh, anchor="-", t=100.0):
    return f"CK {seq} {kind} {pos_m / TRACK.length_m:.6f} {kmh} 1 {anchor} 0.4 3 4096"


def test_picker_prefers_this_laps_anchor():
    les = TRACK.get("lesmo1")
    a = TRACK.anchor_m(les, 4.0)
    st = store_with([ck(1, "t", a - 200, 230), ck(2, "a", a, 230, anchor=4)])
    got = CheckpointPicker(TRACK).pick(les, st, now=105.0)
    assert got.source == "anchor" and got.pos_m == pytest.approx(a, abs=0.1) and got.cp.seq == 2
    stale = CheckpointPicker(TRACK).pick(les, st, now=200.0)     # last lap's anchor: too old
    assert stale is None


def test_picker_falls_back_to_the_buffer_then_the_oldest_stable():
    les = TRACK.get("lesmo1")
    key = les.key_m
    far, near, late = TRACK.pos_before(key, 6.0), TRACK.pos_before(key, 4.5), TRACK.pos_before(key, 2.0)
    st = store_with([ck(1, "t", far, TRACK.ai_kmh(far)), ck(2, "t", near, TRACK.ai_kmh(near)),
                     ck(3, "t", late, TRACK.ai_kmh(late))])
    got = CheckpointPicker(TRACK).pick(les, st, now=101.0)
    assert got.source == "buffer" and got.cp.seq == 2           # newest that leaves 4 s
    in_corner = les.apex_m[0]                                   # inside a corner (past the brake point)
    straight = les.entry_m - 20                                  # just before Lesmo 1, < 4 s out
    assert TRACK.ai_time(straight, key) < 4.0
    st = store_with([ck(1, "t", in_corner, 90), ck(2, "t", straight, TRACK.ai_kmh(straight))])
    got = CheckpointPicker(TRACK).pick(les, st, now=101.0)
    assert got.source == "oldest" and got.cp.seq == 2           # the save inside Lesmo 1 isn't stable
    assert CheckpointPicker(TRACK).pick(les, store_with([]), now=101.0) is None


def test_picker_in_sim_mode():
    les = TRACK.get("lesmo1")
    s = CheckpointPicker(TRACK, lead_s=5.0).for_sim(les)
    assert s.source == "sim" and TRACK.ai_time(s.pos_m, les.key_m) == pytest.approx(5.0, abs=0.05)


# -- offers --
class Clock:
    t = 0.0

    def __call__(self):
        return self.t


def ev(n, bad):
    e = detect(bad["t1"])
    return dataclasses.replace(e, id=f"e{n}")


def mgr():
    clock, seen = Clock(), []
    return OfferManager(countdown_s=5, hold_s=60, max_history=2, clock=clock, on_change=seen.append), clock, seen


START = RetryStart("sim", 5600.0, 300.0)


def test_offer_lifecycle(bad):
    m, clock, seen = mgr()
    o, dropped = m.new(ev(1, bad), START)
    assert o.state == WAITING and dropped == [] and m.open_offer() is None
    assert m.accept() is None                                    # nothing to accept before the cue
    clock.t = 1.5
    assert m.cue_delivered("e1", "Brake at the 100 board.", "rules")
    assert o.state == OPEN and o.ms_left(clock.t + 2) == 3000   # countdown from the cue, not the event
    assert m.accept().id == "e1" and o.state == ACCEPTED
    assert [e["state"] for e in seen] == [WAITING, OPEN, ACCEPTED]


def test_offer_expires_into_the_history(bad):
    m, clock, _ = mgr()
    m.new(ev(1, bad), START)
    m.cue_delivered("e1", "cue", "rules")
    clock.t = 5.1
    assert m.tick() == [] and m.current.state == EXPIRED and m.open_offer() is None
    assert [h.id for h in m.history] == ["e1"]
    clock.t = 30
    assert m.accept("e1").state == ACCEPTED and m.history == []   # retry from the history


def test_newest_supersedes_and_history_is_bounded(bad):
    m, clock, _ = mgr()
    for n in range(1, 4):
        clock.t = n
        o, dropped = m.new(ev(n, bad), START)
        m.cue_delivered(o.id, "cue", "rules")
    assert m.current.id == "e3" and [h.id for h in m.history] == ["e2", "e1"]
    assert all(h.state == SUPERSEDED for h in m.history)
    _, dropped = m.new(ev(4, bad), START)
    assert [d.id for d in dropped] == ["e1"]                    # its hold can go
    clock.t = 70
    assert {d.id for d in m.tick()} == {"e2", "e3"} and m.history == []
    assert m.accept("e2") is None


def test_late_model_answer(bad):
    m, clock, _ = mgr()
    m.new(ev(1, bad), START)
    m.cue_delivered("e1", "rules cue", "rules")
    assert not m.cue_delivered("e1", "model cue", "model")      # too late for this offer
    assert m.current.cue == "rules cue"
    m.new(ev(2, bad), START)
    m.cue_delivered("e1", "later still", "model")
    assert m.history[0].extra["late_cue"] == "later still"


def test_no_retry_without_a_start(bad):
    m, _, _ = mgr()
    m.new(ev(1, bad), None)
    m.cue_delivered("e1", "cue", "rules")
    assert m.accept() is None and not m.current.retryable
    m.new(ev(2, bad), START)
    assert m.history == []                                      # nothing to retry: not kept
