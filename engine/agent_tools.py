"""Agent mode: read tools over the session, plan/evaluate action tools, validation and prompt.

Each turn allows up to MAX_ROUNDS rounds of read-only tool calls, then exactly one action tool.
Plan turn (after a baseline lap): investigate, then set_plan with 1-3 goals.
Evaluate turn (after each retry): offer_drill (repeat/adjust), advance_plan, revise_plan or end_session.
"""
from __future__ import annotations

import json
import time
from typing import Any, Callable

from . import tools as base_tools
from .analysis import compare_runs, driving_profile, splits
from .evidence import DRILL_METRIC
from .models import Attempt, CornerConfig, ToolCall
from .plan import MAX_GOALS, Plan

MAX_ROUNDS = 3
PLAN_ACTIONS = ("set_plan", "end_drill", "offer_drill")
EVAL_ACTIONS = ("offer_drill", "advance_plan", "revise_plan", "end_session", "end_drill")
_fn = base_tools._fn

_GOAL = {"type": "object", "properties": {
    "drill_id": {"type": "string", "enum": base_tools.DRILLS},
    "target": {"type": "object", "properties": {"marker_m": {"type": "number"},
                                                "release_s": {"type": "number"}}},
    "cue": {"type": "string", "description": "What the driver is told for this goal (short, spoken)."},
    "reminder": {"type": "string", "description": "At most 4 words for the approach (spoken mode)."},
    "title": {"type": "string"},
    "in_a_row": {"type": "integer", "enum": [1, 2], "description": "Hits in a row to call it done."}},
    "required": ["drill_id", "target", "cue"]}

READ_TOOLS: list[dict] = [
    _fn("get_driving_profile", "Style traits with numbers for a lap: brake onset and board, peak, "
        "time to peak, release time, trail-brake share, coasting, lock-up and wheelspin time, minimum "
        "speed and where vs the apex, throttle pickup, understeer index, style label. Also the "
        "reference lap's profile for comparison.",
        {"attempt_id": {"type": "string", "description": "a lap id, or 'reference'"}}, ["attempt_id"]),
    _fn("get_splits", "Micro-sector times (approach, braking, entry, apex, exit) and the time gained "
        "(-) or lost (+) in each against vs.",
        {"attempt_id": {"type": "string"},
         "vs": {"type": "string", "enum": ["reference", "baseline", "previous"]}}, ["attempt_id"]),
    _fn("compare_runs", "Metric-by-metric differences between two laps (a minus b).",
        {"a": {"type": "string"}, "b": {"type": "string"}}, ["a", "b"]),
    _fn("get_session_history", "Laps so far, drills given, outcomes, and the plan.", {}, []),
    _fn("get_corner_info", "Brake boards, gates, apex window, tolerances and allowed drill ranges.", {}, []),
]
ACTION_TOOLS: list[dict] = [
    _fn("set_plan", "Plan turn only: write the session plan, 1 to 3 ordered goals (biggest time first). "
        "Goal 1 is offered to the driver now.",
        {"attempt_id": {"type": "string"},
         "goals": {"type": "array", "items": _GOAL, "minItems": 1, "maxItems": MAX_GOALS},
         "summary": {"type": "string", "description": "One line: why this plan."}},
        ["attempt_id", "goals"]),
    _fn("advance_plan", "Evaluate turn: close the active goal (met = inside tolerance enough times in a "
        "row; skipped = 2+ tries without getting there) and move to the next goal.",
        {"attempt_id": {"type": "string"}, "outcome": {"type": "string", "enum": ["met", "skipped"]},
         "summary": {"type": "string", "description": "Spoken verdict, e.g. 'Better, 4 m earlier.'"}},
        ["attempt_id", "outcome", "summary"]),
    _fn("revise_plan", "Evaluate turn: the plan was wrong (e.g. the real problem is the release, not the "
        "brake point). Replace the remaining goals.",
        {"attempt_id": {"type": "string"},
         "goals": {"type": "array", "items": _GOAL, "minItems": 1, "maxItems": MAX_GOALS},
         "reason": {"type": "string"}}, ["attempt_id", "goals", "reason"]),
    _fn("end_session", "Evaluate turn: close the session with a short spoken summary.",
        {"attempt_id": {"type": "string"}, "summary": {"type": "string"}}, ["attempt_id", "summary"]),
]
_BASE_ACTIONS = {t["function"]["name"]: t for t in base_tools.TOOLS if t["function"]["name"] != "get_attempt_evidence"}
_ALL_ACTIONS = {**_BASE_ACTIONS, **{t["function"]["name"]: t for t in ACTION_TOOLS}}
READ_NAMES = {t["function"]["name"] for t in READ_TOOLS} | {"get_attempt_evidence"}

