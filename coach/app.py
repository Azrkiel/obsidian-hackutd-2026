"""CoachApp: wires telemetry -> scorer -> engine Coach, reset manager, live cue, dashboard broadcast.

With an InputHub it is also the input receiver: phone + Arduino -> virtual pad, and each scored run
carries an input summary (which device drove the pedals, link drops) into the coach's evidence.
With auto_retry, an accepted drill loops on its own (rewind, retry, decide) until it ends, then the
car is put back where the drill started; "resume" ends the drill early the same way.
"""
from __future__ import annotations

import asyncio
import json
import sys
import threading
import time
from collections import deque
from dataclasses import asdict
from pathlib import Path
from typing import Any, Callable

from engine import ladder
from engine.agent_tools import AgentSession
from engine.live_cue import LiveCue, NullPlayer
from engine.models import Attempt, CornerConfig, Track
from engine.state import AWAIT_RESET, DECIDING, DONE, IDLE, OFFERED, RETRY, Coach
from engine.track_coach import TrackCoach
from engine.trace import TraceWriter
from engine.voice import ADVICE, REMINDER, VERDICT, Announcer

from .inputs import InputHub, RunInputs, dropout_reason
from .reset import ResetManager
from .scorer import CornerScorer, TrackScorer
from .telemetry import Recorder, Sample, SimSource, TrackSimSource

COMMANDS = {"accept", "retry", "save_checkpoint", "set_reference", "new_session",
            "toggle_cue_next", "retry_reset", "toggle_mute", "mark_board", "resume"}
LAP_TOTAL_DEADLINE_S = 8.0  # lap mode: slower than this and the rules sentence is spoken instead
ACTIVITY_TYPES = {"run", "decision", "reset_request", "reset_confirmed", "reset_failed",
                  "checkpoint", "reference", "session", "input", "resume_point", "resumed", "track_lap"}


def _make_player(sound: bool | None):
    if sound is None:
        sound = sys.platform == "win32"
    if sound:
        try:
            from engine.live_cue import WinsoundPlayer
            return WinsoundPlayer()
        except Exception:  # noqa: BLE001 - no winsound: stay silent
            pass
    return NullPlayer()


