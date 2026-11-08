"""Whole-lap coaching (W7, W9, W10): one decision per lap, on the corner that loses the most time.

TrackCoach is the single-corner Coach pointed, one lap at a time, at the corner being coached
("focus"): it swaps in that corner's config, reference, baseline, previous run and live cue, then runs
the normal Coach decision (rules, model ladder, agent tool loop, plan bookkeeping). So every drill,
validator and rules cue works unchanged per corner.

- Baseline lap (no plan yet): focus = the top corner by time lost that has a metric over tolerance.
  Agent mode plans 1 to 3 goals keyed by (corner_id, drill_id); rules plan one goal per top corner.
- Retry laps: focus = the active goal's corner. If that corner did not score this lap, the goal and
  its cue carry over to the next lap.
- One change at a time: only the active goal's corner has a live cue, armed for the next lap.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Awaitable, Callable

from .evidence import build_packet, focus_corner, lap_summary
from .models import Attempt, CornerConfig, Decision, Track
from .plan import MAX_GOALS, rule_plan
from .state import DECIDING, DONE, RETRY, Coach
from .track_agent import TrackAgentSession


@dataclass
class CornerCtx:
    corner: CornerConfig
    reference: Attempt
    reference_trace: list
    live_cue: Any = None
    baseline: Attempt | None = None
    previous: Attempt | None = None


async def _no_reset(decision_id: str) -> None:  # lap mode never resets the car
    return None


class TrackCoach(Coach):
    def __init__(self, track: Track, references: dict[str, tuple[Attempt, list]], providers: list,
                 emit: Callable[[dict], None], live_cues: dict[str, Any] | None = None,
                 trace: Any = None, decide_kwargs: dict | None = None, voice: dict | None = None,
                 agent: bool = False, lap_now: Callable[[], int] | None = None,
                 request_reset: Callable[[str], Awaitable[None]] = _no_reset):
        missing = [c.id for c in track.corners if c.id not in references]
        if missing:
            raise ValueError(f"no reference for corners {missing}")
        self.track = track
        cues = live_cues or {}
        self.ctx = {c.id: CornerCtx(c, references[c.id][0], references[c.id][1] or [], cues.get(c.id))
                    for c in track.corners}
        first = track.corners[0]
        super().__init__(first, references[first.id][0], providers, emit, request_reset, trace=trace,
                         live_cue=cues.get(first.id), decide_kwargs=decide_kwargs, lap_mode=True,
                         voice=voice, agent=TrackAgentSession(track, references) if agent else None)
        self.focus_id = first.id
        self.lap_now = lap_now
        self.last_lap: dict | None = None      # lap summary of the last lap decided on
        self.packets: dict[str, dict] = {}     # this lap's baseline-phase packet per corner
        self._decided_lap: int | None = None

    # -- focus --
    def _focus(self, cid: str) -> None:
        """Load a corner into the Coach fields. The ctx is the source of truth; _sync_focus writes back."""
        c = self.ctx[cid]
        self.focus_id = cid
        self.corner, self.reference, self.live_cue = c.corner, c.reference, c.live_cue
        self.baseline, self.previous = c.baseline, c.previous
        if self.agent is not None:
            self.agent.focus(cid)

    def _sync_focus(self) -> None:
        c = self.ctx[self.focus_id]
        c.baseline, c.previous = self.baseline, self.previous

    def set_reference(self, corner_id: str, reference: Attempt, trace: list | None) -> None:
        c = self.ctx[corner_id]
        c.reference, c.reference_trace = reference, trace or []
        if corner_id == self.focus_id:
            self.reference = reference
        if self.agent is not None:
            self.agent.set_reference(reference, trace, corner_id)

    def reset_session(self) -> None:
        for c in self.ctx.values():
            c.baseline = c.previous = None
            if c.live_cue:
                c.live_cue.disarm()
        self.baseline = self.previous = None
        self.last_lap = None
        super().reset_session()

    # -- one lap --
    async def on_lap(self, lap: int, runs: dict[str, tuple[Attempt, list]],
                     inputs: dict[str, dict] | None = None, lap_time_s: float | None = None) -> None:
        """runs = this lap's corners {corner_id: (attempt, trace)}; called at the last corner's exit."""
        if self.state == DECIDING:
            return self._ignored("decision in flight")
        runs = {cid: runs[cid] for cid in self.track.ids if cid in runs}
        if not runs:
            return
        if self.state == DONE:
            # plan finished (or nothing to coach): this lap is a fresh baseline
            self.reset_session()
        self._sync_focus()
        attempts = {cid: a for cid, (a, _) in runs.items()}
        for cid, a in attempts.items():
            c = self.ctx[cid]
            if a.valid and c.baseline is None:
                c.baseline = a
        self.packets = {cid: build_packet(a, self.ctx[cid].reference, self.ctx[cid].baseline,
                                          self.ctx[cid].corner, None, self.ctx[cid].previous, voice=self.voice)
                        for cid, a in attempts.items()}
        summary = lap_summary(lap, attempts, {cid: c.reference for cid, c in self.ctx.items()},
                              self.packets, {cid: c.corner.name for cid, c in self.ctx.items()}, lap_time_s)
        self.last_lap = summary
        self.emit({"type": "lap_summary", **summary})
        retry = self.state == RETRY and self.offer is not None
        if retry:
            cid = self.offer.corner_id or self.focus_id
            if cid not in runs:
                self._save_previous(attempts)
                self.emit({"type": "status", "state": self.state,
                           "message": f"no run at {self.ctx[cid].corner.name} this lap: same goal next lap"})
                self._decided_lap = lap
                self._arm_cue(wait_wrap=True)
                return
        else:
            cid = focus_corner(summary, attempts)
        self._focus(cid)
        if not retry:
            self.baseline = self.ctx[cid].baseline
        if self.agent is not None:
            self.agent.add_lap(lap, runs, self.packets, summary)
        a, trace = runs[cid]
        nums = sorted({int(n) for c in self.ctx.values() for n in c.corner.name.split() if n.isdigit()})
        context: dict = {"corner_id": cid, "corner_name": self.corner.name, "lap": summary}
        if nums:
            context["corner_numbers"] = nums  # "Lesmo 2" may be said in a cue
        if inputs and inputs.get(cid):
            context["inputs"] = inputs[cid]
        self._decided_lap = lap
        await self.on_scored(a, trace, context)
        self._sync_focus()
        self._save_previous(attempts)

    def _save_previous(self, attempts: dict[str, Attempt]) -> None:
        for cid, a in attempts.items():
            self.ctx[cid].previous = a
        self.previous = self.ctx[self.focus_id].previous

    # -- Coach hooks --
    def _annotate(self, decision: Decision, packet: dict) -> Decision:
        cid = decision.corner_id or self.focus_id
        decision.corner_id = cid
        name = self.ctx[cid].corner.name
        if decision.end_reason == "no_coaching_needed" and not (self.last_lap or {}).get("top") \
                and decision.mode == "rules":
            decision.summary = "Clean lap. Keep it up." if self.voice else "Every corner is inside tolerance."
        if decision.action == "offer_drill" and decision.cue and name.lower() not in decision.cue.lower():
            same = decision.summary == decision.cue
            decision.cue = f"{name}: {decision.cue}"
            if same:
                decision.summary = decision.cue
        return decision

    def _rule_goals(self, packet: dict) -> list[dict]:
        """Rules plan: the first drill over tolerance at each of the top corners, biggest time loss first."""
        goals = []
        for t in (self.last_lap or {}).get("top", []):
            gs = rule_plan(self.packets[t["corner_id"]])
            if gs:
                goals.append({**gs[0], "corner_id": t["corner_id"]})
            if len(goals) == MAX_GOALS:
                break
        return goals

    def _offer_goal(self, d: Decision, plan_action: str) -> Decision:
        g = self.agent.plan.goal
        if not g.corner_id:
            g.corner_id = self.focus_id
        d = super()._offer_goal(d, plan_action)
        d.corner_id = g.corner_id
        return d

    def _apply_plan(self, d: Decision, packet: dict, kind: str) -> Decision:
        d = super()._apply_plan(d, packet, kind)
        plan = self.agent.plan
        if plan is not None:
            plan.tolerances = {cid: c.corner.tolerance for cid, c in self.ctx.items()}
            for g in plan.goals:
                g.corner_id = g.corner_id or self.focus_id
                name = self.ctx[g.corner_id].corner.name
                if not g.title.startswith(name):
                    g.title = f"{name}: {g.title}"
            if d.plan is not None:
                d.plan = plan.to_dict(self.corner.tolerance)
        return d

    def _arm_cue(self, wait_wrap: bool) -> None:
        """One live cue per lap: the active goal's corner. Armed for the next lap, unless the car
        already crossed the line while the decision ran."""
        for c in self.ctx.values():
            if c.live_cue:
                c.live_cue.disarm()
        if self.offer is None:
            return
        cid = self.offer.corner_id or self.focus_id
        if wait_wrap and self.lap_now is not None and self._decided_lap is not None \
                and self.lap_now() > self._decided_lap:
            wait_wrap = False
        saved, self.live_cue = self.live_cue, self.ctx[cid].live_cue
        try:
            super()._arm_cue(wait_wrap)
        finally:
            self.live_cue = saved
