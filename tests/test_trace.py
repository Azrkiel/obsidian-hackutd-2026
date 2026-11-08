import json

from engine.ladder import CircuitBreaker, decide
from engine.trace import TraceWriter
from conftest import FakeProvider, good_offer


async def test_trace_lines(tmp_path, mk_packet):
    p = mk_packet("late_brake")
    d, rungs = await decide(p, [FakeProvider(steps=[{"call": good_offer(p)}])],
                            breaker=CircuitBreaker(), total_deadline_s=1)
    tw = TraceWriter(tmp_path / "sub" / "traces", session="s1")
    assert not tw.dir.exists()  # lazy
    tw.write(d, p, rungs)
    tw.write(d, p, rungs)
    lines = tw.path.read_text().splitlines()
    assert len(lines) == 2
    rec = json.loads(lines[0])
    assert {"ts", "session", "decision", "packet", "rungs", "validation", "final"} <= rec.keys()
    assert rec["session"] == "s1" and rec["packet"]["attempt_id"] == p["attempt_id"]
    assert rec["final"] == {"mode": "think", "provider": "fake", "model": "fake-model"}
    assert rec["validation"][0]["outcome"] == "ok"