class CoachApp:
    def __init__(self, corner: CornerConfig, reference: Attempt, source: Any, providers: list,
                 reset_mode: str = "manual", reference_trace: list | None = None,
                 data_dir: str | Path = "data", trace_dir: str | Path = "traces",
                 recorder: Recorder | None = None, sound: bool | None = False,
                 countdown: int = 3, tick_s: float = 1.0, persist_checkpoint: bool = True,
                 reconnect_s: float = 2.0, decide_kwargs: dict | None = None,
                 reset_kwargs: dict | None = None, mode: str = "drill", speaker: Any = None,
                 muted: bool = False, announcer_kwargs: dict | None = None, agent: bool = False,
                 inputs: InputHub | None = None, auto_retry: bool = False, max_retries: int = 5,
                 track: Track | None = None, track_references: dict | None = None):
        if mode not in ("drill", "lap"):
            raise ValueError(f"mode must be drill or lap, not {mode!r}")
        if track is not None:
            # whole-lap mode: every corner of the track is scored, one decision per lap
            if mode != "lap":
                raise ValueError("whole-lap coaching (--track) needs --mode lap")
            if not track_references:
                raise ValueError("whole-lap coaching needs a reference per corner")
            corner = track.corners[0]
            reference, reference_trace = track_references[corner.id]
        self.mode, self.track = mode, track
        self.track_laps: deque[dict] = deque(maxlen=20)
        self.last_lap_runs: dict | None = None
        self._lap_events: dict[str, dict] = {}
        self._lap_inputs: dict[str, dict] = {}
        self.corner, self.source, self.providers = corner, source, providers
        self.data_dir = Path(data_dir)
        self.recorder, self.reconnect_s = recorder, reconnect_s
        self.reference, self.reference_trace = reference, reference_trace or []
        self.events: list[dict] = []
        self.activity: deque[dict] = deque(maxlen=50)
        self._subs: list[Callable[[dict], None]] = []
        self._tasks: set[asyncio.Task] = set()
        self._main: list[asyncio.Task] = []
        self.latest: Sample | None = None
        self._latest_at = 0.0
        self.telemetry_error: str | None = None
        self.last_run: dict | None = None        # last run event (any role)
        self.last_valid_run: dict | None = None
        self.baseline_run: dict | None = None
        self.retry_run: dict | None = None
        self.last_decision: dict | None = None
        self.cue_next_off = False
        self.inputs, self.auto_retry, self.max_retries = inputs, auto_retry, max_retries
        self._run_inputs = RunInputs()
        if inputs is not None:
            inputs.emit = self.broadcast
            inputs.on_command = self._phone_command
        self._health_key: str | None = None
        self.player = _make_player(sound)
        self._loop: asyncio.AbstractEventLoop | None = None
        self._loop_thread: int | None = None
        # voice: the driver hears the cue; quiet inside the scored corner
        zones = ({"quiet_zones": track.quiet_zones, "talk_zones": track.talk_zones} if track is not None
                 else {"quiet_zone": (corner.start_gate_m, corner.exit_gate_m)})
        self.announcer = Announcer(speaker, on_event=self._threadsafe_broadcast, muted=muted,
                                   **zones, **(announcer_kwargs or {})) if speaker is not None else None
        say = (lambda text: self.announcer.say(text, REMINDER)) if self.announcer else None
        if track is not None:  # one live cue per corner; the coach arms only the active goal's
            self.live_cues = {c.id: LiveCue(c, self.player, say=say) for c in track.corners}
            self.live_cue = self.live_cues[corner.id]
        else:
            self.live_cue = LiveCue(corner, self.player, say=say)
            self.live_cues = {corner.id: self.live_cue}
        self.trace = TraceWriter(trace_dir)
        if track is not None:
            self.scorer = TrackScorer(track, self._on_corner_run, self._on_lap_corners, self._on_track_lap,
                                      reference_of=lambda cid: self.coach.ctx[cid].reference)
        else:
            self.scorer = CornerScorer(corner, self._on_run)
        self.sim = source if isinstance(source, SimSource) else None
        self.track_sim = source if isinstance(source, TrackSimSource) else None
        self.reset = ResetManager(
            reset_mode, self.broadcast, self._on_reset_confirmed, scorer=self.scorer, sim=self.sim,
            checkpoint_path=self.data_dir / "checkpoint.json" if persist_checkpoint else None,
            countdown=countdown, tick_s=tick_s, on_resumed=self._on_resumed, **(reset_kwargs or {}))
        if self.sim is not None and reset_mode == "sim" and not self.reset.checkpoint:
            self.reset.set_checkpoint(self.sim.start_pos_m, self.sim.v0_kmh)
            self.activity.clear()
        dk = dict(decide_kwargs or {})
        if mode == "lap":
            dk.setdefault("total_deadline_s", LAP_TOTAL_DEADLINE_S)
        if track is not None:
            self.coach: Coach = TrackCoach(track, track_references, providers, self._on_coach_event,
                                           live_cues=self.live_cues, trace=self.trace, decide_kwargs=dk,
                                           agent=agent, lap_now=lambda: self.scorer.lap)
        else:
            self.coach = Coach(corner, reference, providers, self._on_coach_event, self._request_reset,
                               trace=self.trace, live_cue=self.live_cue, decide_kwargs=dk,
                               lap_mode=mode == "lap",
                               agent=AgentSession(corner, reference, self.reference_trace) if agent else None)

    # -- broadcast --
    def subscribe(self, cb: Callable[[dict], None]) -> Callable[[], None]:
        self._subs.append(cb)
        return lambda: self._subs.remove(cb) if cb in self._subs else None

    def _threadsafe_broadcast(self, event: dict) -> None:
        """The voice worker thread reports through here; subscribers live on the event loop."""
        if self._loop is not None and threading.get_ident() != self._loop_thread:
            try:
                self._loop.call_soon_threadsafe(self.broadcast, event)
            except RuntimeError:  # loop closed during shutdown
                pass
        else:
            self.broadcast(event)

    def broadcast(self, event: dict) -> None:
        event = {"ts": time.time(), **event}
        if event["type"] != "health":
            self.events.append(event)
            del self.events[:-2000]
        if event["type"] == "voice" and event["status"] in ("spoken", "dropped", "error"):
            event["text_log"] = (f"said: {event['text']}" if event["status"] == "spoken"
                                 else f"voice {event['status']} ({event.get('reason')}): {event['text']}")
            self.activity.append({"ts": event["ts"], "type": "voice", "text": event["text_log"]})
        if event["type"] in ACTIVITY_TYPES:
            event["text"] = self._activity_text(event)
            self.activity.append({"ts": event["ts"], "type": event["type"], "text": event["text"]})
        for cb in list(self._subs):
            try:
                cb(event)
            except Exception:  # noqa: BLE001 - a dead subscriber must not break the coach
                pass

    @staticmethod
    def _activity_text(e: dict) -> str:
        t = e["type"]
        if t == "run":
            a = e["attempt"]
            ok = "valid" if a["valid"] else f"invalid ({a['invalid_reason']})"
            return f"{e['role']} run {a['attempt_id']} scored: {ok}"
        if t == "decision":
            return f"decision {e['action']} ({e['mode']}): {e.get('cue') or e.get('summary')}"
        if t == "reset_request":
            return f"{'resume' if e.get('slot') == 'resume' else 'reset'} requested ({e['mode']})"
        if t == "reset_confirmed":
            return ("resumed: car back where the drill started" if e.get("slot") == "resume"
                    else "reset confirmed: car at checkpoint")
        if t == "reset_failed":
            return f"reset failed: {e['reason']}"
        if t == "checkpoint":
            return f"checkpoint saved at {e['pos_m']:.0f} m, {e['speed_kmh']:.0f} km/h"
        if t == "reference":
            return f"reference set from {e['attempt']['attempt_id']}"
        if t == "input":
            return e["message"]
        if t == "resume_point":
            return f"resume point saved at {e['pos_m']:.0f} m, {e['speed_kmh']:.0f} km/h"
        if t == "resumed":
            return "drill ended; back to free driving"
        if t == "track_lap":
            lt = f"{e['lap_time_s']:.2f} s" if e.get("lap_time_s") else f"not timed ({e.get('invalid_reason')})"
            return f"lap {e['lap']}: {lt}, {e['delta_s']:+.2f} s in the corners vs reference"
        return "new session"

    def _spawn(self, coro) -> asyncio.Task:
        task = asyncio.get_running_loop().create_task(coro)
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        return task

    # -- coach wiring --
    def _on_coach_event(self, e: dict) -> None:
        if e["type"] == "decision":
            self.last_decision = e
            if e["action"] == "offer_drill" and self.track_sim is not None and e.get("corner_id"):
                if e.get("drill_id") == "brake_point":
                    self.track_sim.set_target_board(e["target"]["marker_m"], e["corner_id"])
                elif e.get("drill_id") == "brake_release":
                    self.track_sim.set_target_release(e["target"]["release_s"], e["corner_id"])
            if e["action"] == "offer_drill" and self.sim is not None:
                if e.get("drill_id") == "brake_point":
                    self.sim.set_target_board(e["target"]["marker_m"])
                elif e.get("drill_id") == "brake_release":
                    self.sim.set_target_release(e["target"]["release_s"])
        self.broadcast(e)
        if e["type"] == "decision":
            self._speak_decision(e)
        if not self.auto_retry or e["type"] != "status" or "message" in e:
            return
        c = self.coach
        if e["state"] == OFFERED and c.offer and c.drill and c.drill.tries > 0:
            if c.drill.tries >= self.max_retries:
                # safety net: a model that keeps saying "repeat" must not loop forever
                self.broadcast({"type": "status", "state": c.state,
                                "message": f"stopped after {c.drill.tries} retries (--max-retries)"})
                if self.reset.resume_point is not None:
                    self._spawn(self.reset.resume("retry-limit"))
                return
            # same drill, the driver already opted in: rewind straight away. A new plan goal
            # (tries back at 0) waits for Accept or the phone's "next" so the new cue is heard first.
            self._spawn(c.on_accept(c.offer.decision_id))
        elif e["state"] == DONE and self.reset.resume_point is not None:
            # drill finished (mistake fixed, or no progress): back to where it started
            self._spawn(self.reset.resume("drill-done"))

    def _speak_decision(self, e: dict) -> None:
        if self.announcer is None:
            return
        meta = {"decision_id": e.get("decision_id"), "mode": e.get("mode")}
        if e["action"] == "offer_drill":
            if e.get("plan_action") == "advance_plan" and e.get("summary"):
                self.announcer.say(e["summary"], VERDICT, **meta)  # "On target." then the next goal
            text, kind = e.get("cue") or "", VERDICT if e.get("verdict") else ADVICE
        else:
            text, kind = e.get("summary") or "", VERDICT
        self.announcer.say(text, kind, **meta)

    async def _request_reset(self, decision_id: str) -> None:
        drill = self.coach.drill
        if self.reset.resume_point is None and self.reset.can_resume and (drill is None or drill.tries == 0):
            await self.reset.save_resume_point()  # first rewind of this drill: where to come back to
        await self.reset.reset(decision_id)

    def _phone_command(self, name: str) -> None:
        """Coach commands from the phone's buttons (evt coach_next / coach_resume)."""
        c = self.coach
        if name == "resume":
            self._spawn(self.handle_command({"type": "resume"}))
        elif self.mode == "lap":
            self._note("next does nothing in lap mode")
        elif c.state == OFFERED and c.offer:
            self._spawn(self.handle_command({"type": "accept", "decision_id": c.offer.decision_id}))
        else:
            self._spawn(self.handle_command({"type": "retry"}))

    def _on_resumed(self) -> None:
        self.coach.reset_session()
        self.broadcast({"type": "resumed"})

    def _on_reset_confirmed(self) -> None:
        if self.coach.state == AWAIT_RESET:
            self.coach.on_reset_confirmed()

    def _on_run(self, attempt: Attempt, trace: list) -> None:
        inputs, self._run_inputs = self._run_inputs.summary(), RunInputs()
        self._spawn(self._handle_run(attempt, trace, inputs))

    async def _handle_run(self, attempt: Attempt, trace: list, inputs: dict | None = None) -> None:
        if self.coach.state == DONE:
            # a finished drill (or "no coaching needed") must not block the next lap:
            # the next run through the corner is a fresh baseline (demo: clean run, then late brake)
            self.coach.reset_session()
            self.baseline_run = self.retry_run = None
        state = self.coach.state
        role = "retry" if state == RETRY else "baseline" if state == IDLE else "reference_candidate"
        dropped = dropout_reason(inputs)
        if dropped and attempt.valid:
            # the game saw the pedals/steering let go, not the driver: this run must not be coached
            attempt.valid, attempt.invalid_reason = False, dropped
        d = asdict(attempt)
        d["brake_board_m"] = round(self.corner.board_zero_m - attempt.brake_onset_m, 1) if attempt.valid else None
        ev = {"type": "run", "role": role, "attempt": d, "trace": trace, "inputs": inputs}
        self.last_run = ev
        if attempt.valid:
            self.last_valid_run = ev
        if role == "baseline":
            self.baseline_run, self.retry_run = ev, None
            self.reset.clear_resume_point()  # a new baseline starts a new drill
        elif role == "retry":
            self.retry_run = ev
        self.broadcast(ev)
        await self.coach.on_scored(attempt, trace, {"inputs": inputs} if inputs else None)

    # -- whole lap --
    def _on_corner_run(self, cid: str, attempt: Attempt, trace: list) -> None:
        inputs, self._run_inputs = self._run_inputs.summary(), RunInputs()
        dropped = dropout_reason(inputs)
        if dropped and attempt.valid:
            attempt.valid, attempt.invalid_reason = False, dropped
        c = self.track.corner(cid)
        d = asdict(attempt)
        d["brake_board_m"] = round(c.board_zero_m - attempt.brake_onset_m, 1) if attempt.valid else None
        co = self.coach
        role = "retry" if co.state == RETRY and co.offer is not None and co.offer.corner_id == cid else "lap"
        ev = {"type": "run", "role": role, "corner_id": cid, "corner_name": c.name, "attempt": d,
              "trace": trace, "inputs": inputs}
        self.last_run = ev
        if attempt.valid:
            self.last_valid_run = ev
        self._lap_events[cid] = ev
        if inputs:
            self._lap_inputs[cid] = inputs
        self.broadcast(ev)

    def _on_lap_corners(self, lap: int, runs: dict) -> None:
        events, self._lap_events = self._lap_events, {}
        inputs, self._lap_inputs = self._lap_inputs, {}
        self.last_lap_runs = {"lap": lap, "runs": runs}
        self._spawn(self._handle_lap(lap, runs, events, inputs))

    async def _handle_lap(self, lap: int, runs: dict, events: dict, inputs: dict) -> None:
        co = self.coach
        was_retry = co.state == RETRY
        last = self.track_laps[-1]["lap_time_s"] if self.track_laps else None
        await co.on_lap(lap, runs, inputs, lap_time_s=last)
        if not was_retry:
            self.baseline_run, self.retry_run = events.get(co.focus_id), None
        elif events.get(co.focus_id) is not None:
            self.retry_run = events.get(co.focus_id)
        self.broadcast(self._focus_event())

    def _focus_event(self) -> dict:
        """What the dashboard charts: the corner being coached, its reference, baseline and last retry."""
        co = self.coach
        cid = (co.offer.corner_id if co.offer is not None else None) or co.focus_id
        c = co.ctx[cid]

        def at(ev: dict | None) -> dict | None:
            return ev if ev is not None and ev.get("corner_id") == cid else None
        return {"type": "focus", "corner_id": cid, "corner": asdict(c.corner),
                "reference": {"attempt": asdict(c.reference), "trace": c.reference_trace},
                "baseline": at(self.baseline_run), "retry": at(self.retry_run)}

    def _on_track_lap(self, ev: dict) -> None:
        self.track_laps.append(ev)
        if self.coach.agent is not None:
            self.coach.agent.note_lap_time(ev["lap"], ev["lap_time_s"])
        self.broadcast(ev)

    def track_info(self) -> dict | None:
        if self.track is None:
            return None
        t = self.track
        return {"name": t.name, "length_m": t.length_m, "talk_zones": [list(z) for z in t.talk_zones],
                "corners": [asdict(c) for c in t.corners], "last_id": t.last_id}

    # -- telemetry --
    def _on_sample(self, s: Sample) -> None:
        self.latest, self._latest_at = s, time.monotonic()
        if self.recorder:
            self.recorder.write(s)
        self.reset.on_sample(s)
        if self.announcer:
            self.announcer.on_position(s.pos_m)
        for cue in self.live_cues.values():
            cue.on_sample(s.t, s.pos_m, s.speed_kmh)
        if self.inputs is not None:
            if self.scorer.in_run:
                self._run_inputs.add(self.inputs.snapshot(), s.gas, s.brake)
            elif self._run_inputs.n:
                self._run_inputs = RunInputs()  # the last run was aborted
        self.scorer.add(s)
        if self.announcer:
            self.announcer.pump()

    async def _telemetry_loop(self) -> None:
        while True:
            try:
                async for s in self.source.samples():
                    self.telemetry_error = None
                    self._on_sample(s)
                if getattr(self.source, "finite", False):
                    self.telemetry_error = "source ended"
                    return
            except asyncio.CancelledError:
                raise
            except Exception as e:  # noqa: BLE001 - AC not running etc: keep the dashboard up
                self.telemetry_error = str(e) or type(e).__name__
            await asyncio.sleep(self.reconnect_s)

    # -- status --
    def health(self) -> dict:
        now = time.monotonic()
        age = None if self.latest is None else round(now - self._latest_at, 1)
        if self.latest is None or age is None or age > 2.0:
            tel = {"state": "no data", "age_s": age, "error": self.telemetry_error}
        else:
            tel = {"state": "live" if self.latest.status == "live" else "paused",
                   "age_s": age, "error": None}
        d = self.last_decision
        if d is not None:
            mode, prov = d["mode"], d.get("provider")
        else:
            avail = any(getattr(p, "available", False) for p in self.providers)
            mode, prov = ("ready", None) if avail else ("rules", None)
        label = {"think": "Nemotron · thinking", "fast": "Nemotron · fast",
                 "ready": "Nemotron · ready"}.get(mode, "Rules (AI unavailable)")
        return {
            "type": "health",
            "ai": {"mode": mode, "provider": prov, "label": label},
            "telemetry": tel,
            "reset": {"status": self.reset.status, "mode": self.reset.mode,
                      "checkpoint": self.reset.checkpoint},
            "providers": {getattr(p, "name", "?"): bool(getattr(p, "available", False))
                          for p in self.providers},
            "cue_next_off": self.cue_next_off,
            "inputs": self.inputs.status() if self.inputs is not None else None,
            "auto_retry": self.auto_retry,
            "resume_available": self.reset.resume_point is not None,
            "mode": self.mode,
            "agent": self.coach.agent is not None,
            "track": self.track.name if self.track is not None else None,
            "voice": None if self.announcer is None else {
                "speaker": getattr(self.announcer.speaker, "name", "?"),
                "muted": self.announcer.muted, "queued": len(self.announcer.queue)},
        }

    def snapshot(self) -> dict:
        c = self.coach
        return {
            "type": "snapshot", "state": c.state, "corner": asdict(self.corner),
            "reference": {"attempt": asdict(self.reference), "trace": self.reference_trace},
            "baseline": self.baseline_run, "retry": self.retry_run,
            "decision": self.last_decision, "offer": c.offer.to_dict() if c.offer else None,
            "tries": c.drill.tries if c.drill else 0,
            "activity": list(self.activity), "health": self.health(),
            "voice": [e for e in self.events if e["type"] == "voice"
                      and e["status"] in ("spoken", "dropped", "error")][-20:],
            "plan": c.plan_dict() if hasattr(c, "plan_dict") else None,
            "tools": [e for e in self.events if e["type"] == "tool_call"][-40:],
            "track": self.track_info(), "track_laps": list(self.track_laps),
            "focus": self._focus_event() if self.track is not None else None,
        }

    async def _health_loop(self) -> None:
        while True:
            if self.announcer:
                self.announcer.pump()  # telemetry may be off
            h = self.health()
            self.broadcast(h)
            await asyncio.sleep(1.0)

    # -- commands --
    def _note(self, msg: str) -> None:
        self.broadcast({"type": "status", "state": self.coach.state, "message": f"ignored: {msg}"})

    async def handle_command(self, msg: Any) -> None:
        if not isinstance(msg, dict) or msg.get("type") not in COMMANDS:
            return self._note("unknown command")
        kind, c = msg["type"], self.coach
        if kind == "accept":
            did = msg.get("decision_id") or (c.offer.decision_id if c.offer else None)
            if c.state != OFFERED or c.offer is None or c.offer.decision_id != did:
                return self._note("accept does not match the current offer")
            self._spawn(c.on_accept(did))
        elif kind == "retry":
            if c.state == OFFERED and c.offer:
                self._spawn(c.on_accept(c.offer.decision_id))
            elif c.state in (IDLE, DONE):
                if c.state == DONE:
                    c.reset_session()
                    self.baseline_run = self.retry_run = None
                self._spawn(self.reset.reset("free-run"))
            else:
                self._note(f"retry not available in {c.state}")
        elif kind == "save_checkpoint":
            self._spawn(self.reset.save_checkpoint())
        elif kind == "set_reference":
            self.set_reference()
        elif kind == "new_session":
            c.reset_session()
            self.reset.clear_resume_point()
            self.baseline_run = self.retry_run = self.last_decision = None
            self.broadcast({"type": "session"})
        elif kind == "toggle_cue_next":
            self.cue_next_off = c.toggle_cue_next_try()
            self.broadcast(self.health())
        elif kind == "resume":
            if self.reset.resume_point is None:
                return self._note("nothing to resume")
            if c.state == DECIDING:
                return self._note("wait for the decision, then resume")
            self._spawn(self.reset.resume())
        elif kind == "retry_reset":
            if c.state != AWAIT_RESET and self.reset.status != "failed":
                return self._note("no reset to retry")
            self._spawn(self.reset.retry())
        elif kind == "toggle_mute":
            if self.announcer is None:
                return self._note("voice is off (--voice)")
            self.announcer.toggle_mute()
            self.broadcast(self.health())
        elif kind == "mark_board":
            self.mark_board(msg.get("board_m"))

    def set_reference(self) -> bool:
        if self.track is not None:
            return self._set_track_reference()
        run = self.last_valid_run
        if run is None:
            self._note("no valid run to use as reference")
            return False
        a = Attempt.from_dict(run["attempt"])
        self.reference, self.reference_trace = a, run["trace"]
        self.coach.reference = a
        if self.coach.agent is not None:
            self.coach.agent.set_reference(a, run["trace"])
        self.data_dir.mkdir(parents=True, exist_ok=True)
        ad = {k: v for k, v in run["attempt"].items() if k != "brake_board_m"}
        (self.data_dir / "reference.json").write_text(json.dumps(ad), encoding="utf-8")
        (self.data_dir / "reference_trace.json").write_text(json.dumps(run["trace"]), encoding="utf-8")
        self.broadcast({"type": "reference", "attempt": run["attempt"], "trace": run["trace"]})
        return True

    def _set_track_reference(self) -> bool:
        """Whole lap: every valid corner of the last lap becomes that corner's reference."""
        last = self.last_lap_runs
        valid = {cid: (a, tr) for cid, (a, tr) in (last or {}).get("runs", {}).items() if a.valid}
        if not valid:
            self._note("no valid lap to use as reference")
            return False
        for cid, (a, tr) in valid.items():
            self.coach.set_reference(cid, Attempt.from_dict(asdict(a)), tr)
        doc = {"source": f"Set reference, lap {last['lap']}", "corners": {
            cid: {"attempt": asdict(c.reference), "trace": c.reference_trace} for cid, c in self.coach.ctx.items()}}
        self.data_dir.mkdir(parents=True, exist_ok=True)
        (self.data_dir / "track_reference.json").write_text(json.dumps(doc), encoding="utf-8")
        kept = [cid for cid in self.track.ids if cid not in valid]
        self.broadcast({"type": "reference", "attempt": {"attempt_id": f"lap {last['lap']}"},
                        "corners": sorted(valid), "kept": kept})
        self.broadcast(self._focus_event())
        return True

    def mark_board(self, board_m: Any = None) -> dict | None:
        """Step 0: drive slowly past each brake board and press the hotkey; logs the position."""
        if self.latest is None:
            self._note("no telemetry: cannot mark a board")
            return None
        path = self.data_dir / "boards.json"
        try:
            marks = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
        except ValueError:
            marks = []
        rec = {"pos_m": round(self.latest.pos_m, 1), "board_m": board_m,
               "x": self.latest.x, "z": self.latest.z, "ts": time.time()}
        marks.append(rec)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(marks, indent=1), encoding="utf-8")
        self.broadcast({"type": "status", "state": self.coach.state,
                        "message": f"board marked at {rec['pos_m']:.0f} m ({len(marks)} in data/boards.json)"})
        return rec

    # -- lifecycle --
    async def start(self) -> None:
        self._loop, self._loop_thread = asyncio.get_running_loop(), threading.get_ident()
        if self.inputs is not None:
            await self.inputs.start()
        self._main = [asyncio.create_task(self._telemetry_loop()),
                      asyncio.create_task(self._health_loop())]
        self._spawn(ladder.warm_up(self.providers))

    async def stop(self) -> None:
        if self.sim is not None:
            self.sim.stop()
        for t in self._main + list(self._tasks):
            t.cancel()
        await asyncio.gather(*self._main, *self._tasks, return_exceptions=True)
        if self.inputs is not None:
            await self.inputs.stop()
        if self.recorder:
            self.recorder.close()

    async def wait_for(self, pred: Callable[[], bool], timeout: float = 30.0) -> None:
        end = time.monotonic() + timeout
        while not pred():
            if time.monotonic() > end:
                raise TimeoutError("condition not met")
            await asyncio.sleep(0.01)
