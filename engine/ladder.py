"""Decision ladder: think -> repair -> fast -> next provider -> rules, with deadlines + breaker."""
from __future__ import annotations

import asyncio
import os
import time
from typing import Any, Callable

from .models import Decision, ToolCall
from .nemotron import ProviderError
from .rules import new_decision_id, rule_decide
from .tools import validate

SWITCH_KINDS = {"rate_limited", "server", "connection", "auth"}  # go to next provider
FAST_KINDS = {"timeout", "bad_response"}  # retry fast on same provider


def _env_f(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return default


def env_deadlines() -> dict[str, float]:
    return {"think_deadline_s": _env_f("ENGINE_THINK_DEADLINE_S", 6.0),
            "fast_deadline_s": _env_f("ENGINE_FAST_DEADLINE_S", 4.0),
            "total_deadline_s": _env_f("ENGINE_TOTAL_DEADLINE_S", 10.0)}


class CircuitBreaker:
    """Per-provider: `threshold` consecutive failures -> skip for `cooldown_s`."""

    def __init__(self, clock: Callable[[], float] = time.monotonic,
                 threshold: int = 3, cooldown_s: float = 60.0):
        self.clock, self.threshold, self.cooldown_s = clock, threshold, cooldown_s
        self.fails: dict[str, int] = {}
        self.opened_at: dict[str, float] = {}

    def is_open(self, name: str) -> bool:
        t = self.opened_at.get(name)
        return t is not None and self.clock() - t < self.cooldown_s

    def success(self, name: str) -> None:
        self.fails[name] = 0
        self.opened_at.pop(name, None)

    def failure(self, name: str) -> None:
        self.fails[name] = self.fails.get(name, 0) + 1
        if self.fails[name] >= self.threshold:
            self.opened_at[name] = self.clock()


DEFAULT_BREAKER = CircuitBreaker()


def _to_decision(call: ToolCall, packet: dict, mode: str, prov: Any, latency_ms: float,
                 reasoning: str) -> Decision:
    a = call.arguments
    d = Decision(new_decision_id(), packet["attempt_id"], call.name, mode=mode,
                 provider=prov.name, model=getattr(prov, "model", None),
                 latency_ms=round(latency_ms, 1), reasoning=reasoning)
    if call.name == "offer_drill":
        d.drill_id, d.target = a.get("drill_id"), a.get("target")
        d.cue, d.verdict = a.get("cue", ""), a.get("verdict")
        d.reminder = a.get("reminder") or ""
        d.summary = d.cue
    else:
        d.end_reason, d.summary = a.get("reason"), a.get("summary", "")
    return d


def _check(call: ToolCall | None, packet: dict) -> tuple[bool, str | None]:
    if call is not None and call.name == "get_attempt_evidence":
        return False, "call offer_drill or end_drill, not get_attempt_evidence"
    return validate(call, packet)


async def decide(packet: dict, providers: list, *, on_reasoning: Callable[[str], None] | None = None,
                 think_deadline_s: float | None = None, fast_deadline_s: float | None = None,
                 total_deadline_s: float | None = None, breaker: CircuitBreaker | None = None,
                 transport: str | None = None) -> tuple[Decision, list[dict]]:
    """Return (Decision, rungs). Never raises for provider problems; falls back to rules."""
    env = env_deadlines()
    think_s = env["think_deadline_s"] if think_deadline_s is None else think_deadline_s
    fast_s = env["fast_deadline_s"] if fast_deadline_s is None else fast_deadline_s
    total_s = env["total_deadline_s"] if total_deadline_s is None else total_deadline_s
    breaker = breaker or DEFAULT_BREAKER
    loop = asyncio.get_running_loop()
    start = loop.time()
    rungs: list[dict] = []

    def remaining() -> float:
        return total_s - (loop.time() - start)

    async def run(prov: Any, mode: str, limit: float, repair=None):
        """One model call. Returns (call, reasoning, latency_ms, error_kind|None)."""
        t0 = loop.time()
        timeout = min(limit, remaining())
        kw: dict[str, Any] = dict(on_reasoning=on_reasoning, repair=repair)
        if transport:
            kw["transport"] = transport
        try:
            res = await asyncio.wait_for(prov.call(packet, mode, **kw), timeout)
            return res.call, res.reasoning, (loop.time() - t0) * 1000, None
        except asyncio.TimeoutError:
            return None, "", (loop.time() - t0) * 1000, "timeout"
        except ProviderError as e:
            return None, "", (loop.time() - t0) * 1000, e.kind
        except Exception:  # noqa: BLE001 - a buggy provider must not kill the coach
            return None, "", (loop.time() - t0) * 1000, "bad_response"

    def rung(prov: Any, mode: str, outcome: str, ms: float = 0.0, reason: str | None = None) -> None:
        rungs.append({"provider": getattr(prov, "name", None), "mode": mode, "outcome": outcome,
                      "latency_ms": round(ms, 1), "reason": reason})

    def rules(why: str) -> tuple[Decision, list[dict]]:
        d = rule_decide(packet)
        rung(None, "rules", "ok", 0.0, why)
        return d, rungs

    for prov in providers:
        if remaining() <= 0:
            return rules("total deadline exhausted")
        if not getattr(prov, "available", True):
            rung(prov, "think", "skipped", reason="not configured")
            continue
        if breaker.is_open(prov.name):
            rung(prov, "think", "skipped", reason="circuit open")
            continue

        # --- think ---
        call, reasoning, ms, err = await run(prov, "think", think_s)
        if err is None:
            ok, why = _check(call, packet)
            rung(prov, "think", "ok" if ok else "rejected", ms, why)
            if ok:
                breaker.success(prov.name)
                return _to_decision(call, packet, "think", prov, ms, reasoning), rungs
            # --- repair (fast) ---
            if remaining() <= 0:
                breaker.failure(prov.name)
                return rules("total deadline exhausted")
            call2, _, ms2, err2 = await run(prov, "fast", fast_s,
                                            repair=(call, why) if call is not None else None)
            if err2 is None:
                ok2, why2 = _check(call2, packet)
                rung(prov, "fast", "ok" if ok2 else "rejected", ms2, why2)
                if ok2:
                    breaker.success(prov.name)
                    # keep the think-mode reasoning: it explains the (repaired) decision
                    return _to_decision(call2, packet, "fast", prov, ms2, reasoning), rungs
                breaker.failure(prov.name)
                return rules("model output rejected twice")
            rung(prov, "fast", "error", ms2, err2)
            breaker.failure(prov.name)
            continue
        rung(prov, "think", "error", ms, err)
        if err in FAST_KINDS and remaining() > 0:
            call2, _, ms2, err2 = await run(prov, "fast", fast_s)
            if err2 is None:
                ok2, why2 = _check(call2, packet)
                rung(prov, "fast", "ok" if ok2 else "rejected", ms2, why2)
                if ok2:
                    breaker.success(prov.name)
                    return _to_decision(call2, packet, "fast", prov, ms2, ""), rungs
                if remaining() <= 0:
                    breaker.failure(prov.name)
                    return rules("total deadline exhausted")
                # one repair on fast
                call3, _, ms3, err3 = await run(prov, "fast", fast_s,
                                                repair=(call2, why2) if call2 is not None else None)
                if err3 is None:
                    ok3, why3 = _check(call3, packet)
                    rung(prov, "fast", "ok" if ok3 else "rejected", ms3, why3)
                    if ok3:
                        breaker.success(prov.name)
                        return _to_decision(call3, packet, "fast", prov, ms3, ""), rungs
                    breaker.failure(prov.name)
                    return rules("model output rejected twice")
                rung(prov, "fast", "error", ms3, err3)
            else:
                rung(prov, "fast", "error", ms2, err2)
        breaker.failure(prov.name)
        # SWITCH_KINDS and exhausted FAST_KINDS both move on to the next provider

    return rules("no provider produced a valid decision")


async def warm_up(providers: list) -> dict[str, float | None]:
    """One max_tokens=1 call per available provider. Errors swallowed."""
    avail = [p for p in providers if getattr(p, "available", True)]

    async def one(p: Any) -> float | None:
        try:
            return await p.warm()
        except Exception:  # noqa: BLE001
            return None

    res = await asyncio.gather(*(one(p) for p in avail))
    return {p.name: r for p, r in zip(avail, res)}
