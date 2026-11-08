import asyncio
from pathlib import Path

import pytest

from engine.config import load_attempt, load_corner
from engine.evidence import build_packet
from engine.models import ModelResult, DrillState, ToolCall

ROOT = Path(__file__).resolve().parent.parent
FIX = ROOT / "fixtures"


@pytest.fixture
def corner():
    return load_corner(FIX / "corner_monza_t1.json")


@pytest.fixture
def ref():
    return load_attempt(FIX / "reference.json")


def attempt(name):
    return load_attempt(FIX / "attempts" / f"{name}.json")


@pytest.fixture
def mk_packet(corner, ref):
    def f(name, retry_of=None, drill="brake_point", marker=100, tries=1, previous=None):
        a = attempt(name)
        if retry_of is None:
            return build_packet(a, ref, a if a.valid else None, corner, None, None)
        base = attempt(retry_of)
        ds = DrillState(drill, {"marker_m": marker}, tries)
        return build_packet(a, ref, base, corner, ds, previous or base)
    return f


class FakeProvider:
    """Scripted provider. steps: list of dicts {call, delay, error, reasoning}."""

    def __init__(self, name="fake", steps=None, available=True):
        self.name, self.model, self.available = name, f"{name}-model", available
        self.steps = list(steps or [])
        self.calls = []

    async def call(self, packet, mode, *, on_reasoning=None, repair=None, **kw):
        self.calls.append({"mode": mode, "repair": repair})
        step = self.steps.pop(0) if self.steps else {"error": "bad_response"}
        for chunk in step.get("reasoning", []):
            if on_reasoning:
                on_reasoning(chunk)
        if step.get("delay"):
            await asyncio.sleep(step["delay"])
        if step.get("error"):
            from engine.nemotron import ProviderError
            raise ProviderError(step["error"])
        return ModelResult(call=step.get("call"), reasoning="".join(step.get("reasoning", [])),
                           latency_ms=1.0, model=self.model)

    async def warm(self):
        if self.steps and self.steps[0].get("warm_error"):
            raise RuntimeError("boom")
        return 5.0


def good_offer(packet, cue="Brake at the 100 m board; you braked 14 m later than reference."):
    return ToolCall("offer_drill", {"attempt_id": packet["attempt_id"], "drill_id": "brake_point",
                                    "target": {"marker_m": 100}, "cue": cue})


def good_end(packet, reason="no_coaching_needed"):
    return ToolCall("end_drill", {"attempt_id": packet["attempt_id"], "reason": reason, "summary": "ok"})
