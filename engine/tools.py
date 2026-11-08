"""Tool schemas (OpenAI function-tool format) and call validation."""
from __future__ import annotations

import math
import re
from typing import Any

from .evidence import DRILL_METRIC, DRILL_TARGET
from .models import ToolCall

END_REASONS = ["no_coaching_needed", "drill_complete", "no_progress", "not_comparable", "invalid_run"]
DRILLS = ["brake_point", "brake_release", "throttle_pickup"]
MAX_CUE_WORDS = 20
DRILL_DELTA = DRILL_METRIC
TARGET_KEYS = {"marker_m", "peak_brake", "release_s"}


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
         "target": {"type": "object", "description":
                    "brake_point/throttle_pickup: marker_m (and peak_brake); brake_release: release_s",
                    "properties": {"marker_m": {"type": "number"}, "peak_brake": {"type": "number"},
                                   "release_s": {"type": "number"}}},
         "cue": {"type": "string", "description": "Under 20 words (voice.max_cue_words when spoken), "
                                                  "an action at a visible marker."},
         "verdict": {"type": "string", "enum": ["repeat", "adjust"]},
         "reminder": {"type": "string", "description":
                      "Spoken mode only: at most voice.max_reminder_words words, said on the approach "
                      "next lap, e.g. 'Brake earlier.'"}},
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
        if a["reason"] == "no_coaching_needed":
            over = _baseline_over_tolerance(packet)
            if over:
                return False, f"not inside tolerance: {over}; offer a drill"
        voice = packet.get("voice") or {}
        if voice:
            ok, why = check_spoken(a.get("summary"), "summary", voice.get("max_cue_words", MAX_CUE_WORDS),
                                   packet, required=True)
            if not ok:
                return False, why
        return True, None
    return _validate_offer(a, packet)


def check_spoken(text, field: str, max_words: int, packet: dict,
                 required: bool = True) -> tuple[bool, str | None]:
    """Word count and evidence-only numbers for any text the driver hears or reads."""
    if text is None or (isinstance(text, str) and not text.strip()):
        return (False, f"{field} empty") if required else (True, None)
    if not isinstance(text, str):
        return False, f"{field} must be a string"
    if len(text.split()) > max_words:
        return False, f"{field} over {max_words} words"
    known = numeric_leaves(packet)
    for m in _NUM.findall(text):
        if round(float(m), 6) not in known:
            return False, f"{field} number {m} not in evidence"
    return True, None


def _baseline_over_tolerance(packet: dict) -> str | None:
    """Same check as rules.rule_decide: on a valid, comparable baseline, name the first delta over tolerance."""
    if packet["phase"] == "retry" or not packet["valid"] or not packet["comparable"]:
        return None
    d, tol = packet["delta"], packet["tolerance"]
    for k in ("brake_onset_m", "release_s", "throttle_pickup_m"):
        if k in d and k in tol and abs(d[k]) > tol[k]:
            return f"delta {k} {d[k]} vs tolerance {tol[k]}"
    return None


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
            # Nemotron often adds a verdict to an otherwise good baseline offer: drop it, keep the offer.
            a.pop("verdict", None)
    if not retry and packet["valid"] and packet["comparable"]:
        # same mapping as rules.rule_decide: only coach what is actually outside tolerance
        key = DRILL_DELTA.get(drill_id)
        d, tol = packet["delta"], packet["tolerance"]
        if key in d and key in tol and abs(d[key]) <= tol[key]:
            return False, f"delta {key} {d[key]} is inside tolerance {tol[key]}; no {drill_id} drill"
    target = a.get("target")
    tkey = DRILL_TARGET.get(drill_id, "marker_m")
    if not isinstance(target, dict) or tkey not in target:
        return False, f"target must be an object with {tkey}"
    for k in [k for k in target if k in TARGET_KEYS and k not in allowed[drill_id]]:
        target.pop(k)  # e.g. peak_brake on a throttle_pickup drill: drop it, keep the offer
    for k, v in target.items():
        rng = allowed[drill_id].get(k)
        if rng is None:
            return False, f"unknown target key {k}"
        if not _is_num(v) or not (rng[0] <= v <= rng[1]):
            return False, f"target {k} must be within {rng}"
    voice = packet.get("voice") or {}
    ok, why = check_spoken(a.get("cue"), "cue", voice.get("max_cue_words", MAX_CUE_WORDS), packet)
    if not ok:
        return False, why
    if a.get("reminder") is not None:
        if not voice:
            a.pop("reminder")  # only spoken mode uses it; harmless elsewhere
        else:
            ok, why = check_spoken(a.get("reminder"), "reminder", voice.get("max_reminder_words", 4),
                                   packet, required=False)
            if not ok:
                return False, why
    return True, None
