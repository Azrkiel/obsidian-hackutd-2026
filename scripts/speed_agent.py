"""Speed test for agent mode (step 7): multi-round tool turns against a live Nemotron.

Usage:
  uv run python scripts/speed_agent.py [--n 10] [--provider brev|nvidia|openrouter] [--transport tools|json]
  uv run python scripts/speed_agent.py --fake      # offline check of the script itself

Builds a session from simulated laps (reference: 100 m board, 0.55 s release; baseline: 86 m board,
snapped release), then runs N plan turns and N evaluate turns. Each turn may make up to 3 rounds
of read-tool calls and must end in one valid action. Reports rounds per turn, time per model
round, total time per turn, and the valid-action rate. Done (plan doc, step 7): at least 9 of 10
turns end in a valid action, and turns fit the budget (plan 15 s, evaluate 10 s; 8 s in lap mode).
"""
from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import sys
import time
from pathlib import Path
from types import SimpleNamespace as NS

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from coach.scorer import CornerScorer  # noqa: E402
from coach.telemetry import SimSource  # noqa: E402
from engine.agent_tools import AgentSession  # noqa: E402
from engine.config import load_corner  # noqa: E402
from engine.evidence import build_packet  # noqa: E402
from engine.models import DrillState  # noqa: E402
from engine.nemotron import NemotronProvider, ProviderConfig, ProviderError, default_providers  # noqa: E402
from engine.plan import Plan  # noqa: E402
from engine.state import VOICE_LIMITS  # noqa: E402

BUDGET_S = {"plan": 15.0, "evaluate": 10.0}


async def sim_lap(corner, board: float, release: float, onset_shift: float = 0.0):
    out = []
    sc = CornerScorer(corner, lambda a, t: out.append((a, t)))
    src = SimSource(corner, realtime=False, brake_board_m=board, release_s=release)
    async for s in src.samples():
        sc.add(s)
        if out:
            break
    src.stop()
    return out[0]


async def build_session(corner, voice: bool):
    ref, ref_t = await sim_lap(corner, 100, 0.55)
    ref.attempt_id = "ref"
    base, base_t = await sim_lap(corner, 86, 0.15)
    retry, retry_t = await sim_lap(corner, 94, 0.15)
    base.attempt_id, retry.attempt_id = "a-0001", "a-0002"
    s = AgentSession(corner, ref, ref_t)
    s.add_run(base, base_t)
    s.baseline_id = base.attempt_id
    v = dict(VOICE_LIMITS) if voice else None
    plan_p = build_packet(base, ref, base, corner, None, None, voice=v)
    plan_p.update(turn="plan", plan=None, history=[])
    return s, ref, base, (retry, retry_t), plan_p, v


def eval_packet(s: AgentSession, corner, ref, base, retry, v):
    a, t = retry
    if a.attempt_id not in s.runs:
        s.add_run(a, t)
    s.plan = Plan.from_goals([
        {"drill_id": "brake_point", "target": {"marker_m": 100}, "cue": "Brake at the 100 m board."},
        {"drill_id": "brake_release", "target": {"release_s": 0.5}, "cue": "Ease off the brake slower."}])
    p = build_packet(a, ref, base, corner, DrillState("brake_point", {"marker_m": 100}, 1), base, voice=v)
    key, gap = next(iter(p["target_gap"].items()))
    s.plan.record(abs(gap) <= corner.tolerance[key])
    g = s.plan.goal
    p.update(turn="evaluate", history=[], plan={**s.plan.to_dict(corner.tolerance), "active_goal": {
        "drill_id": g.drill_id, "target": g.target, "in_a_row": g.in_a_row, "streak": g.hits,
        "tries": g.tries, "title": g.title}})
    return p


class Timed:
    """Wrap a provider's model call to time each round."""

    def __init__(self, prov):
        self.prov, self.rounds = prov, []
        orig = prov._once

        async def once(*a, **kw):
            t0 = time.monotonic()
            try:
                return await orig(*a, **kw)
            finally:
                self.rounds.append((time.monotonic() - t0) * 1000)
        prov._once = once


def fake_provider() -> NemotronProvider:
    """Offline: profile -> splits -> set_plan (plan turn); compare -> offer_drill repeat (evaluate)."""
    class Client:
        def __init__(self):
            self.chat = NS(completions=NS(create=self.create))

        async def create(self, **kw):
            await asyncio.sleep(0.02)
            msgs = kw["messages"]
            packet = json.loads(msgs[1]["content"])
            aid, n = packet["attempt_id"], sum(1 for m in msgs if m["role"] == "tool")
            if packet["turn"] == "plan":
                steps = [("get_driving_profile", {"attempt_id": aid}),
                         ("get_splits", {"attempt_id": aid, "vs": "reference"}),
                         ("set_plan", {"attempt_id": aid, "goals": [
                             {"drill_id": "brake_point", "target": {"marker_m": 100},
                              "cue": "Brake at the 100 m board.", "reminder": "Brake earlier."}]})]
            else:
                steps = [("compare_runs", {"a": aid, "b": "baseline"}),
                         ("offer_drill", {"attempt_id": aid, "drill_id": "brake_point",
                                          "target": {"marker_m": 100}, "verdict": "repeat",
                                          "cue": "Closer. Again, the 100 m board.", "reminder": "Brake earlier."})]
            name, args = steps[min(n, len(steps) - 1)]
            tc = NS(index=0, id=f"c{n}", function=NS(name=name, arguments=json.dumps(args)))
            if kw.get("stream"):
                async def gen():
                    yield NS(choices=[NS(delta=NS(reasoning_content="...", content=None, tool_calls=[tc]))])
                return gen()
            return NS(choices=[NS(message=NS(content=None, reasoning_content="", tool_calls=[tc]))])

    cfg = ProviderConfig("fake", "http://fake", "NONE", "fake", {}, {}, key_required=False)
    return NemotronProvider(cfg, client=Client())


