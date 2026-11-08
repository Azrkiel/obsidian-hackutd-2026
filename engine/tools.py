"""Tool schemas (OpenAI function-tool format) and call validation."""
from __future__ import annotations

import math
import re
from typing import Any

from .models import ToolCall

END_REASONS = ["no_coaching_needed", "drill_complete", "no_progress", "not_comparable", "invalid_run"]
DRILLS = ["brake_point", "throttle_pickup"]
MAX_CUE_WORDS = 20


def _fn(name: str, desc: str, props: dict, required: list[str]) -> dict:
    return {"type": "function", "function": {
        "name": name, "description": desc,
        "parameters": {"type": "object", "properties": props, "required": required}}}


TOOLS: list[dict] = [
    _fn("get_attempt_evidence", "Fetch the evidence packet for an attempt.",
        {"attempt_id": {"type": "string"}}, ["attempt_id"]),
    _fn("offer_drill", "Offer one coaching drill (or a repeat/adjust after a retry).",
        {"attempt_id": {"type": "string"},
         "drill_id": {"type": "string", "enum": DRILLS},
         "target": {"type": "object", "properties": {
             "marker_m": {"type": "number"}, "peak_brake": {"type": "number"}}},
         "cue": {"type": "string", "description": "Under 20 words, an action at a visible marker."},
         "verdict": {"type": "string", "enum": ["repeat", "adjust"]}},
        ["attempt_id", "drill_id", "target", "cue"]),
    _fn("end_drill", "Finish or decline coaching.",
        {"attempt_id": {"type": "string"},
         "reason": {"type": "string", "enum": END_REASONS},
         "summary": {"type": "string"}},
        ["attempt_id", "reason", "summary"]),
]
TOOL_NAMES = {t["function"]["name"] for t in TOOLS}

_NUM = re.compile(r"\d+(?:\.\d+)?")


def numeric_leaves(obj: Any) -> set[float]:
    """All numbers in a packet: raw, absolute, rounded to 0 and 1 decimals."""
    out: set[float] = set()

    def add(x: float) -> None:
        for v in (x, abs(x)):
            out.add(round(v, 6))
            out.add(float(round(v, 1)))
            out.add(float(round(v)))
            out.add(float(math.floor(v + 0.5)))  # half-up

    def walk(o: Any) -> None:
        if isinstance(o, bool):
            return
        if isinstance(o, (int, float)):
            add(float(o))
        elif isinstance(o, dict):
            for v in o.values():
                walk(v)
        elif isinstance(o, (list, tuple)):
            for v in o:
                walk(v)

    walk(obj)
    return out


def _is_num(x: Any) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def validate(call: ToolCall | None, packet: dict) -> tuple[bool, str | None]:
    """Check a tool call against the packet. Returns (ok, reason)."""
    if call is None:
        return False, "no tool call"
    if call.name not in TOOL_NAMES:
        return False, f"unknown tool {call.name}"
    a = call.arguments
    if not isinstance(a, dict):
        return False, "arguments not an object"
    if a.get("attempt_id") != packet["attempt_id"]:
        return False, f"attempt_id must be {packet['attempt_id']}"
    if call.name == "get_attempt_evidence":
        return True, None
    if call.name == "end_drill":
        if a.get("reason") not in END_REASONS:
            return False, f"reason must be one of {END_REASONS}"
        return True, None
    return _validate_offer(a, packet)


def _validate_offer(a: dict, packet: dict) -> tuple[bool, str | None]:
    allowed = packet["allowed"]
    drill_id = a.get("drill_id")
    if drill_id not in allowed["drills"]:
        return False, f"drill_id {drill_id} not allowed"
    retry = packet["phase"] == "retry"
    if not packet["valid"]:
        # a retry with an invalid run may only repeat the same drill/target
        same = retry and packet.get("drill") and drill_id == packet["drill"]["id"] \
            and a.get("target") == packet["drill"]["target"]
        if not same:
            return False, "run invalid: can only repeat the same drill and target"
    elif not packet["comparable"]:
        return False, "not comparable: cannot offer a drill"
    verdict = a.get("verdict")
    if verdict is not None:
        if verdict not in ("repeat", "adjust"):
            return False, "verdict must be repeat or adjust"
        if not retry:
            return False, "verdict not allowed on a baseline"
    target = a.get("target")
    if not isinstance(target, dict) or "marker_m" not in target:
        return False, "target must be an object with marker_m"
    for k, v in target.items():
        rng = allowed[drill_id].get(k)
        if rng is None:
            return False, f"unknown target key {k}"
        if not _is_num(v) or not (rng[0] <= v <= rng[1]):
            return False, f"target {k} must be within {rng}"
    cue = a.get("cue")
    if not isinstance(cue, str) or not cue.strip():
        return False, "cue empty"
    if len(cue.split()) > MAX_CUE_WORDS:
        return False, f"cue over {MAX_CUE_WORDS} words"
    known = numeric_leaves(packet)
    for m in _NUM.findall(cue):
        if round(float(m), 6) not in known:
            return False, f"cue number {m} not in evidence"
    return True, None
