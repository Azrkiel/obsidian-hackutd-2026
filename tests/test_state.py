import asyncio

from engine.ladder import CircuitBreaker
from engine.live_cue import LiveCue, NullPlayer
from engine.state import Coach
from engine.trace import TraceWriter
from conftest import FakeProvider, attempt


def make(corner, ref, providers=None, tmp=None, delay=None):
    events, resets = [], []

    async def request_reset(did):
        resets.append(did)

    player = NullPlayer()
    coach = Coach(corner, ref, providers if providers is not None else [], events.append,
                  request_reset, trace=TraceWriter(tmp, "t") if tmp else None,
                  live_cue=LiveCue(corner, player),
                  decide_kwargs={"breaker": CircuitBreaker(), "total_deadline_s": 1.0})
    return coach, events, resets, player


def statuses(events):
    return [e["state"] for e in events if e["type"] == "status"]


async def test_full_loop(corner, ref, tmp_path):
    coach, events, resets, player = make(corner, ref, tmp=tmp_path)
    await coach.on_scored(attempt("late_brake"))
    assert coach.state == "OFFERED" and coach.baseline is not None
    offer = coach.offer
    assert offer.mode == "rules" and offer.drill_id == "brake_point"
    assert resets == []  # no reset before accept
    await coach.on_accept(offer.decision_id)
    assert coach.state == "AWAIT_RESET" and resets == [offer.decision_id]
    coach.on_reset_confirmed()
    assert coach.state == "RETRY"
    assert any(e["type"] == "cue_armed" for e in events) and coach.live_cue.armed
    await coach.on_scored(attempt("retry_close"))
    assert coach.state == "OFFERED" and coach.offer.verdict == "repeat"
    assert coach.drill.tries == 1
    assert player.calls == ["miss"]
    await coach.on_accept(coach.offer.decision_id)
    coach.on_reset_confirmed()
    await coach.on_scored(attempt("retry_hit"))
    assert coach.state == "DONE" and coach.last_decision.end_reason == "drill_complete"
    assert player.calls == ["miss", "hit"]
    decisions = [e for e in events if e["type"] == "decision"]
    assert len(decisions) == 3 and "rungs" in decisions[0]
    assert len((tmp_path / "t.jsonl").read_text().splitlines()) == 3
    coach.reset_session()
    assert coach.state == "IDLE" and coach.baseline is None
    await coach.on_scored(attempt("clean"))
    assert coach.state == "DONE"


async def test_stale_accept_ignored(corner, ref):
    coach, events, resets, _ = make(corner, ref)
    await coach.on_accept("d-nothing")  # IDLE
    await coach.on_scored(attempt("late_brake"))
    await coach.on_accept("d-stale")
    assert coach.state == "OFFERED" and resets == []
    assert any("ignored" in e.get("message", "") for e in events)


async def test_reset_confirmed_only_after_accept(corner, ref):
    coach, events, _, _ = make(corner, ref)
    await coach.on_scored(attempt("late_brake"))
    coach.on_reset_confirmed()
    assert coach.state == "OFFERED"


async def test_attempt_during_deciding_ignored(corner, ref):
    from conftest import good_offer
    p = FakeProvider(steps=[{"delay": 0.1, "call": None}])
    coach, events, _, _ = make(corner, ref, providers=[p])
    first = asyncio.create_task(coach.on_scored(attempt("late_brake")))
    await asyncio.sleep(0.02)
    assert coach.state == "DECIDING"
    await coach.on_scored(attempt("clean"))  # ignored
    await first
    assert len([e for e in events if e["type"] == "decision"]) == 1
    assert any("decision in flight" in e.get("message", "") for e in events)


async def test_attempt_ignored_while_offered(corner, ref):
    coach, events, _, _ = make(corner, ref)
    await coach.on_scored(attempt("late_brake"))
    await coach.on_scored(attempt("clean"))
    assert coach.state == "OFFERED"
    assert sum(e["type"] == "decision" for e in events) == 1


async def test_thinking_events_and_end(corner, ref):
    from conftest import good_end
    p = attempt("clean")
    prov = FakeProvider(steps=[{"reasoning": ["all ", "good"], "call": None}])
    prov.steps[0]["call"] = good_end({"attempt_id": p.attempt_id})
    coach, events, _, _ = make(corner, ref, providers=[prov])
    await coach.on_scored(p)
    assert [e["text"] for e in events if e["type"] == "thinking"] == ["all ", "good"]
    assert coach.state == "DONE"


async def test_skip_cue_once(corner, ref):
    coach, events, _, _ = make(corner, ref)
    await coach.on_scored(attempt("late_brake"))
    await coach.on_accept(coach.offer.decision_id)
    coach.disable_cue_next_try()
    coach.on_reset_confirmed()
    assert coach.state == "RETRY" and not coach.live_cue.armed