AGENT_PROMPT = """You are a racing coach running a practice session on one corner of a track in a simulator. The car is a Mazda 787B: very fast, heavy downforce, an analog brake. Each turn:
- You may call read tools (get_driving_profile, get_splits, compare_runs, get_session_history, get_corner_info) for up to 3 rounds; their results come back to you.
- Then call exactly one action tool. Never answer in plain text.
Plan turn (packet.turn = "plan", after the baseline lap): look at the profile and the splits against the reference, then set_plan with 1 to 3 ordered goals, the biggest time loss first. Each goal is one drill with a target taken from packet.suggested, a cue, a reminder and in_a_row (1, or 2 for "twice in a row"). Only plan drills whose delta is over tolerance. If nothing is over tolerance, or the lap is invalid or not comparable, call end_drill.
Evaluate turn (packet.turn = "evaluate", after a retry of packet.plan.active_goal): compare the retry with the goal's target (packet.target_gap vs packet.tolerance; packet.plan.active_goal.streak counts hits in a row including this lap, tries counts retries on this goal). One action: offer_drill for the same drill (verdict repeat if it improved but missed, adjust if the target is wrong for this driver), advance_plan (met when inside tolerance and the streak reaches in_a_row; skipped after 2 or more tries with no progress), revise_plan if the plan was wrong, or end_session.
Drills: brake_point (target marker_m = brake board), brake_release (target release_s = seconds from peak brake to off; the 787B needs a progressive release as downforce fades or the fronts lock), throttle_pickup (target marker_m = metres past the apex).
Every number you say must come from the packet or a tool result. Cues are one sentence, an action at a visible marker, under 20 words. If the packet has "voice", the driver hears you at speed: at most voice.max_cue_words words for cues and summaries, reminder at most voice.max_reminder_words words, second person, e.g. "Brake 14 m earlier, at the 100 m board." and "Better, 4 m earlier. Keep that."
invalid_reason pedal_dropout or steering_dropout means the phone or the pedals cut out during the lap, not a driver mistake: say the lap did not count because the input dropped, and never coach technique from that lap.
Reason briefly (under 150 words)."""

AGENT_JSON_SUFFIX = (
    '\nTools are not available. Answer with only one JSON object: {"tool": "<name>", "arguments": {...}}. '
    'A read tool\'s result comes back in the next message; then answer with the next JSON object.')


def _short(name: str, res: dict) -> str:
    """One line per tool result for the dashboard timeline."""
    if "error" in res:
        return f"error: {res['error']}"
    if name == "get_driving_profile":
        p = res.get("profile", {})
        return (f"board {p.get('brake_board_m')} m, release {p.get('release_s')} s, "
                f"min {p.get('min_kmh')} km/h; {p.get('style', '')}")
    if name == "get_splits":
        return res.get("summary") or f"total {res.get('total_s')} s"
    if name == "compare_runs":
        d = res.get("diff", {})
        keys = [k for k in ("brake_board_m", "release_s", "min_kmh", "section_s") if k in d]
        return ", ".join(f"{k} {d[k]:+}" for k in keys) or f"{len(d)} differences"
    if name == "get_session_history":
        return f"{len(res.get('laps', []))} laps, plan {'set' if res.get('plan') else 'none'}"
    if name == "get_corner_info":
        return res.get("name", "corner")
    if name == "get_attempt_evidence":
        return "evidence packet"
    return "ok"


