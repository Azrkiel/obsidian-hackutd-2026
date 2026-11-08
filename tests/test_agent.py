import asyncio
import json
from types import SimpleNamespace as NS

import pytest

from coach.app import CoachApp
from coach.telemetry import SimSource
from coach.scorer import CornerScorer
from engine.agent_tools import AgentSession, READ_TOOLS
from engine.evidence import build_packet
from engine.ladder import CircuitBreaker, decide
from engine.models import DrillState
from engine.nemotron import NemotronProvider, ProviderConfig
from engine.plan import Plan
from engine.voice import SilentSpeaker

FAST = dict(think_deadline_s=2.0, fast_deadline_s=2.0, total_deadline_s=4.0)


# ---------------------------------------------------------------- fake OpenAI client
def _tc_msg(name, args, cid="c1"):
    return NS(content=None, reasoning_content="", tool_calls=[
        NS(id=cid, function=NS(name=name, arguments=json.dumps(args)))])


class FakeClient:
    """Scripted chat.completions.create: each step is (name, args) or {'delay': s} or {'text': ...}."""

    def __init__(self, steps):
        self.steps = list(steps)
        self.requests = []
        self.chat = NS(completions=NS(create=self.create))

    async def create(self, **kw):
        self.requests.append(kw)
        step = self.steps.pop(0) if self.steps else {"text": "no more steps"}
        if isinstance(step, dict) and step.get("delay"):
            await asyncio.sleep(step["delay"])
            step = step.get("then", {"text": "late"})
        if isinstance(step, dict):
            msg = NS(content=step["text"], reasoning_content="", tool_calls=None)
        else:
            msg = _tc_msg(*step, cid=f"c{len(self.requests)}")
        if kw.get("stream"):
            async def gen():
                yield NS(choices=[NS(delta=NS(reasoning_content="thinking. ", content=None,
                                              tool_calls=None))])
                if msg.tool_calls:
                    t = msg.tool_calls[0]
                    yield NS(choices=[NS(delta=NS(content=None, tool_calls=[NS(
                        index=0, id=t.id, function=NS(name=t.function.name, arguments=t.function.arguments))]))])
                else:
                    yield NS(choices=[NS(delta=NS(content=msg.content, tool_calls=None))])
            return gen()
        return NS(choices=[NS(message=msg)])


def provider(steps, transport="tools"):
    cfg = ProviderConfig("fake", "http://x", "NONE", "nemotron", {}, {}, key_required=False)
    return NemotronProvider(cfg, client=FakeClient(steps), transport=transport)


# ---------------------------------------------------------------- session from simulated laps
async def scored(corner, board=86, release=0.15):
    out = []
    sc = CornerScorer(corner, lambda a, t: out.append((a, t)))
    src = SimSource(corner, realtime=False, brake_board_m=board, release_s=release)
    async for s in src.samples():
        sc.add(s)
        if out:
            break
    src.stop()
    return out[0]


@pytest.fixture
async def session(corner, ref):
    ref_a, ref_t = await scored(corner, board=100, release=0.55)
    ref_a.attempt_id = "ref"
    s = AgentSession(corner, ref_a, ref_t)
    a, t = await scored(corner)
    s.add_run(a, t)
    s.baseline_id = a.attempt_id
    p = build_packet(a, ref_a, a, corner, None, None)
    p["turn"], p["plan"], p["history"] = "plan", None, []
    return s, p


def plan_args(p, goals=None):
    return {"attempt_id": p["attempt_id"], "summary": "Brake point first, then the release.",
            "goals": goals or [
                {"drill_id": "brake_point", "target": {"marker_m": 100},
                 "cue": "Brake at the 100 m board.", "in_a_row": 1},
                {"drill_id": "brake_release", "target": {"release_s": 0.5},
                 "cue": "Ease off the brake slower as you turn in.", "in_a_row": 2}]}


# ---------------------------------------------------------------- read tools
async def test_read_tools_give_numbers(session):
    s, p = session
    aid = p["attempt_id"]
    prof = s.run_tool("get_driving_profile", {"attempt_id": aid}, aid, p)
    assert prof["profile"]["release_s"] < prof["reference"]["release_s"]
    sp = s.run_tool("get_splits", {"attempt_id": aid, "vs": "reference"}, aid, p)
    assert [x["sector"] for x in sp["sectors"]][:2] == ["approach", "braking"]
    assert "delta_trace" not in sp and sp["summary"]
    cmp = s.run_tool("compare_runs", {"a": aid, "b": "reference"}, aid, p)
    assert cmp["diff"]["brake_board_m"] < 0
    assert s.run_tool("get_corner_info", {}, aid, p)["gates"]["exit_m"] == 540
    assert "error" in s.run_tool("get_driving_profile", {"attempt_id": "nope"}, aid, p)
    assert s.run_tool("get_session_history", {}, aid, p) == {"laps": [], "plan": None}