async def one_turn(prov, s, packet, kind, transport):
    timed = Timed(prov)
    turn = s.turn(packet, kind)
    t0 = time.monotonic()
    row = {"kind": kind, "valid": False, "err": "", "rounds": 0, "round_ms": [], "total_ms": 0.0}
    try:
        res = await asyncio.wait_for(prov.call(packet, "think", transport=transport, agent=turn),
                                     BUDGET_S[kind] * 2)
        ok, why = turn.validate(res.call, packet)
        row.update(valid=ok, err=why or "", action=getattr(res.call, "name", None))
    except asyncio.TimeoutError:
        row["err"] = "timeout"
    except ProviderError as e:
        row["err"] = e.kind
    except Exception as e:  # noqa: BLE001
        row["err"] = repr(e)[:60]
    row.update(total_ms=(time.monotonic() - t0) * 1000, rounds=len(turn.log), round_ms=timed.rounds,
               tools=[c["name"] for c in turn.log])
    prov._once = timed.prov.__class__._once.__get__(prov)  # unwrap
    return row


async def main_async(args) -> int:
    corner = load_corner(ROOT / "fixtures" / "corner_monza_t1.json")
    if args.fake:
        provs = [fake_provider()]
    else:
        provs = [p for p in default_providers(transport=args.transport)
                 if p.available and args.provider in (None, p.name)]
    if not provs:
        print("No provider configured (NEMOTRON_BASE_URL / NVIDIA_API_KEY / OPENROUTER_API_KEY). Nothing to do.")
        return 2
    ok_all = True
    for prov in provs:
        print(f"\n== {prov.name} ({prov.model}), transport={args.transport or prov.transport}, "
              f"voice={'on' if args.voice else 'off'} ==")
        print(f"{'turn':<9}{'valid':>6}{'rounds':>7}{'total_ms':>9}  round_ms / tools / error")
        rows = []
        for kind in ("plan", "evaluate"):
            for _ in range(args.n):
                s, ref, base, retry, plan_p, v = await build_session(corner, args.voice)
                packet = plan_p if kind == "plan" else eval_packet(s, corner, ref, base, retry, v)
                r = await one_turn(prov, s, packet, kind, args.transport)
                rows.append(r)
                print(f"{kind:<9}{str(r['valid']):>6}{r['rounds']:>7}{r['total_ms']:>9.0f}  "
                      f"{[round(x) for x in r['round_ms']]} {r['tools']} -> {r.get('action')} {r['err']}")
        for kind in ("plan", "evaluate"):
            rs = [r for r in rows if r["kind"] == kind]
            valid = sum(r["valid"] for r in rs)
            per_round = [x for r in rs for x in r["round_ms"]]
            totals = [r["total_ms"] for r in rs]
            budget = BUDGET_S[kind] * 1000
            over = sum(t > budget for t in totals)
            passed = valid >= 0.9 * len(rs) and over == 0
            ok_all &= passed
            print(f"  {kind}: valid {valid}/{len(rs)}; rounds/turn "
                  f"{statistics.mean(r['rounds'] for r in rs):.1f}; per model round p50 "
                  f"{statistics.median(per_round):.0f} ms max {max(per_round):.0f} ms; turn p50 "
                  f"{statistics.median(totals):.0f} ms max {max(totals):.0f} ms (budget {budget:.0f}, "
                  f"over {over}) -> {'PASS' if passed else 'FAIL'}")
    return 0 if ok_all else 1


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--n", type=int, default=10, help="turns of each kind (default 10)")
    ap.add_argument("--provider", choices=["brev", "nvidia", "openrouter"], default=None)
    ap.add_argument("--transport", choices=["tools", "json"], default=None)
    ap.add_argument("--voice", action="store_true", help="spoken limits in the packet (lap mode)")
    ap.add_argument("--fake", action="store_true", help="offline fake model (checks this script)")
    args = ap.parse_args()
    if not args.fake:
        try:
            import truststore
            truststore.inject_into_ssl()
        except ImportError:
            pass
    sys.exit(asyncio.run(main_async(args)))


if __name__ == "__main__":
    main()
