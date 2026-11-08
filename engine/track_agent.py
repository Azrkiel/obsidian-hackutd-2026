"""Whole-lap agent mode (W6, W10): read tools over every corner, a plan whose goals are (corner, drill).

One AgentSession per corner keeps that corner's runs, reference and profiles, so every read tool works
as in single-corner mode; `corner_id` picks the corner (default: the corner the packet is about).
The plan, the history and the lap summaries live here, shared by all corners.
"""
from __future__ import annotations

import copy
import re
from typing import Any, Callable

from .agent_tools import READ_NAMES, READ_TOOLS, AgentSession, AgentTurn, _ALL_ACTIONS
from .models import Attempt, Track

TRACK_AGENT_PROMPT = """You are a racing coach for a whole lap of {track} in a simulator. The car is a Mazda 787B: very fast, heavy downforce, an analog brake. After each lap you get one turn while the driver is on the main straight.
Each turn:
- You may call read tools for up to 3 rounds; they take an optional corner_id (default: packet.corner_id). get_lap_summary gives every corner's time lost on a lap.
- Then call exactly one action tool. Never answer in plain text.
packet.lap has the last full lap time, delta_s (time lost in the scored corners vs the reference) and top: the corners losing the most time that have a metric over tolerance, biggest first, each with its worst metric, deltas and suggested targets. The rest of the packet is the full evidence for packet.corner_id.
Plan turn (packet.turn = "plan"): set_plan with 1 to 3 goals. Each goal is one drill at one corner (corner_id from packet.lap.top) with a target from that corner's suggested values. Goal 1 is packet.lap.top[0], the corner losing the most time. The same drill may appear at two corners. Only plan drills whose delta at that corner is over tolerance. If packet.lap.top is empty, call end_drill.
Evaluate turn (packet.turn = "evaluate"): the packet is the active goal's corner on this lap (packet.plan.active_goal). Compare the lap with the goal's target (packet.target_gap vs packet.tolerance; streak counts hits in a row including this lap). One action: offer_drill for the same drill (verdict repeat if it improved but missed, adjust if the target is wrong for this driver), advance_plan (met when inside tolerance and the streak reaches in_a_row; skipped after 2 or more tries with no progress), revise_plan if the plan was wrong, or end_session.
One change at a time: only the active goal is cued on a lap. The driver hears your cue on the straight and a short reminder before that corner.
Drills: brake_point (target marker_m = brake board), brake_release (target release_s = seconds from peak brake to off; the 787B needs a progressive release as downforce fades or the fronts lock), throttle_pickup (target marker_m = metres past the apex).
Every number you say must come from the packet or a tool result. A cue names the corner first, then one action at a visible marker, e.g. "Ascari: brake at the 100 m board." If the packet has "voice", the driver hears you at speed: at most voice.max_cue_words words for cues and summaries, reminder at most voice.max_reminder_words words, second person.
invalid_reason pedal_dropout or steering_dropout means the phone or the pedals cut out, not a driver mistake: never coach technique from that corner.
Reason briefly (under 150 words)."""

_LAP_TOOL = {"type": "function", "function": {
    "name": "get_lap_summary",
    "description": "Every corner's time lost (+) or gained (-) vs the reference on one lap, with its worst metric "
                   "over tolerance, plus the lap time.",
    "parameters": {"type": "object", "properties": {
        "lap": {"type": "string", "description": "'current', 'previous' or a lap number"}}, "required": []}}}


def _with_corner(tool: dict, ids: list[str], required: bool = False) -> dict:
    t = copy.deepcopy(tool)
    params = t["function"]["parameters"]
    params.setdefault("properties", {})["corner_id"] = {
        "type": "string", "enum": ids, "description": "Which corner (default: packet.corner_id)."}
    if required:
        params["required"] = list(params.get("required", [])) + ["corner_id"]
    return t


def _goal_schema_with_corner(tool: dict, ids: list[str]) -> dict:
    t = copy.deepcopy(tool)
    goals = t["function"]["parameters"]["properties"].get("goals")
    if goals:
        item = goals["items"]
        item["properties"]["corner_id"] = {"type": "string", "enum": ids, "description": "The corner this goal is at."}
        item["required"] = list(item["required"]) + ["corner_id"]
    return t


