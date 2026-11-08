"""Tool schemas (OpenAI function-tool format) and call validation."""
from __future__ import annotations

import math
import re
from typing import Any

from .evidence import DRILL_METRIC, DRILL_TARGET
from .models import ToolCall

END_REASONS = ["no_coaching_needed", "drill_complete", "no_progress", "not_comparable", "invalid_run"]
from .drills import DRILLS as REGISTRY, TARGET_KEYS, TARGET_PROPERTIES, eligible, target_hit
DRILLS = list(REGISTRY)
MAX_CUE_WORDS = 20
DRILL_DELTA = DRILL_METRIC


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
                    "Use the registered drill target key and packet.allowed ranges.",
                    "properties": TARGET_PROPERTIES},
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
        if a["reason"] == "drill_complete":
            dr = packet.get("drill") or {}
            spec = REGISTRY.get(dr.get("id"))
            gap = (packet.get("target_gap") or {}).get(spec.metric) if spec else None
            tol = packet["tolerance"].get(spec.metric) if spec else None
            if not packet["valid"] or not packet["comparable"] or gap is None or tol is None \
                    or not target_hit(dr["id"], gap, tol):
                return False, "target not met or missing retry evidence"
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


_FILLER = {"the", "and", "you", "your", "next", "time", "then", "with", "for", "into", "out", "this", "that",
           "board", "brake", "braking", "turn", "corner", "lap"}


def _words(s: str) -> set[str]:
    return {w for w in "".join(c.lower() if c.isalnum() else " " for c in s).split()
            if len(w) > 2 and w not in _FILLER}


def repeats(cue: str, recent: list[str], limit: float = 0.75) -> bool:
    """True when the cue is nearly the same advice as a recent action (Jaccard on content words).
    Sharing 'brake at the 100 board' is normal; repeating the whole instruction is not."""
    w = _words(cue)
    if len(w) < 2:
        return False
    return any(len(w & r) / len(w | r) >= limit for r in map(_words, recent) if r)


def _baseline_over_tolerance(packet: dict) -> str | None:
    """Same check as rules.rule_decide: on a valid, comparable baseline, name the first delta over tolerance."""
    if packet["phase"] == "retry" or not packet["valid"] or not packet["comparable"]:
        return None
    for name in DRILLS:
        if eligible(packet, name):
            return f"delta {DRILL_DELTA[name]} over tolerance"
    return None


def _validate_offer(a: dict, packet: dict) -> tuple[bool, str | None]:
    allowed = packet["allowed"]
    drill_id = a.get("drill_id")
    if not isinstance(drill_id, str) or drill_id not in REGISTRY or drill_id not in allowed["drills"]:
        return False, f"drill_id {drill_id} not allowed"
    retry = packet["phase"] == "retry"
    spec = REGISTRY[drill_id]
    if any(not packet.get("telemetry_verified", {}).get(k, False) for k in spec.requires):
        return False, "telemetry calibration required"
    if retry and packet["valid"] and spec.metric not in packet["attempt"]:
        return False, "missing retry metric"
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
    if not retry and packet["valid"] and packet["comparable"] and "event" not in packet:
        # same mapping as rules.rule_decide: only coach what is actually outside tolerance.
        # A lap event (packet["event"]) was already judged a mistake by the event detector (e.g. a
        # lock-up with a normal brake point), so any drill that addresses it is allowed.
        if not eligible(packet, drill_id):
            return False, f"{drill_id}: missing evidence, unverified telemetry, or delta inside tolerance"
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
    if "event" in packet and repeats(a.get("cue") or "", packet.get("recent_actions") or []):
        return False, "repeats a recent cue: give a different, more specific action for this corner"
    if a.get("reminder") is not None:
        if not voice:
            a.pop("reminder")  # only spoken mode uses it; harmless elsewhere
        else:
            ok, why = check_spoken(a.get("reminder"), "reminder", voice.get("max_reminder_words", 4),
                                   packet, required=False)
            if not ok:
                return False, why
    return True, None
