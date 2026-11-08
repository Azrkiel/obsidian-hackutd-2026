"""Coach state machine: IDLE -> DECIDING -> OFFERED -> AWAIT_RESET -> RETRY -> ... -> DONE."""
from __future__ import annotations

from typing import Any, Awaitable, Callable

from . import ladder
from .models import Attempt, CornerConfig, Decision, DrillState
from .evidence import build_packet
from .rules import rule_decide

IDLE, DECIDING, OFFERED, AWAIT_RESET, RETRY, DONE = (
    "IDLE", "DECIDING", "OFFERED", "AWAIT_RESET", "RETRY", "DONE")


class Coach:
    def __init__(self, corner: CornerConfig, reference: Attempt, providers: list,
                 emit: Callable[[dict], None],
                 request_reset: Callable[[str], Awaitable[None]],
                 trace: Any = None, live_cue: Any = None,
                 decide_kwargs: dict | None = None):
        self.corner, self.reference, self.providers = corner, reference, providers
        self.emit, self.request_reset = emit, request_reset
        self.trace, self.live_cue = trace, live_cue
        self.decide_kwargs = decide_kwargs or {}
        self.state = IDLE
        self.baseline: Attempt | None = None
        self.previous: Attempt | None = None
        self.drill: DrillState | None = None
        self.offer: Decision | None = None
        self.last_decision: Decision | None = None
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

    def reset_session(self) -> None:
        self.baseline = self.previous = self.drill = self.offer = None
        self._skip_cue_once = False
        if self.live_cue:
            self.live_cue.disarm()
        self._set(IDLE)

    # -- events --
    async def on_scored(self, attempt: Attempt) -> None:
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
                              self.drill if retry else None, self.previous)
        if retry and self.live_cue and packet["target_gap"]:
            key, gap = next(iter(packet["target_gap"].items()))
            self.live_cue.on_run_scored(attempt, gap, self.corner.tolerance[key])
            self.emit({"type": "cue_disarmed"})
        self._set(DECIDING)
        aid = attempt.attempt_id

        def thinking(text: str) -> None:
            self.emit({"type": "thinking", "attempt_id": aid, "text": text})

        try:
            decision, rungs = await ladder.decide(packet, self.providers, on_reasoning=thinking,
                                                  **self.decide_kwargs)
        except Exception as e:  # noqa: BLE001 - never leave the coach stuck in DECIDING
            decision, rungs = rule_decide(packet), [{
                "provider": None, "mode": "rules", "outcome": "ok", "latency_ms": 0.0,
                "reason": f"ladder crashed: {e!r}"}]
        self.previous = attempt
        self.last_decision = decision
        if self.trace:
            self.trace.write(decision, packet, rungs)
        self.emit({"type": "decision", **decision.to_dict(), "rungs": rungs})
        if decision.action == "offer_drill":
            self.drill = DrillState(decision.drill_id, dict(decision.target or {}),
                                    self.drill.tries if retry and self.drill else 0)
            self.offer = decision
            self._set(OFFERED)
        else:
            self.offer = None
            self._set(DONE)

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
        if self.live_cue and not self._skip_cue_once:
            self.live_cue.arm(self.offer.drill_id, self.offer.target)
            self.emit({"type": "cue_armed", "drill_id": self.offer.drill_id,
                       "target": self.offer.target})
        self._skip_cue_once = False