class TrackAgentSession:
    """Same surface the Coach uses on an AgentSession (plan, history, add_run, note, turn, ...)."""

    def __init__(self, track: Track, references: dict[str, tuple[Attempt, list]]):
        self.track = track
        self.sessions = {c.id: AgentSession(c, references[c.id][0], references[c.id][1]) for c in track.corners}
        self.focus_id = track.corners[0].id
        self.history: list[dict] = []
        self.plan = None
        self.laps: dict[int, dict] = {}            # lap -> {"summary", "corners", "runs"}
        self.current_lap: int | None = None
        self.corner_packets: dict[str, dict] = {}  # this lap, baseline-phase packet per corner
        ids = track.ids
        self.read_schemas = [_with_corner(t, ids) for t in READ_TOOLS] + [_LAP_TOOL]
        self._actions = {n: _goal_schema_with_corner(t, ids) for n, t in _ALL_ACTIONS.items()}
        self.prompt = TRACK_AGENT_PROMPT.replace("{track}", track.name)

    # -- the AgentSession surface --
    @property
    def corner(self):
        return self.sessions[self.focus_id].corner

    @property
    def baseline_id(self) -> str | None:
        return self.sessions[self.focus_id].baseline_id

    @baseline_id.setter
    def baseline_id(self, v: str | None) -> None:
        self.sessions[self.focus_id].baseline_id = v

    def focus(self, corner_id: str) -> None:
        self.focus_id = corner_id

    def reset(self) -> None:
        for s in self.sessions.values():
            s.reset()
        self.history.clear()
        self.laps.clear()
        self.plan, self.current_lap, self.corner_packets = None, None, {}

    def set_reference(self, reference: Attempt, trace: list | None, corner_id: str | None = None) -> None:
        self.sessions[corner_id or self.focus_id].set_reference(reference, trace)

    def add_run(self, attempt: Attempt, trace: list | None) -> None:
        s = self.sessions[self.focus_id]
        if attempt.attempt_id not in s.runs:
            s.add_run(attempt, trace)

    def add_lap(self, lap: int, runs: dict[str, tuple[Attempt, list]], packets: dict[str, dict],
                summary: dict) -> None:
        corners = []
        for cid, (a, tr) in runs.items():
            s = self.sessions[cid]
            if a.attempt_id not in s.runs:
                s.add_run(a, tr)
            if s.baseline_id is None and a.valid:
                s.baseline_id = a.attempt_id
            lost = round(a.section_s - s.reference.section_s, 2) if a.valid else None
            corners.append({"corner_id": cid, "attempt_id": a.attempt_id, "valid": a.valid,
                            "invalid_reason": a.invalid_reason, "time_lost_s": lost,
                            "section_s": round(a.section_s, 2)})
        self.laps[lap] = {"summary": summary, "corners": corners}
        self.current_lap, self.corner_packets = lap, packets

    def note_lap_time(self, lap: int, lap_time_s: float | None) -> None:
        """The lap line comes after the lap's decision: fill the time in when it is known."""
        if lap in self.laps:
            self.laps[lap]["lap_time_s"] = lap_time_s

    def note(self, entry: dict) -> None:
        self.history.append({**entry, "corner_id": self.focus_id, "lap": self.current_lap})

    def turn(self, packet: dict, kind: str, on_tool: Callable[[dict], None] | None = None) -> "TrackAgentTurn":
        return TrackAgentTurn(self, packet, kind, on_tool)

    # -- read tools --
    def _lap_key(self, v: Any) -> int | None:
        keys = sorted(self.laps)
        if v in (None, "", "current", "this", "latest"):
            return self.current_lap
        if v in ("previous", "last"):
            i = keys.index(self.current_lap) if self.current_lap in keys else len(keys)
            return keys[i - 1] if i >= 1 else None
        m = re.search(r"\d+", str(v))
        return int(m.group()) if m else None

    def run_tool(self, name: str, args: dict, current: str, packet: dict) -> dict:
        args = dict(args) if isinstance(args, dict) else {}
        if name == "get_lap_summary":
            k = self._lap_key(args.get("lap"))
            if k not in self.laps:
                return {"error": f"unknown lap {args.get('lap')!r}; known: {sorted(self.laps)}"}
            s = self.laps[k]
            return {"lap": k, "lap_time_s": s.get("lap_time_s"),
                    "delta_s": s["summary"].get("delta_s"), "corners": s["corners"]}
        if name == "get_session_history":
            return {"laps": self.history[-12:],
                    "lap_times": [{"lap": k, "lap_time_s": v.get("lap_time_s"),
                                   "delta_s": v["summary"].get("delta_s")} for k, v in sorted(self.laps.items())],
                    "plan": self.plan.to_dict(self.corner.tolerance) if self.plan else None}
        cid = args.pop("corner_id", None) or self.focus_id
        if cid not in self.sessions:
            return {"error": f"unknown corner_id {cid!r}; known: {self.track.ids}"}
        cur, pk = current, packet
        if cid != self.focus_id:
            lap = self.laps.get(self.current_lap) or {"corners": []}
            cur = next((c["attempt_id"] for c in lap["corners"] if c["corner_id"] == cid), current)
            pk = self.corner_packets.get(cid, packet)
        res = self.sessions[cid].run_tool(name, args, cur, pk)
        if isinstance(res, dict) and name != "get_attempt_evidence":
            res = {"corner_id": cid, **res}
        return res


class TrackAgentTurn(AgentTurn):
    """AgentTurn with corner-aware tools and goal validation (each goal checked against its corner)."""

    def __init__(self, session: TrackAgentSession, packet: dict, kind: str,
                 on_tool: Callable[[dict], None] | None = None):
        super().__init__(session, packet, kind, on_tool)  # type: ignore[arg-type]
        self.system_prompt = session.prompt

    @property
    def action_schemas(self) -> list[dict]:
        return [self.session._actions[n] for n in self.actions]

    @property
    def schemas(self) -> list[dict]:
        return self.session.read_schemas + self.action_schemas

    def is_read(self, name: str) -> bool:
        return name in READ_NAMES or name == "get_lap_summary"

    def _goal_evidence(self, goal: dict, ev: dict) -> tuple[dict | None, str | None]:
        s = self.session
        cid = goal.get("corner_id") or self.packet.get("corner_id") or s.focus_id
        if cid not in s.sessions:
            return None, f"unknown corner_id {cid!r}; known: {s.track.ids}"
        goal["corner_id"] = cid
        if cid == self.packet.get("corner_id"):
            base = ev  # this turn's packet (a retry packet on evaluate turns)
        elif cid in s.corner_packets:
            base = s.corner_packets[cid]
        else:
            return None, f"no run at {cid} this lap; corners with a run: {sorted(s.corner_packets)}"
        return {**base, "lap_packet": self.packet, "tool_results": self.results}, None

    def _goal_key(self, goal: dict) -> tuple:
        return (goal.get("drill_id"), goal.get("corner_id") or self.packet.get("corner_id"))