# ---------------------------------------------------------------- engine: the loop
async def test_tool_tool_set_plan(session):
    s, p = session
    aid = p["attempt_id"]
    prov = provider([("get_driving_profile", {"attempt_id": aid}),
                     ("get_splits", {"attempt_id": aid, "vs": "reference"}),
                     ("set_plan", plan_args(p))])
    turn = s.turn(p, "plan")
    d, rungs = await decide(p, [prov], agent=turn, breaker=CircuitBreaker(), **FAST)
    assert d.mode == "think" and d.plan_action == "set_plan" and len(d.plan["goals"]) == 2
    assert [c["name"] for c in turn.log] == ["get_driving_profile", "get_splits"]
    reqs = prov.client.requests
    assert len(reqs) == 3
    assert {t["function"]["name"] for t in reqs[0]["tools"]} >= {"get_splits", "set_plan"}
    tool_msgs = [m for m in reqs[2]["messages"] if m["role"] == "tool"]
    assert len(tool_msgs) == 2 and "release_s" in tool_msgs[0]["content"]
    assert reqs[2]["messages"][0]["content"].startswith("You are a racing coach running a practice")


async def test_round_cap(session):
    s, p = session
    aid = p["attempt_id"]
    many = [("get_driving_profile", {"attempt_id": aid})] * 4
    prov = provider(many + [("set_plan", plan_args(p))])
    turn = s.turn(p, "plan")
    d, rungs = await decide(p, [prov], agent=turn, breaker=CircuitBreaker(), **FAST)
    reqs = prov.client.requests
    assert len(turn.log) == 3  # 3 rounds of reads, then only actions are offered
    assert {t["function"]["name"] for t in reqs[3]["tools"]} == {"set_plan", "end_drill", "offer_drill"}
    assert rungs[0]["outcome"] == "rejected" and "action tool" in rungs[0]["reason"]
    assert d.plan_action == "set_plan" and d.mode == "fast"  # repaired
    assert "No more read tools" in [m for m in reqs[3]["messages"] if m["role"] == "tool"][-1]["content"]


async def test_unknown_tool_and_bad_plan_then_rules(session):
    s, p = session
    bad = plan_args(p, goals=[{"drill_id": "throttle_pickup", "target": {"marker_m": 20},
                               "cue": "Throttle at 20 m."}])  # throttle is inside tolerance
    prov = provider([("get_weather", {}), ("set_plan", bad)])
    turn = s.turn(p, "plan")
    d, rungs = await decide(p, [prov], agent=turn, breaker=CircuitBreaker(), **FAST)
    assert "not allowed" in rungs[0]["reason"]
    assert "goal 1" in rungs[1]["reason"] and "inside tolerance" in rungs[1]["reason"]
    assert d.mode == "rules"


async def test_timeout_part_way_falls_back(session):
    s, p = session
    aid = p["attempt_id"]
    prov = provider([("get_driving_profile", {"attempt_id": aid}), {"delay": 1.0}, {"delay": 1.0}])
    turn = s.turn(p, "plan")
    d, rungs = await decide(p, [prov], agent=turn, breaker=CircuitBreaker(),
                            think_deadline_s=0.3, fast_deadline_s=0.3, total_deadline_s=0.8)
    assert d.mode == "rules" and len(turn.log) == 1


async def test_json_transport_loop(session):
    s, p = session
    aid = p["attempt_id"]
    steps = [{"text": json.dumps({"tool": "get_splits", "arguments": {"attempt_id": aid}})},
             {"text": "```json\n" + json.dumps({"tool": "set_plan", "arguments": plan_args(p)}) + "\n```"}]
    prov = provider(steps, transport="json")
    turn = s.turn(p, "plan")
    d, _ = await decide(p, [prov], agent=turn, breaker=CircuitBreaker(), **FAST)
    assert d.plan_action == "set_plan" and turn.log[0]["name"] == "get_splits"
    last = prov.client.requests[-1]
    assert "tools" not in last and last["messages"][-1]["content"].startswith("Result of get_splits")


# ---------------------------------------------------------------- evaluate-turn validation
async def test_evaluate_validation(session, corner):
    s, p = session
    s.plan = Plan.from_goals(plan_args(p)["goals"])
    a = s.runs[p["attempt_id"]]["attempt"]
    ds = DrillState("brake_point", {"marker_m": 100}, 1)
    ev = build_packet(a, s.reference, a, corner, ds, a)
    s.plan.record(False)
    turn = s.turn(ev, "evaluate")
    call = lambda name, **kw: NS(name=name, arguments={"attempt_id": ev["attempt_id"], **kw}, id=None)
    assert "not inside tolerance" in turn.validate(call("advance_plan", outcome="met", summary="Good."), ev)[1]
    assert "at least 2" in turn.validate(call("advance_plan", outcome="skipped", summary="Moving on."), ev)[1]
    s.plan.record(False)
    assert turn.validate(call("advance_plan", outcome="skipped", summary="Moving on."), ev) == (True, None)
    assert "revise_plan" in turn.validate(call("offer_drill", drill_id="brake_release",
                                               target={"release_s": 0.5}, cue="Ease off."), ev)[1]
    assert "not allowed on the evaluate turn" in turn.validate(call("set_plan", goals=[]), ev)[1]
    assert turn.validate(call("end_session", summary="Good session."), ev) == (True, None)
    # a number from a tool result may be quoted in the summary
    res = turn.run(NS(name="get_splits", arguments={"attempt_id": ev["attempt_id"]}, id=None), 1)
    lost = next(x["delta_s"] for x in res["sectors"] if x["delta_s"])
    assert turn.validate(call("end_session", summary=f"You lost {abs(lost)} s."), ev)[0]
    assert not turn.validate(call("end_session", summary="You lost 9.87 s."), ev)[0]


