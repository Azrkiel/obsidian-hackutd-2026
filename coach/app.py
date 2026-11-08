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
from engine.models import Attempt, CornerConfig
from engine.state import AWAIT_RESET, DECIDING, DONE, IDLE, OFFERED, RETRY, Coach
from engine.trace import TraceWriter
from engine.voice import ADVICE, REMINDER, VERDICT, Announcer

from .inputs import InputHub, RunInputs, dropout_reason
from .reset import ResetManager
from .scorer import CornerScorer
from .telemetry import Recorder, Sample, SimSource

COMMANDS = {"accept", "retry", "save_checkpoint", "set_reference", "new_session",
            "toggle_cue_next", "retry_reset", "toggle_mute", "mark_board", "resume",
            "new_pairing", "select_corner", "accept_offer", "settings", "reset_personal_best"}
LAP_TOTAL_DEADLINE_S = 8.0  # lap mode: slower than this and the rules sentence is spoken instead
ACTIVITY_TYPES = {"run", "decision", "reset_request", "reset_confirmed", "reset_failed",
                  "checkpoint", "reference", "session", "input", "resume_point", "resumed", "corner"}


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
                 track: Any = None, references: Any = None, lead_time_s: float = 4.0,
                 whole_lap: bool = False, store: Any = None):
        if mode not in ("drill", "lap"):
            raise ValueError(f"mode must be drill or lap, not {mode!r}")
        self.mode = mode
        self.corner, self.source, self.providers = corner, source, providers
        # whole-lap mode (coach.track.Track): `corner` is the base config (tolerances, drill limits);
        # select_corner() points every per-corner piece at one corner of the track
        self.track, self.references, self.lead_time_s = track, references, lead_time_s
        self.base_corner, self.corner_id = corner, None
        self._agent = agent
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
        self.announcer = Announcer(speaker, quiet_zone=(corner.start_gate_m, corner.exit_gate_m),
                                   on_event=self._threadsafe_broadcast, muted=muted,
                                   **(announcer_kwargs or {})) if speaker is not None else None
        say = (lambda text: self.announcer.say(text, REMINDER)) if self.announcer else None
        self.live_cue = LiveCue(corner, self.player, say=say)
        self.trace = TraceWriter(trace_dir)
        self.scorer = CornerScorer(corner, self._on_run)
        self.sim = source if isinstance(source, SimSource) or hasattr(source, "teleport_to") else None
        self.reset = ResetManager(
            reset_mode, self.broadcast, self._on_reset_confirmed, scorer=self.scorer, sim=self.sim,
            checkpoint_path=self.data_dir / "checkpoint.json" if persist_checkpoint else None,
            countdown=countdown, tick_s=tick_s, on_resumed=self._on_resumed, **(reset_kwargs or {}))
        if isinstance(self.sim, SimSource) and reset_mode == "sim" and not self.reset.checkpoint:
            self.reset.set_checkpoint(self.sim.start_pos_m, self.sim.v0_kmh)
            self.activity.clear()
        dk = dict(decide_kwargs or {})
        if mode == "lap":
            dk.setdefault("total_deadline_s", LAP_TOTAL_DEADLINE_S)
        self.decide_kwargs_default = dict(dk)
        self.coach = Coach(corner, reference, providers, self._on_coach_event, self._request_reset,
                           trace=self.trace, live_cue=self.live_cue, decide_kwargs=dk,
                           lap_mode=mode == "lap",
                           agent=AgentSession(corner, reference, self.reference_trace) if agent else None)
        # whole-lap mode: every error on the lap gets a cue and a retry offer (coach.lap_coach)
        self.store, self.lap_coach, self.settings = store, None, None
        if whole_lap:
            if track is None or references is None:
                raise ValueError("whole-lap mode needs a track and references")
            from .lap_coach import LapCoach
            self.auto_retry = True   # an accepted offer runs the retry loop and resumes at the end
            self.reset.store = store
            self.lap_coach = LapCoach(self, store=store, max_retries=max_retries)
            from .settings import Settings, SettingsStore
            # a saved settings file (the settings page) wins over the command-line defaults
            self.settings = SettingsStore(self.data_dir / "settings.json",
                                          Settings(reference=references.mode, lead_time_s=lead_time_s))
            self._apply_settings(self.settings.value.to_dict())

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
        if t == "corner":
            return f"coaching {e['name']}"
        if t == "input":
            return e["message"]
        if t == "resume_point":
            return f"resume point saved at {e['pos_m']:.0f} m, {e['speed_kmh']:.0f} km/h"
        if t == "resumed":
            return "drill ended; back to free driving"
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
            if e["action"] == "offer_drill" and self.sim is not None:
                if e.get("drill_id") == "brake_point":
                    self.sim.set_target_board(e["target"]["marker_m"])
                elif e.get("drill_id") == "brake_release":
                    self.sim.set_target_release(e["target"]["release_s"])
        self.broadcast(e)
        if e["type"] == "decision":
            self._speak_decision(e)
        if self.lap_coach is not None:
            self.lap_coach.on_coach_event(e)
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
        elif self.lap_coach is not None and self.lap_coach.open_offer():
            self._spawn(self.handle_command({"type": "accept_offer"}))
        elif self.mode == "lap":
            self._note("next does nothing in lap mode")
        elif c.state == OFFERED and c.offer:
            self._spawn(self.handle_command({"type": "accept", "decision_id": c.offer.decision_id}))
        else:
            self._spawn(self.handle_command({"type": "retry"}))

    def _on_resumed(self) -> None:
        self.coach.reset_session()
        self.broadcast({"type": "resumed"})
        if self.lap_coach is not None:
            self.lap_coach.retry_finished()

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
        if self.lap_coach is not None and state != RETRY:
            return   # whole-lap: first attempts reach the coach as error events (LapCoach), not here
        await self.coach.on_scored(attempt, trace, {"inputs": inputs} if inputs else None)

    # -- telemetry --
    def _on_sample(self, s: Sample) -> None:
        self.latest, self._latest_at = s, time.monotonic()
        if self.recorder:
            self.recorder.write(s)
        self.reset.on_sample(s)
        if self.announcer:
            self.announcer.on_position(s.pos_m)
        self.live_cue.on_sample(s.t, s.pos_m, s.speed_kmh)
        if self.inputs is not None:
            if self.scorer.in_run:
                self._run_inputs.add(self.inputs.snapshot(), s.gas, s.brake)
            elif self._run_inputs.n:
                self._run_inputs = RunInputs()  # the last run was aborted
        self.scorer.add(s)
        if self.lap_coach is not None:
            self.lap_coach.on_sample(s)
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
            "offers": self.lap_coach.offers.snapshot() if self.lap_coach else None,
            "references": self.references.summary() if self.references else None,
            "settings": self.settings.value.to_dict() if self.settings else None,
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
        if kind == "accept_offer" or (kind == "accept" and self.lap_coach is not None
                                      and (self.lap_coach.open_offer() or msg.get("offer_id"))):
            if self.lap_coach is None:
                return self._note("accept_offer needs whole-lap mode")
            self._spawn(self.lap_coach.accept(msg.get("offer_id")))
        elif kind == "accept":
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
        elif kind == "select_corner":
            self.select_corner(str(msg.get("corner_id", "")))
        elif kind == "settings":
            try:
                await self.update_settings(msg.get("changes") or {})
            except ValueError as e:
                self._note(f"settings: {e}")
        elif kind == "reset_personal_best":
            self.reset_personal_best()
        elif kind == "new_session":
            c.reset_session()
            self.reset.clear_resume_point()
            self.baseline_run = self.retry_run = self.last_decision = None
            self.broadcast({"type": "session"})
        elif kind == "toggle_cue_next":
            self.cue_next_off = c.toggle_cue_next_try()
            self.broadcast(self.health())
        elif kind == "new_pairing":
            if self.inputs is None or self.inputs.pairing is None:
                return self._note("pairing is off (start with --inputs)")
            self.inputs.new_pairing_code()
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

    def select_corner(self, corner_id: str, reference: Attempt | None = None) -> bool:
        """Coach one corner of the track: scorer, live cue, quiet zone, agent and the coach itself.
        Between drills only. In sim reset mode the checkpoint moves to the corner's anchor."""
        if self.track is None:
            self._note("select_corner needs a track")
            return False
        c = self.track.get(corner_id)
        if c is None:
            self._note(f"unknown corner {corner_id!r}")
            return False
        cfg = self.track.corner_config(c, self.base_corner)
        if reference is None:
            reference = self.references.get(corner_id).as_attempt() if self.references else self.reference
        if not self.coach.set_corner(cfg, reference):
            return False
        self.corner, self.corner_id = cfg, corner_id
        self.reference, self.reference_trace = reference, []
        if self.scorer.in_run:
            self.scorer.abort()
        self.scorer = CornerScorer(cfg, self._on_run)
        self.reset.scorer = self.scorer
        self.live_cue.corner = cfg
        self.live_cue.disarm()
        if self.announcer:
            self.announcer.quiet_zone = (cfg.start_gate_m, cfg.exit_gate_m)
        if self._agent:
            self.coach.agent = AgentSession(cfg, reference, [])
        self.baseline_run = self.retry_run = self.last_run = self.last_valid_run = None
        self._run_inputs = RunInputs()
        if self.reset.mode == "sim":
            anchor = self.track.anchor_m(c, self.lead_time_s)
            self.reset.set_checkpoint(anchor, self.track.ai_kmh(anchor))
        self.broadcast({"type": "corner", "corner_id": corner_id, "name": c.name, "kind": c.kind})
        return True

    # -- whole-lap settings (coach.settings) --
    def _apply_settings(self, v: dict) -> None:
        lc = self.lap_coach
        if "reference" in v:
            self.references.mode = v["reference"]
        if "sensitivity_s" in v:
            lc.detector.th.time_lost_s = v["sensitivity_s"]
        if "countdown_s" in v:
            lc.offers.countdown_s = v["countdown_s"]          # from the next offer on
        if "lead_time_s" in v:
            self.lead_time_s = lc.picker.lead_s = v["lead_time_s"]
        if "voice" in v and self.announcer is not None:
            self.announcer.set_muted(not v["voice"])

    async def update_settings(self, changes: dict) -> dict:
        """Validate, save and apply a partial update (raises SettingsError). Returns what changed."""
        if self.settings is None:
            raise ValueError("settings need whole-lap mode")
        changed = self.settings.update(changes)
        if changed:
            self._apply_settings(changed)
            if "lead_time_s" in changed and self.store is not None and self.store._transport is not None:
                await self.store.configure(anchors=self.track.anchor_splines(self.lead_time_s))
            self.broadcast({"type": "settings", "changed": sorted(changed), **self.settings.value.to_dict()})
        return changed

    def reset_personal_best(self) -> bool:
        if self.references is None:
            self._note("no personal bests outside whole-lap mode")
            return False
        self.references.reset()
        self.broadcast({"type": "references", **self.references.summary()})
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
        if self.store is not None:
            await self.store.start()
            await self.store.configure(anchors=self.track.anchor_splines(self.lead_time_s))
        if self.lap_coach is not None:
            self.lap_coach.start()

    async def stop(self) -> None:
        if self.sim is not None:
            self.sim.stop()
        if self.lap_coach is not None:
            await self.lap_coach.stop()
        if self.store is not None:
            await self.store.stop()
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