class AgentSession:
    """Session state the read tools look at. Lives in the Coach across laps."""

    def __init__(self, corner: CornerConfig, reference: Attempt, reference_trace: list | None = None):
        self.corner = corner
        self.reference = reference
        self.reference_trace = reference_trace or []
        self.runs: dict[str, dict] = {}
        self.order: list[str] = []
        self.history: list[dict] = []
        self.plan: Plan | None = None
        self.baseline_id: str | None = None
        self._profiles: dict[str, dict] = {}

    def reset(self) -> None:
        self.runs.clear()
        self.order.clear()
        self.history.clear()
        self._profiles.clear()
        self.plan = None
        self.baseline_id = None

    def set_reference(self, reference: Attempt, trace: list | None) -> None:
        self.reference, self.reference_trace = reference, trace or []
        self._profiles.pop("reference", None)

    def add_run(self, attempt: Attempt, trace: list | None) -> None:
        self.runs[attempt.attempt_id] = {"attempt": attempt, "trace": trace or []}
        self.order.append(attempt.attempt_id)

    def note(self, entry: dict) -> None:
        self.history.append(entry)

    # -- data --
    def _trace(self, aid: str) -> list | None:
        if aid == "reference":
            return self.reference_trace or None
        r = self.runs.get(aid)
        return r["trace"] if r and r["trace"] else None

    def profile(self, aid: str) -> dict | None:
        if aid in self._profiles:
            return self._profiles[aid]
        tr = self._trace(aid)
        if tr:
            p = driving_profile(tr, self.corner)
        else:  # no trace (old reference fixture): what the Attempt itself knows
            a = self.reference if aid == "reference" else (self.runs.get(aid) or {}).get("attempt")
            if a is None:
                return None
            p = {"brake_onset_m": a.brake_onset_m, "brake_board_m": round(self.corner.board_zero_m - a.brake_onset_m, 1),
                 "peak_brake": a.peak_brake, "release_s": a.release_s, "min_kmh": a.min_kmh or a.apex_kmh,
                 "throttle_pickup_m": a.throttle_pickup_m, "section_s": a.section_s, "note": "no trace"}
        self._profiles[aid] = p
        return p

    def _resolve(self, aid: str, current: str) -> str | None:
        if aid in ("reference",) or aid in self.runs:
            return aid
        if aid == "baseline":
            return self.baseline_id
        if aid == "previous":
            i = self.order.index(current) if current in self.order else len(self.order)
            return self.order[i - 1] if i >= 1 else None
        if aid in ("current", "latest", "this"):
            return current
        return None

    # -- read tools --
    def run_tool(self, name: str, args: dict, current: str, packet: dict) -> dict:
        args = args if isinstance(args, dict) else {}
        if name == "get_driving_profile":
            aid = self._resolve(str(args.get("attempt_id", current)), current)
            p = self.profile(aid) if aid else None
            if p is None:
                return {"error": f"unknown attempt_id {args.get('attempt_id')!r}; known: {self.order + ['reference']}"}
            out = {"attempt_id": aid, "profile": p}
            if aid != "reference":
                out["reference"] = self.profile("reference")
            return out
        if name == "get_splits":
            aid = self._resolve(str(args.get("attempt_id", current)), current)
            vs = str(args.get("vs") or "reference")
            vid = self._resolve(vs, aid or current)
            tr = self._trace(aid) if aid else None
            if tr is None:
                return {"error": f"no trace for {args.get('attempt_id')!r}"}
            ref = self._trace(vid) if vid else None
            if ref is None:
                return {"error": f"no trace for vs={vs!r}"}
            s = splits(tr, ref, self.corner)
            s.pop("delta_trace", None)  # long; the dashboard draws it, the model gets sectors
            return {"attempt_id": aid, "vs": vid, **s}
        if name == "compare_runs":
            a = self._resolve(str(args.get("a", current)), current)
            b = self._resolve(str(args.get("b", "reference")), current)
            pa, pb = (self.profile(a) if a else None), (self.profile(b) if b else None)
            if pa is None or pb is None:
                return {"error": f"unknown run: a={args.get('a')!r} b={args.get('b')!r}"}
            return {"a": a, "b": b, "diff": compare_runs(pa, pb)}
        if name == "get_session_history":
            return {"laps": self.history[-12:],
                    "plan": self.plan.to_dict(self.corner.tolerance) if self.plan else None}
        if name == "get_corner_info":
            c = self.corner
            return {"name": c.name, "board_zero_m": c.board_zero_m,
                    "boards_m": "brake board N is at board_zero_m - N metres along the lap",
                    "gates": {g: c.gate(g) for g in ("start_m", "brake_m", "turn_in_m", "apex1_m",
                                                      "apex2_m", "exit_m")},
                    "apex_window_m": list(c.apex_window_m), "tolerance": c.tolerance,
                    "allowed": c.allowed}
        if name == "get_attempt_evidence":
            return packet
        return {"error": f"unknown tool {name}"}

    def turn(self, packet: dict, kind: str, on_tool: Callable[[dict], None] | None = None) -> "AgentTurn":
        return AgentTurn(self, packet, kind, on_tool)


