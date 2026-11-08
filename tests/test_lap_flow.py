"""Whole-lap flow on LapSim in sim reset mode: error -> cue -> offer -> accept -> retry loop -> resume."""
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


def make(tmp_path, errors, start_m, countdown_s=5.0):
    refs = References(TRACK, tmp_path / "pb.json")
    sim = LapSim(TRACK, errors=errors, start_m=start_m)
    app = CoachApp(BASE, refs.get("c1").as_attempt(), sim, [], reset_mode="sim",
                   data_dir=tmp_path / "data", trace_dir=tmp_path / "traces", sound=False, countdown=0,
                   persist_checkpoint=False, track_model=TRACK, references=refs, whole_lap=True)
    app.lap_coach.offers.countdown_s = countdown_s
    return app, sim, refs


def types(app, *keep):
    return [e["type"] for e in app.events if e["type"] in keep]


def offer_states(app, oid):
    return [e["state"] for e in app.events if e["type"] == "offer" and e["id"] == oid]


async def test_error_offer_accept_retry_resume(tmp_path):
    les = TRACK.get("c4")
    app, sim, refs = make(tmp_path, {"c4": ["early_brake"]}, les.entry_m - 300)
    await app.start()
    try:
        lc = app.lap_coach
        await app.wait_for(lambda: lc.open_offer() is not None, 20)
        o = lc.open_offer()
        assert o.event.corner_id == "c4" and "brake_early" in o.event.kinds
        assert o.cue and o.cue_source == "rules" and o.extra.get("decision") is not None
        assert o.start.source == "sim"
        pressed_at = sim.pos
        await app.handle_command({"type": "accept"})              # dashboard Retry / phone Next
        await app.wait_for(lambda: any(e["type"] == "retry_finished" for e in app.events), 30)
    finally:
        await app.stop()
    assert offer_states(app, o.id) == ["waiting_cue", "open", "accepted"]
    seq = types(app, "corner_event", "retry_started", "reset_request", "reset_confirmed", "resumed",
                "retry_finished")
    assert seq[:4] == ["corner_event", "retry_started", "reset_request", "reset_confirmed"]
    assert seq[-2:] == ["resumed", "retry_finished"]
    retries = [e for e in app.events if e["type"] == "run" and e["role"] == "retry"]
    assert retries and retries[-1]["attempt"]["brake_onset_m"] == pytest.approx(les.brake_m, abs=12)
    assert app.coach.last_decision.action == "end_drill"
    resumed = [e for e in app.events if e["type"] == "reset_confirmed" and e.get("slot") == "resume"]
    assert resumed and lc.retrying is None and app.reset.held_event is None
    # back where Retry was pressed (the sim keeps driving, so: somewhere after that point)
    assert TRACK.wrap(sim.pos - pressed_at) < TRACK.length_m / 2


async def test_flat_corner_retry_is_judged_by_the_detector(tmp_path):
    cg = TRACK.get("c2")
    app, sim, _ = make(tmp_path, {"c2": ["run_wide", "run_wide"]}, cg.entry_m - 300)
    await app.start()
    try:
        lc = app.lap_coach
        await app.wait_for(lambda: lc.open_offer() is not None, 20)
        o = lc.open_offer()
        assert o.event.kinds == ["wheels_off"] and o.cue.startswith("Curva Grande: wheels off")
        assert o.extra.get("decision") is None                    # no drill at a flat corner
        await app.handle_command({"type": "accept_offer", "offer_id": o.id})
        await app.wait_for(lambda: any(e["type"] == "retry_finished" for e in app.events), 30)
    finally:
        await app.stop()
    judged = [e for e in app.events if e["type"] == "retry_judged"]
    # the 2nd attempt (first retry) still runs wide, the next is clean
    assert [j["fixed"] for j in judged] == [False, True]
    assert [x for x in sim.log if x[0] == "c2"][:3] == [("c2", 0, "run_wide"), ("c2", 1, "run_wide"),
                                                        ("c2", 2, None)]


async def test_unanswered_offer_expires_and_the_coach_is_free(tmp_path):
    les = TRACK.get("c4")
    app, _, _ = make(tmp_path, {"c4": ["early_brake"]}, les.entry_m - 300, countdown_s=0.2)
    await app.start()
    try:
        lc = app.lap_coach
        await app.wait_for(lambda: lc.offers.current is not None and lc.offers.current.state == "expired", 20)
        await app.wait_for(lambda: app.coach.state == "IDLE", 5)
        oid = lc.offers.current.id
        assert [h.id for h in lc.offers.history] == [oid]         # still retryable for a while
        assert app.coach.decide_kwargs == app.decide_kwargs_default
    finally:
        await app.stop()


async def test_newer_error_supersedes(tmp_path):
    app, _, _ = make(tmp_path, {"c4": ["early_brake"], "c5": ["early_brake"]}, TRACK.get("c4").entry_m - 300,
                     countdown_s=30)
    await app.start()
    try:
        lc = app.lap_coach
        await app.wait_for(lambda: lc.offers.current is not None and lc.offers.current.event.corner_id == "c5"
                           and lc.offers.current.state == "open", 20)
        first = lc.offers.history[0]
        assert first.event.corner_id == "c4" and first.state == "superseded"
        assert app.corner.name == "Lesmo 2"
    finally:
        await app.stop()


async def test_personal_bests_from_normal_laps_only(tmp_path):
    app, sim, refs = make(tmp_path, {}, TRACK.length_m - 300)
    await app.start()
    try:
        await app.wait_for(lambda: len(refs.summary()["personal_bests"]) == 7, 20)
    finally:
        await app.stop()
    assert refs.get("c1").source == "pb"
    assert not [e for e in app.events if e["type"] == "corner_event"]