async def test_in_a_row_needs_two(session, corner):
    s, p = session
    s.plan = Plan.from_goals([{"drill_id": "brake_point", "target": {"marker_m": 86},
                               "cue": "Brake at the 86 m board.", "in_a_row": 2}])
    a = s.runs[p["attempt_id"]]["attempt"]
    ev = build_packet(a, s.reference, a, corner, DrillState("brake_point", {"marker_m": 86}, 1), a)
    s.plan.record(True)
    turn = s.turn(ev, "evaluate")
    call = NS(name="advance_plan", arguments={"attempt_id": ev["attempt_id"], "outcome": "met",
                                              "summary": "Good."}, id=None)
    assert "needs 2" in turn.validate(call, ev)[1]
    s.plan.record(True)
    assert turn.validate(call, ev) == (True, None)


# ---------------------------------------------------------------- coach: full session in the simulator
async def run_session(corner, ref, tmp_path, providers=(), laps=7):
    spk = SilentSpeaker()
    src = SimSource(corner, realtime=False, laps=True, lap_gap_s=8.0, brake_board_m=86, release_s=0.15)
    app = CoachApp(corner, ref, src, list(providers), reset_mode="manual", data_dir=tmp_path / "d",
                   trace_dir=tmp_path / "t", sound=False, countdown=0, persist_checkpoint=False,
                   mode="lap", speaker=spk, agent=True,
                   announcer_kwargs={"runner": lambda fn: fn(), "clock": lambda: src.t})
    await app.start()
    try:
        await app.wait_for(lambda: any(e["type"] == "decision" and e["action"] == "end_drill"
                                       for e in app.events), 60)
    finally:
        await app.stop()
    return app, spk


async def test_rules_session_plan_goal1_goal2_end(corner, ref, tmp_path):
    app, spk = await run_session(corner, ref, tmp_path)
    ds = [e for e in app.events if e["type"] == "decision"]
    assert ds[0]["plan_action"] == "set_plan"
    assert [g["drill_id"] for g in ds[0]["plan"]["goals"]] == ["brake_point", "brake_release"]
    adv = [d for d in ds if d["plan_action"] == "advance_plan"]
    assert adv[0]["action"] == "offer_drill" and adv[0]["drill_id"] == "brake_release"
    assert ds[-1]["action"] == "end_drill"
    final = ds[-1]["plan"]
    assert [g["status"] for g in final["goals"]] == ["done", "done"] and final["finished"]
    assert any(e["type"] == "plan" for e in app.events)
    assert app.snapshot()["plan"] is None or app.snapshot()["plan"]["finished"]
    # spoken: the verdict, then the next goal's cue
    i = spk.said.index("On target. Keep that.")
    assert spk.said[i + 1] == "Ease off the brake slower as you turn in."


async def test_nemotron_session_with_tools(corner, ref, tmp_path):
    """Scripted 'model': plan turn with two reads + set_plan; evaluate turns answered by rules
    (the fake runs out of steps -> bad responses -> rules), so the plan still completes."""
    class Scripted:
        name, model, available = "scripted", "scripted-model", True

        def __init__(self):
            self.turns = 0

        async def call(self, packet, mode, *, agent=None, **kw):
            from engine.models import ModelResult, ToolCall
            from engine.nemotron import ProviderError
            self.turns += 1
            if agent is None or agent.kind != "plan":
                raise ProviderError("bad_response")
            aid = packet["attempt_id"]
            agent.run(ToolCall("get_driving_profile", {"attempt_id": aid}), 1)
            agent.run(ToolCall("get_splits", {"attempt_id": aid, "vs": "reference"}), 2)
            goals = [{"drill_id": "brake_point", "target": {"marker_m": 100},
                      "cue": "Brake at the 100 m board.", "reminder": "Brake earlier."}]
            return ModelResult(call=ToolCall("set_plan", {"attempt_id": aid, "goals": goals}),
                               reasoning="profile then splits", model=self.model)

        async def warm(self):
            return 1.0

    app, spk = await run_session(corner, ref, tmp_path, providers=[Scripted()])
    ds = [e for e in app.events if e["type"] == "decision"]
    assert ds[0]["mode"] == "think" and ds[0]["plan_action"] == "set_plan"
    assert [c["name"] for c in ds[0]["tool_calls"]] == ["get_driving_profile", "get_splits"]
    tools = [e for e in app.events if e["type"] == "tool_call"]
    assert [t["name"] for t in tools[:2]] == ["get_driving_profile", "get_splits"]
    assert spk.said[0] == "Brake at the 100 board."
    assert ds[-1]["action"] == "end_drill" and ds[-1]["plan"]["goals"][0]["status"] == "done"