class AgentTurn:
    """One decision: the tools offered, the read-tool runner, the validator and the call log."""
    max_rounds = MAX_ROUNDS

    def __init__(self, session: AgentSession, packet: dict, kind: str,
                 on_tool: Callable[[dict], None] | None = None):
        self.session, self.packet, self.kind, self.on_tool = session, packet, kind, on_tool
        self.actions = PLAN_ACTIONS if kind == "plan" else EVAL_ACTIONS
        self.results: list[dict] = []
        self.log: list[dict] = []
        self.system_prompt = AGENT_PROMPT

    @property
    def action_schemas(self) -> list[dict]:
        return [_ALL_ACTIONS[n] for n in self.actions]

    @property
    def schemas(self) -> list[dict]:
        return READ_TOOLS + self.action_schemas

    def is_read(self, name: str) -> bool:
        return name in READ_NAMES

    def run(self, call: ToolCall, round_no: int) -> dict:
        t0 = time.perf_counter()
        try:
            res = self.session.run_tool(call.name, call.arguments, self.packet["attempt_id"], self.packet)
        except Exception as e:  # noqa: BLE001 - a tool bug is fed back to the model, not raised
            res = {"error": repr(e)}
        ms = (time.perf_counter() - t0) * 1000
        if call.name != "get_attempt_evidence":
            self.results.append(res)
        ev = {"type": "tool_call", "attempt_id": self.packet["attempt_id"], "turn": self.kind,
              "round": round_no, "name": call.name, "arguments": call.arguments, "ms": round(ms, 2),
              "summary": _short(call.name, res), "error": res.get("error")}
        self.log.append({k: v for k, v in ev.items() if k != "type"})
        if self.on_tool:
            try:
                self.on_tool(ev)
            except Exception:  # noqa: BLE001
                pass
        return res

    # -- validation of the final action --
    def validate(self, call: ToolCall | None, packet: dict) -> tuple[bool, str | None]:
        if call is None:
            return False, "no tool call"
        if self.is_read(call.name):
            return False, f"call one action tool now ({', '.join(self.actions)}), not {call.name}"
        if call.name not in self.actions:
            return False, f"{call.name} is not allowed on the {self.kind} turn; use one of {list(self.actions)}"
        a = call.arguments
        if not isinstance(a, dict):
            return False, "arguments not an object"
        if a.get("attempt_id") != packet["attempt_id"]:
            return False, f"attempt_id must be {packet['attempt_id']}"
        ev = {**packet, "tool_results": self.results}
        plan = self.session.plan
        goal = plan.goal if plan else None
        voice = packet.get("voice") or {}
        words = voice.get("max_cue_words", base_tools.MAX_CUE_WORDS)
        if call.name in ("offer_drill", "end_drill"):
            ok, why = base_tools.validate(call, ev)
            if not ok or self.kind != "evaluate" or goal is None:
                return ok, why
            if call.name == "offer_drill" and a.get("drill_id") != goal.drill_id:
                return False, f"the active goal is {goal.drill_id}; use revise_plan to change the drill"
            if call.name == "end_drill" and a.get("reason") == "drill_complete":
                return self._check_met(packet, goal)
            return True, None
        if call.name in ("set_plan", "revise_plan"):
            if call.name == "set_plan" and packet["phase"] != "baseline":
                return False, "set_plan is for the plan turn"
            ok, why = self._check_goals(a.get("goals"), ev)
            if not ok:
                return ok, why
            if call.name == "revise_plan" and not str(a.get("reason") or "").strip():
                return False, "reason empty"
            return True, None
        if call.name == "advance_plan":
            if goal is None:
                return False, "no active goal"
            if a.get("outcome") not in ("met", "skipped"):
                return False, "outcome must be met or skipped"
            ok, why = base_tools.check_spoken(a.get("summary"), "summary", words, ev)
            if not ok:
                return ok, why
            if a["outcome"] == "met":
                return self._check_met(packet, goal)
            if goal.tries < 2 and packet["valid"]:
                return False, f"only {goal.tries} tries on this goal; give it at least 2 before skipping"
            return True, None
        if call.name == "end_session":
            return base_tools.check_spoken(a.get("summary"), "summary", words, ev)
        return False, f"unknown action {call.name}"

    def _check_met(self, packet: dict, goal) -> tuple[bool, str | None]:
        gap = packet.get("target_gap") or {}
        key = DRILL_METRIC.get(goal.drill_id)
        tol = packet["tolerance"].get(key)
        if not packet["valid"] or key not in gap or tol is None or abs(gap[key]) > tol:
            return False, f"target gap {gap.get(key)} is not inside tolerance {tol}; not met"
        if goal.hits < goal.in_a_row:
            return False, f"inside tolerance {goal.hits} time(s) in a row; the goal needs {goal.in_a_row}"
        return True, None

    def _check_goals(self, goals: Any, ev: dict) -> tuple[bool, str | None]:
        if not isinstance(goals, list) or not 1 <= len(goals) <= MAX_GOALS:
            return False, f"goals must be a list of 1 to {MAX_GOALS}"
        seen = set()
        for i, g in enumerate(goals, 1):
            if not isinstance(g, dict):
                return False, f"goal {i} is not an object"
            d = g.get("drill_id")
            if d in seen:
                return False, f"goal {i}: {d} twice"
            seen.add(d)
            if g.get("in_a_row") not in (None, 1, 2):
                return False, f"goal {i}: in_a_row must be 1 or 2"
            offer = {"attempt_id": ev["attempt_id"], "drill_id": d, "target": g.get("target"),
                     "cue": g.get("cue")}
            if g.get("reminder"):
                offer["reminder"] = g["reminder"]
            ok, why = base_tools._validate_offer(offer, ev)
            if not ok:
                return False, f"goal {i}: {why}"
            g["target"] = offer["target"]  # validation may drop stray keys
            if "reminder" not in offer:
                g.pop("reminder", None)
        return True, None


def tool_message(call: ToolCall, result: dict, rounds_left: int) -> str:
    body = {"result": result}
    if rounds_left <= 0:
        body["note"] = "No more read tools: call one action tool now."
    return json.dumps(body, separators=(",", ":"), default=str)
