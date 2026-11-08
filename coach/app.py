"""CoachApp: wires telemetry -> scorer -> engine Coach, reset manager, live cue, dashboard broadcast."""
from __future__ import annotations

import asyncio
import json
import sys
import time
from collections import deque
from dataclasses import asdict
from pathlib import Path
from typing import Any, Callable

from engine import ladder
from engine.live_cue import LiveCue, NullPlayer
from engine.models import Attempt, CornerConfig
from engine.state import AWAIT_RESET, DONE, IDLE, OFFERED, RETRY, Coach
from engine.trace import TraceWriter

from .reset import ResetManager
from .scorer import CornerScorer
from .telemetry import Recorder, Sample, SimSource

COMMANDS = {"accept", "retry", "save_checkpoint", "set_reference", "new_session",
            "toggle_cue_next", "retry_reset"}
ACTIVITY_TYPES = {"run", "decision", "reset_request", "reset_confirmed", "reset_failed",
                  "checkpoint", "reference", "session"}


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
                 reset_kwargs: dict | None = None):
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
        self._health_key: str | None = None
        self.player = _make_player(sound)
        self.live_cue = LiveCue(corner, self.player)
        self.trace = TraceWriter(trace_dir)
        self.scorer = CornerScorer(corner, self._on_run)
        self.sim = source if isinstance(source, SimSource) else None
        self.reset = ResetManager(
            reset_mode, self.broadcast, self._on_reset_confirmed, scorer=self.scorer, sim=self.sim,
            checkpoint_path=self.data_dir / "checkpoint.json" if persist_checkpoint else None,
            countdown=countdown, tick_s=tick_s, **(reset_kwargs or {}))
        if self.sim is not None and reset_mode == "sim" and not self.reset.checkpoint:
            self.reset.set_checkpoint(self.sim.start_pos_m, self.sim.v0_kmh)
            self.activity.clear()
        self.coach = Coach(corner, reference, providers, self._on_coach_event, self._request_reset,
                           trace=self.trace, live_cue=self.live_cue,
                           decide_kwargs=decide_kwargs or {})

    # -- broadcast --
    def subscribe(self, cb: Callable[[dict], None]) -> Callable[[], None]:
        self._subs.append(cb)
        return lambda: self._subs.remove(cb) if cb in self._subs else None

    def broadcast(self, event: dict) -> None:
        event = {"ts": time.time(), **event}
        if event["type"] != "health":
            self.events.append(event)
            del self.events[:-2000]
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
            return f"reset requested ({e['mode']})"
        if t == "reset_confirmed":
            return "reset confirmed: car at checkpoint"
        if t == "reset_failed":
            return f"reset failed: {e['reason']}"
        if t == "checkpoint":
            return f"checkpoint saved at {e['pos_m']:.0f} m, {e['speed_kmh']:.0f} km/h"
        if t == "reference":
            return f"reference set from {e['attempt']['attempt_id']}"
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
            if e["action"] == "offer_drill" and self.sim is not None and e.get("drill_id") == "brake_point":
                self.sim.set_target_board(e["target"]["marker_m"])
        self.broadcast(e)

    async def _request_reset(self, decision_id: str) -> None:
        await self.reset.reset(decision_id)

    def _on_reset_confirmed(self) -> None:
        if self.coach.state == AWAIT_RESET:
            self.coach.on_reset_confirmed()

    def _on_run(self, attempt: Attempt, trace: list) -> None:
        self._spawn(self._handle_run(attempt, trace))

    async def _handle_run(self, attempt: Attempt, trace: list) -> None:
        if self.coach.state == DONE:
            # a finished drill (or "no coaching needed") must not block the next lap:
            # the next run through the corner is a fresh baseline (demo: clean run, then late brake)
            self.coach.reset_session()
            self.baseline_run = self.retry_run = None
        state = self.coach.state
        role = "retry" if state == RETRY else "baseline" if state == IDLE else "reference_candidate"
        d = asdict(attempt)
        d["brake_board_m"] = round(self.corner.board_zero_m - attempt.brake_onset_m, 1) if attempt.valid else None
        ev = {"type": "run", "role": role, "attempt": d, "trace": trace}
        self.last_run = ev
        if attempt.valid:
            self.last_valid_run = ev
        if role == "baseline":
            self.baseline_run, self.retry_run = ev, None
        elif role == "retry":
            self.retry_run = ev
        self.broadcast(ev)
        await self.coach.on_scored(attempt)

    # -- telemetry --
    def _on_sample(self, s: Sample) -> None:
        self.latest, self._latest_at = s, time.monotonic()
        if self.recorder:
            self.recorder.write(s)
        self.reset.on_sample(s)
        self.live_cue.on_sample(s.t, s.pos_m, s.speed_kmh)
        self.scorer.add(s)

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
        }

    async def _health_loop(self) -> None:
        while True:
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
            self.baseline_run = self.retry_run = self.last_decision = None
            self.broadcast({"type": "session"})
        elif kind == "toggle_cue_next":
            self.cue_next_off = c.toggle_cue_next_try()
            self.broadcast(self.health())
        elif kind == "retry_reset":
            if c.state != AWAIT_RESET and self.reset.status != "failed":
                return self._note("no reset to retry")
            self._spawn(self.reset.retry())

    def set_reference(self) -> bool:
        run = self.last_valid_run
        if run is None:
            self._note("no valid run to use as reference")
            return False
        a = Attempt.from_dict(run["attempt"])
        self.reference, self.reference_trace = a, run["trace"]
        self.coach.reference = a
        self.data_dir.mkdir(parents=True, exist_ok=True)
        ad = {k: v for k, v in run["attempt"].items() if k != "brake_board_m"}
        (self.data_dir / "reference.json").write_text(json.dumps(ad), encoding="utf-8")
        (self.data_dir / "reference_trace.json").write_text(json.dumps(run["trace"]), encoding="utf-8")
        self.broadcast({"type": "reference", "attempt": run["attempt"], "trace": run["trace"]})
        return True

    # -- lifecycle --
    async def start(self) -> None:
        self._main = [asyncio.create_task(self._telemetry_loop()),
                      asyncio.create_task(self._health_loop())]
        self._spawn(ladder.warm_up(self.providers))

    async def stop(self) -> None:
        if self.sim is not None:
            self.sim.stop()
        for t in self._main + list(self._tasks):
            t.cancel()
        await asyncio.gather(*self._main, *self._tasks, return_exceptions=True)
        if self.recorder:
            self.recorder.close()

    async def wait_for(self, pred: Callable[[], bool], timeout: float = 30.0) -> None:
        end = time.monotonic() + timeout
        while not pred():
            if time.monotonic() > end:
                raise TimeoutError("condition not met")
            await asyncio.sleep(0.01)
