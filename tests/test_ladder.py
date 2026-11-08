from engine.ladder import CircuitBreaker, decide, warm_up
from engine.models import ToolCall
from conftest import FakeProvider, good_end, good_offer

FAST = dict(think_deadline_s=0.05, fast_deadline_s=0.05, total_deadline_s=0.3)


async def test_think_ok(mk_packet):
    p = mk_packet("late_brake")
    prov = FakeProvider(steps=[{"call": good_offer(p), "reasoning": ["a", "b"]}])
    seen = []
    d, rungs = await decide(p, [prov], on_reasoning=seen.append, breaker=CircuitBreaker(), **FAST)
    assert d.mode == "think" and d.provider == "fake" and d.drill_id == "brake_point"
    assert d.reasoning == "ab" and seen == ["a", "b"]
    assert [r["outcome"] for r in rungs] == ["ok"]


async def test_think_timeout_then_fast(mk_packet):
    p = mk_packet("late_brake")
    prov = FakeProvider(steps=[{"delay": 1.0, "call": good_offer(p)}, {"call": good_offer(p)}])
    d, rungs = await decide(p, [prov], breaker=CircuitBreaker(), **FAST)
    assert d.mode == "fast"
    assert [(r["mode"], r["outcome"]) for r in rungs] == [("think", "error"), ("fast", "ok")]
    assert rungs[0]["reason"] == "timeout"


async def test_invalid_then_repair_ok(mk_packet):
    p = mk_packet("late_brake")
    bad = good_offer(p, cue="Brake at the 77 m board.")
    prov = FakeProvider(steps=[{"call": bad}, {"call": good_offer(p)}])
    d, rungs = await decide(p, [prov], breaker=CircuitBreaker(), **FAST)
    assert d.mode == "fast"
    assert rungs[0]["outcome"] == "rejected" and "77" in rungs[0]["reason"]
    assert prov.calls[1]["repair"][0] is bad and "77" in prov.calls[1]["repair"][1]


async def test_invalid_twice_rules(mk_packet):
    p = mk_packet("late_brake")
    bad = good_offer(p, cue="Brake at the 77 m board.")
    prov = FakeProvider(steps=[{"call": bad}, {"call": bad}])
    d, rungs = await decide(p, [prov], breaker=CircuitBreaker(), **FAST)
    assert d.mode == "rules" and d.drill_id == "brake_point"
    assert rungs[-1]["mode"] == "rules"


async def test_429_next_provider(mk_packet):
    p = mk_packet("late_brake")
    a = FakeProvider("a", steps=[{"error": "rate_limited"}])
    b = FakeProvider("b", steps=[{"call": good_offer(p)}])
    d, rungs = await decide(p, [a, b], breaker=CircuitBreaker(), **FAST)
    assert d.provider == "b" and d.mode == "think"
    assert len(a.calls) == 1  # no fast retry on rate limit


async def test_all_fail_rules(mk_packet):
    p = mk_packet("clean")
    a = FakeProvider("a", steps=[{"error": "server"}])
    b = FakeProvider("b", steps=[{"error": "auth"}])
    d, rungs = await decide(p, [a, b], breaker=CircuitBreaker(), **FAST)
    assert d.mode == "rules" and d.end_reason == "no_coaching_needed"


async def test_total_deadline_rules(mk_packet):
    p = mk_packet("late_brake")
    a = FakeProvider("a", steps=[{"delay": 1.0}, {"delay": 1.0}])
    b = FakeProvider("b", steps=[{"call": good_offer(p)}])
    d, rungs = await decide(p, [a, b], think_deadline_s=0.05, fast_deadline_s=0.2,
                            total_deadline_s=0.1, breaker=CircuitBreaker())
    assert d.mode == "rules"
    assert b.calls == []


async def test_missing_key_skipped(mk_packet):
    p = mk_packet("late_brake")
    a = FakeProvider("a", available=False)
    b = FakeProvider("b", steps=[{"call": good_offer(p)}])
    d, rungs = await decide(p, [a, b], breaker=CircuitBreaker(), **FAST)
    assert d.provider == "b" and a.calls == []
    assert rungs[0]["outcome"] == "skipped"


async def test_evidence_call_is_rejected(mk_packet):
    p = mk_packet("late_brake")
    ev = ToolCall("get_attempt_evidence", {"attempt_id": p["attempt_id"]})
    prov = FakeProvider(steps=[{"call": ev}, {"call": good_offer(p)}])
    d, _ = await decide(p, [prov], breaker=CircuitBreaker(), **FAST)
    assert d.mode == "fast"


async def test_circuit_breaker(mk_packet):
    p = mk_packet("late_brake")
    now = [0.0]
    br = CircuitBreaker(clock=lambda: now[0])
    prov = FakeProvider("a", steps=[{"error": "server"}] * 3 + [{"call": good_offer(p)}])
    for _ in range(3):
        await decide(p, [prov], breaker=br, **FAST)
    assert br.is_open("a") and len(prov.calls) == 3
    d, rungs = await decide(p, [prov], breaker=br, **FAST)
    assert len(prov.calls) == 3 and rungs[0]["reason"] == "circuit open" and d.mode == "rules"
    now[0] = 61.0
    assert not br.is_open("a")
    d, _ = await decide(p, [prov], breaker=br, **FAST)
    assert d.mode == "think" and len(prov.calls) == 4
    assert br.fails["a"] == 0


async def test_warm_up():
    a = FakeProvider("a")
    b = FakeProvider("b", steps=[{"warm_error": True}])
    c = FakeProvider("c", available=False)
    res = await warm_up([a, b, c])
    assert res == {"a": 5.0, "b": None}
