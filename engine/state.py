"""Coach state machine: IDLE -> DECIDING -> OFFERED -> AWAIT_RESET -> RETRY -> ... -> DONE."""
from __future__ import annotations

import os
from typing import Any, Awaitable, Callable

from . import ladder
from .models import Attempt, CornerConfig, Decision, DrillState
from .evidence import DRILL_METRIC, build_packet
from .plan import Plan, rule_plan
from .rules import reminder_for, rule_decide

VOICE_LIMITS = {"max_cue_words": 12, "max_reminder_words": 4}


def _env_f(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return default


def agent_deadlines() -> dict[str, dict[str, float]]:
    """Plan turn: once, while the driver slows after the baseline. Evaluate turns keep 10 s."""
    return {"plan": {"think_deadline_s": _env_f("ENGINE_PLAN_THINK_S", 12.0),
                     "total_deadline_s": _env_f("ENGINE_PLAN_TOTAL_S", 15.0)},
            "evaluate": {"think_deadline_s": _env_f("ENGINE_EVAL_THINK_S", 8.0),
                         "total_deadline_s": _env_f("ENGINE_EVAL_TOTAL_S", 10.0)}}

IDLE, DECIDING, OFFERED, AWAIT_RESET, RETRY, DONE = (
    "IDLE", "DECIDING", "OFFERED", "AWAIT_RESET", "RETRY", "DONE")


class Coach:
    def __init__(self, corner: CornerConfig, reference: Attempt, providers: list,
                 emit: Callable[[dict], None],
                 request_reset: Callable[[str], Awaitable[None]],
                 trace: Any = None, live_cue: Any = None,
                 decide_kwargs: dict | None = None, lap_mode: bool = False,
                 voice: dict | None = None, agent: Any = None):
        self.corner, self.reference, self.providers = corner, reference, providers
        self.emit, self.request_reset = emit, request_reset
        self.trace, self.live_cue = trace, live_cue
        self.decide_kwargs = decide_kwargs or {}
        # lap mode: no Accept, no reset; the next lap through the corner is the retry
        self.lap_mode = lap_mode
        self.voice = voice if voice is not None else (dict(VOICE_LIMITS) if lap_mode else None)
        # agent mode (engine.agent_tools.AgentSession): tool loop + session plan
        self.agent = agent
        self.agent_deadlines = agent_deadlines()
        self.state = IDLE
        self.baseline: Attempt | None = None
        self.previous: Attempt | None = None
        self.drill: DrillState | None = None
        self.offer: Decision | None = None
        self.last_decision: Decision | None = None
        self.last_packet: dict | None = None   # evidence behind last_decision (whole-lap: deeper analysis)
        self._skip_cue_once = False

    # -- helpers --
    def _set(self, state: str) -> None:
        self.state = state
        self.emit({"type": "status", "state": state})

    def _ignored(self, why: str) -> None:
        self.emit({"type": "status", "state": self.state, "message": f"ignored: {why}"})

    def disable_cue_next_try(self) -> None:
        """Skip arming the live cue on the next retry only."""
        self._skip_cue_once = True

    def toggle_cue_next_try(self) -> bool:
        """Flip the skip-cue-once flag; returns the new value."""
        self._skip_cue_once = not self._skip_cue_once
        return self._skip_cue_once

    def plan_dict(self) -> dict | None:
        if self.agent is None or self.agent.plan is None:
            return None
        return self.agent.plan.to_dict(self.corner.tolerance)

    def set_corner(self, corner: CornerConfig, reference: Attempt) -> bool:
        """Coach another corner (whole-lap mode). Only between drills: a drill belongs to one corner."""
        if self.state not in (IDLE, DONE):
            self._ignored(f"cannot change corner in {self.state}")
            return False
        self.corner, self.reference = corner, reference
        if self.live_cue:
            self.live_cue.corner = corner
        self.reset_session()
        return True

    def reset_session(self) -> None:
        if self.agent is not None:
            self.agent.reset()
        self.baseline = self.previous = self.drill = self.offer = None
        self._skip_cue_once = False
        if self.live_cue:
            self.live_cue.disarm()
        self._set(IDLE)

    # -- events --
    async def on_scored(self, attempt: Attempt, trace: list | None = None,
                        context: dict | None = None) -> None:
        """context: extra evidence merged into the packet (e.g. {"inputs": {...}} from the input hub)."""
        if self.state == DECIDING:
            return self._ignored("decision in flight")
        if self.state not in (IDLE, RETRY):
            return self._ignored(f"not accepting attempts in {self.state}")
        retry = self.state == RETRY
        if retry:
            self.drill.tries += 1
        elif attempt.valid and self.baseline is None:
            self.baseline = attempt
        packet = build_packet(attempt, self.reference, self.baseline, self.corner,
                              self.drill if retry else None, self.previous, voice=self.voice)
        if context:
            packet.update(context)
        turn = self._agent_turn(attempt, trace, packet, retry) if self.agent is not None else None
        if retry and self.live_cue and packet["target_gap"]:
            key, gap = next(iter(packet["target_gap"].items()))
            self.live_cue.on_run_scored(attempt, gap, self.corner.tolerance[key])
            self.emit({"type": "cue_disarmed"})
        self._set(DECIDING)
        aid = attempt.attempt_id

        def thinking(text: str) -> None:
            self.emit({"type": "thinking", "attempt_id": aid, "text": text})

        dk = dict(self.agent_deadlines[turn.kind]) if turn is not None else {}
        dk.update(self.decide_kwargs)  # explicit settings win (lap mode caps the total at 8 s)
        try:
            decision, rungs = await ladder.decide(packet, self.providers, on_reasoning=thinking,
                                                  agent=turn, **dk)
        except Exception as e:  # noqa: BLE001 - never leave the coach stuck in DECIDING
            decision, rungs = rule_decide(packet), [{
                "provider": None, "mode": "rules", "outcome": "ok", "latency_ms": 0.0,
                "reason": f"ladder crashed: {e!r}"}]
        if turn is not None:
            decision.tool_calls = list(turn.log)
            decision = self._apply_plan(decision, packet, turn.kind)
            self.agent.note({"attempt_id": aid, "phase": packet["phase"], "valid": packet["valid"],
                             "target_gap": packet["target_gap"], "action": decision.action,
                             "plan_action": decision.plan_action, "drill_id": decision.drill_id,
                             "verdict": decision.verdict, "end_reason": decision.end_reason,
                             "said": decision.cue if decision.action == "offer_drill" else decision.summary,
                             "mode": decision.mode})
        self.previous = attempt
        self.last_decision, self.last_packet = decision, packet
        if self.trace:
            self.trace.write(decision, packet, rungs)
        self.emit({"type": "decision", **decision.to_dict(), "rungs": rungs})
        if turn is not None:
            self.emit({"type": "plan", "plan": self.plan_dict()})
        if decision.action == "offer_drill":
            same_goal = retry and self.drill and decision.plan_action is None
            self.drill = DrillState(decision.drill_id, dict(decision.target or {}),
                                    self.drill.tries if same_goal else 0)
            self.offer = decision
            if self.lap_mode:
                if not decision.reminder:
                    decision.reminder = self._default_reminder(packet, decision.drill_id)
                self._set(RETRY)
                self._arm_cue(wait_wrap=True)
            else:
                self._set(OFFERED)
        else:
            self.offer = None
            self._set(DONE)

    def restore_offer(self, decision: Decision) -> bool:
        """Re-open an earlier offer_drill (whole-lap: retry an error from the history)."""
        if self.state not in (IDLE, DONE) or decision.action != "offer_drill":
            return False
        self.drill = DrillState(decision.drill_id, dict(decision.target or {}), 0)
        self.offer = self.last_decision = decision
        self._set(OFFERED)
        return True

    async def on_accept(self, decision_id: str) -> None:
        if self.state != OFFERED or self.offer is None or self.offer.decision_id != decision_id:
            return self._ignored("accept does not match the current offer")
        self._set(AWAIT_RESET)
        try:
            await self.request_reset(decision_id)
        except Exception as e:  # noqa: BLE001
            self._set(OFFERED)
            self.emit({"type": "status", "state": self.state, "message": f"reset failed: {e!r}"})

    def on_reset_confirmed(self) -> None:
        if self.state != AWAIT_RESET or self.offer is None:
            return self._ignored("reset confirmed outside AWAIT_RESET")
        self._set(RETRY)
        self._arm_cue(wait_wrap=False)

    def _arm_cue(self, wait_wrap: bool) -> None:
        if self.live_cue and not self._skip_cue_once:
            self.live_cue.arm(self.offer.drill_id, self.offer.target,
                              reminder=self.offer.reminder if self.lap_mode else "",
                              wait_wrap=wait_wrap)
            self.emit({"type": "cue_armed", "drill_id": self.offer.drill_id,
                       "target": self.offer.target, "reminder": self.offer.reminder})
        self._skip_cue_once = False

    @staticmethod
    def _default_reminder(packet: dict, drill_id: str) -> str:
        key = DRILL_METRIC.get(drill_id, "")
        gap = (packet.get("target_gap") or {}).get(key, packet["delta"].get(key))
        return reminder_for(drill_id, gap)

    # -- agent mode --
    def _agent_turn(self, attempt: Attempt, trace: list | None, packet: dict, retry: bool):
        ag = self.agent
        ag.add_run(attempt, trace)
        if not retry and attempt.valid and ag.baseline_id is None:
            ag.baseline_id = attempt.attempt_id
        plan = ag.plan
        kind = "evaluate" if retry and plan is not None and plan.goal is not None else "plan"
        if kind == "evaluate" and packet["target_gap"]:
            key, gap = next(iter(packet["target_gap"].items()))
            plan.record(bool(packet["valid"]) and abs(gap) <= self.corner.tolerance.get(key, 0))
        packet["turn"] = kind
        packet["plan"] = self._plan_packet()
        packet["history"] = ag.history[-5:]
        return ag.turn(packet, kind, on_tool=self.emit)

    def _plan_packet(self) -> dict | None:
        plan = self.agent.plan
        if plan is None:
            return None
        d = plan.to_dict(self.corner.tolerance)
        g = plan.goal
        d["active_goal"] = None if g is None else {
            "drill_id": g.drill_id, "target": g.target, "in_a_row": g.in_a_row, "streak": g.hits,
            "tries": g.tries, "title": g.title}
        return d

    def _offer_goal(self, d: Decision, plan_action: str) -> Decision:
        g = self.agent.plan.goal
        d.action, d.drill_id, d.target = "offer_drill", g.drill_id, dict(g.target)
        d.cue, d.reminder, d.verdict, d.end_reason = g.cue, g.reminder, None, None
        d.plan_action = plan_action
        return d

    def _apply_plan(self, d: Decision, packet: dict, kind: str) -> Decision:
        """Turn plan actions (and rules / plain offers) into offer_drill or end_drill + plan state."""
        ag, tol = self.agent, self.corner.tolerance
        if kind == "plan":
            if d.plan_action == "set_plan":
                goals = (d.plan or {}).get("goals") or []
            elif d.action == "offer_drill":
                one = [{"drill_id": d.drill_id, "target": d.target, "cue": d.cue, "reminder": d.reminder}]
                goals = (rule_plan(packet) or one) if d.mode == "rules" else one
            else:
                ag.plan, d.plan = None, None
                return d
            ag.plan = Plan.from_goals(goals, reason=d.summary if d.plan_action else "")
            d = self._offer_goal(d, "set_plan")
            d.plan = ag.plan.to_dict(tol)
            return d
        plan = ag.plan
        g = plan.goal
        if d.plan_action == "revise_plan":
            if plan.revise((d.plan or {}).get("goals") or [], d.summary) is None:
                d.action, d.end_reason = "end_drill", "session_complete"
            else:
                d = self._offer_goal(d, "revise_plan")
            d.plan = plan.to_dict(tol)
            return d
        if d.plan_action == "end_session":
            plan.finished = True
            d.action, d.end_reason, d.plan = "end_drill", "session_complete", plan.to_dict(tol)
            return d
        if d.plan_action == "advance_plan":
            met = d.end_reason == "met"
        elif d.action == "end_drill" and d.end_reason in ("drill_complete", "no_progress"):
            met = d.end_reason == "drill_complete"
            if met and g.hits < g.in_a_row:  # rules path: the goal wants more hits in a row
                d.action, d.drill_id, d.target, d.verdict = "offer_drill", g.drill_id, dict(g.target), "repeat"
                d.cue = d.summary = "On target. Once more."
                d.reminder, d.end_reason, d.plan = g.reminder, None, plan.to_dict(tol)
                return d
        elif d.action == "end_drill":  # invalid / not comparable retry: same goal again
            d.action, d.drill_id, d.target, d.verdict = "offer_drill", g.drill_id, dict(g.target), "repeat"
            d.cue = "That lap did not count. Same again."
            d.reminder, d.end_reason, d.plan = g.reminder, None, plan.to_dict(tol)
            return d
        else:  # offer_drill: repeat or adjust the active goal
            if d.verdict == "adjust" and d.target:
                g.target = dict(d.target)
            d.plan = plan.to_dict(tol)
            return d
        verdict = d.summary
        nxt = plan.advance(met)
        if nxt is None:
            d.action, d.end_reason = "end_drill", "drill_complete" if met else "no_progress"
            d.summary = verdict or "Plan complete."
            d.plan_action = "advance_plan"
        else:
            d = self._offer_goal(d, "advance_plan")
            d.summary = verdict
        d.plan = plan.to_dict(tol)
        return d
