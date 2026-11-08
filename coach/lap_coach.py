"""LapCoach: every error on the lap gets a cue and a retry offer (ROLLING_CHECKPOINTS.md, E3-E5).

    CornerPass (PassScorer) -> EventDetector -> CheckpointPicker (+ HOLD) -> OfferManager
        -> cue: the coach decides on that corner's attempt with the live budget (fast, 2 s);
           no drill to offer (flat corner, no usable attempt) -> a short rules cue from the event
        -> countdown from the moment the cue is out -> tap (dashboard, phone Next) or it expires
        -> accept: think-mode analysis requested at once; rewind to the held state (SAVE resume,
           3-2-1, RESTORE, telemetry confirm); then today's retry loop (drill offers) or, with no
           drill, rewind until the detector finds the corner clean or the retry limit; RESUME.

While a retry loop runs, errors elsewhere are ignored. Personal bests come from normal laps only.

Combined with the lap coach (--track ... --mode lap, "standalone" here): the lap coach owns the app's
coach, so the cue is the decision ladder's answer on the event packet (same 2 s budget), retries are
judged by the detector after one confirmed rewind, and driving continues from the retried corner.
The cue is spoken ahead of the lap coach's advice and starts the offer timer on the straight.
"""
from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Any

from engine import ladder
from engine.evidence import build_packet
from engine.state import AWAIT_RESET, DONE, IDLE, OFFERED, RETRY
from engine.voice import OFFER

from .events import CheckpointPicker, CornerEvent, EventDetector, RetryStart
from .offers import Offer, OfferManager
from .corner_pass import CornerPass, PassScorer

if TYPE_CHECKING:
    from .app import CoachApp

LIVE_BUDGET = {"think_deadline_s": 0.0, "fast_deadline_s": 2.0, "total_deadline_s": 2.0}
KIND_TEXT = {"wheels_off": "wheels off", "spin": "spin", "lockup": "front lock-up", "wheelspin": "wheelspin",
             "speed_loss": "slow through the apex", "time_lost": "time lost", "brake_late": "braked late",
             "brake_early": "braked early"}


def rules_cue(ev: CornerEvent) -> str:
    what = ", ".join(KIND_TEXT.get(k, k) for k in ev.kinds[:2])
    lost = ev.facts.get("time_lost_s", 0)
    tail = f", {lost:.1f} s down" if lost >= 0.1 else ""
    return f"{ev.corner}: {what}{tail}."


class LapCoach:
    def __init__(self, app: "CoachApp", detector: EventDetector | None = None,
                 picker: CheckpointPicker | None = None, offers: OfferManager | None = None,
                 store: Any = None, max_retries: int = 5, tick_s: float = 0.05,
                 live_budget: dict | None = None):
        self.app, self.track = app, app.track_model
        self.detector = detector or EventDetector()
        self.picker = picker or CheckpointPicker(self.track, lead_s=app.lead_time_s)
        self.offers = offers or OfferManager(on_change=app.broadcast)
        if offers is not None and offers.on_change is None:
            offers.on_change = app.broadcast
        self.store, self.max_retries, self.tick_s = store, max_retries, tick_s
        self.live_budget = dict(live_budget or LIVE_BUDGET)
        self.scorer = PassScorer(self.track, app.base_corner, self.on_pass)
        # combined with the lap coach: it owns app.coach, so offers don't use it
        self.standalone = getattr(app, "track", None) is not None
        self.retrying: Offer | None = None     # the accepted offer whose retry loop is running
        self._tries = 0
        self._retry_ready = False
        self._cue_for: dict[str, str] = {}      # coach attempt_id -> offer id waiting for its cue
        self._task: asyncio.Task | None = None
        self.passes = 0
        self.ofr_every_s = 0.25                  # phone offer resend rate (UDP may drop packets)
        self._ofr_at = -1.0
        self._pushed: str | None = None          # offer id last shown on the phone

    # -- lifecycle --
    def start(self) -> None:
        self._task = asyncio.create_task(self._ticker())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _ticker(self) -> None:
        while True:
            await asyncio.sleep(self.tick_s)
            o = self.offers.current
            was_open = o is not None and o.state == "open"
            await self._drop(self.offers.tick())
            if was_open and o.state == "expired" and self.retrying is None:
                self._release_coach()
            self._push_phone()

    def _push_phone(self) -> None:
        """ofr,<id>,<corner>,<ms left> about 4x/s while an offer is open; ofx,<id> (3x) when it closes."""
        hub = self.app.inputs
        if hub is None:
            return
        o, now = self.offers.open_offer(), self.offers.clock()
        if self._pushed is not None and (o is None or o.id != self._pushed):
            for _ in range(3):
                hub.send_phone(f"ofx,{self._pushed}")
            self._pushed = None
        if o is not None and now - self._ofr_at >= self.ofr_every_s - 1e-6:
            label = o.event.corner.replace(",", " ")[:24]
            hub.send_phone(f"ofr,{o.id},{label},{o.ms_left(now)}")
            self._ofr_at, self._pushed = now, o.id

    async def _drop(self, offers: list[Offer]) -> None:
        if self.store is None:
            return
        for o in offers:
            if self.retrying is None or o.id != self.retrying.id:
                await self.store.drop(o.id)

    def _release_coach(self) -> None:
        if self.standalone:
            return
        c = self.app.coach
        if c.state in (OFFERED, DONE):
            c.reset_session()
        c.decide_kwargs = dict(self.app.decide_kwargs_default)

    # -- telemetry --
    def on_sample(self, s: Any) -> None:
        self.scorer.add(s)

    def on_pass(self, p: CornerPass) -> None:
        self.passes += 1
        c = self.track.get(p.corner_id)
        ref = self.app.references.get(p.corner_id)
        if self.retrying is not None:
            if self._tries_judged_here(p):
                self._judge_retry(p, ref)
            return                                       # busy: errors elsewhere are ignored
        ev = self.detector.detect(p, ref, flat=c.major_only)
        if ev is None:
            if p.valid:
                self.app.references.offer(p, clean=True)  # normal laps only
            return
        self.app.broadcast({"type": "corner_event", **ev.summary()})
        self.app._spawn(self._raise(ev))

    async def _raise(self, ev: CornerEvent) -> None:
        c = self.track.get(ev.corner_id)
        start = await self._pin(ev, c)
        offer, dropped = self.offers.new(ev, start)
        await self._drop(dropped)
        if self.standalone:
            await self._standalone_cue(offer)
            return
        coach = self.app.coach
        if coach.state not in (IDLE, DONE, OFFERED):
            # the coach is still deciding an older event: this one gets the rules cue
            self.offers.cue_delivered(offer.id, rules_cue(ev), "rules")
            return
        if coach.state == OFFERED:
            coach.reset_session()
        attempt = ev.cpass.attempt
        if attempt is None or not attempt.valid or not self.app.select_corner(c.id):
            self.offers.cue_delivered(offer.id, rules_cue(ev), "rules")
            return
        coach.decide_kwargs = {**self.app.decide_kwargs_default, **self.live_budget}
        self._cue_for[attempt.attempt_id] = offer.id
        self.app.baseline_run = {"type": "run", "role": "baseline", "attempt": attempt.__dict__,
                                 "trace": ev.cpass.trace}
        self.app.capture_history({**self.app.baseline_run, "corner_id": ev.corner_id})
        await coach.on_scored(attempt, ev.cpass.trace, {"event": ev.summary()})

    async def _standalone_cue(self, offer: Offer) -> None:
        """Combined mode: the ladder decides on the event packet (live budget); rules cue otherwise."""
        ev = offer.event
        text, source = rules_cue(ev), "rules"
        a = ev.cpass.attempt
        if a is not None and a.valid:
            cfg = self.scorer.configs[ev.corner_id]
            packet = build_packet(a, ev.ref.as_attempt(), None, cfg, None, None)
            packet["event"] = ev.summary()
            offer.extra["packet"] = packet
            try:
                d, _ = await ladder.decide(packet, self.app.providers, **self.live_budget)
                if d.action == "offer_drill" and d.cue:
                    text, source = d.cue, d.mode
            except Exception:  # noqa: BLE001 - the rules cue stands
                pass
        self._deliver(offer, text, source)

    def _deliver(self, offer: Offer, text: str, source: str) -> None:
        """Speak the cue (offer priority, talk zones only); the countdown starts when it's spoken.
        Without voice the text shows at once."""
        ann = self.app.announcer
        if ann is None or ann.muted:
            self.offers.cue_delivered(offer.id, text, source)
            return
        offer.extra["voice"] = (text, source)
        ann.say(text, OFFER, offer_id=offer.id)

    def on_voice(self, e: dict) -> None:
        oid = e.get("offer_id")
        if not oid or e.get("status") not in ("speaking", "dropped", "error"):
            return
        o = self.offers.current
        if o is not None and o.id == oid and "voice" in o.extra:
            text, source = o.extra.pop("voice")
            self.offers.cue_delivered(oid, text, source)   # dropped (stale, muted): shown as text

    async def _pin(self, ev: CornerEvent, c: Any) -> RetryStart | None:
        if self.app.reset.mode == "sim":
            return self.picker.for_sim(c)
        if self.store is None:
            return None
        start = self.picker.pick(c, self.store, self.store.clock())
        if start is None or not await self.store.hold(ev.id, start.cp):
            return None
        return start

    # -- coach decisions (CoachApp._on_coach_event) --
    def on_coach_event(self, e: dict) -> None:
        if e["type"] != "decision":
            return
        oid = self._cue_for.pop(e.get("attempt_id", ""), None)
        if oid is None:
            return                                       # a retry judgement, not an event cue
        o = self.offers.current
        if o is None or o.id != oid:
            self.offers.cue_delivered(oid, e.get("cue") or e.get("summary") or "", e.get("mode", ""))
            return                                       # superseded meanwhile: history only
        if e["action"] == "offer_drill":
            o.extra["decision"] = self.app.coach.last_decision   # set before the event is emitted
            self.offers.cue_delivered(oid, e.get("cue", ""), e.get("mode", ""))
        else:                                            # rules: nothing to drill; offer a plain retry
            self.offers.cue_delivered(oid, rules_cue(o.event), "rules")
            self.app.coach.reset_session()

    # -- accept --
    def open_offer(self) -> Offer | None:
        return self.offers.open_offer()

    async def accept(self, offer_id: str | None = None) -> bool:
        if self.retrying is not None or self.app.reset.busy:
            self.app._note("a retry is already running")
            return False
        o = self.offers.accept(offer_id)
        if o is None:
            self.app._note("no offer to accept")
            return False
        app, coach = self.app, self.app.coach
        self.retrying, self._tries = o, 0
        self._retry_ready = False
        coach.decide_kwargs = dict(app.decide_kwargs_default)   # retries are judged in think mode
        app.reset.checkpoint = {"pos_m": o.start.pos_m, "speed_kmh": o.start.speed_kmh}
        app.reset.held_event = o.id if o.start.cp is not None else None
        if self.store is not None:
            self.store.extend(o.id, 300)
        decision = o.extra.get("decision")
        if decision is not None and coach.offer is not decision:
            if not (app.select_corner(o.event.corner_id) and coach.restore_offer(decision)):
                decision = None
        app.broadcast({"type": "retry_started", "offer_id": o.id, "corner": o.event.corner,
                       "drill": decision.drill_id if decision else None, "single_retry": self.standalone})
        app._spawn(self._analyse(o))
        if decision is not None:
            await coach.on_accept(decision.decision_id)          # today's loop from here
        else:
            await self._rewind(o)                                # detector-judged loop
        return True

    async def _rewind(self, o: Offer) -> None:
        app = self.app
        if self.standalone:
            self.scorer.abort()
            self._retry_ready = await app.reset.reset(f"{o.id}-1", abort_run=True, countdown=0,
                                                      resume_save_timeout_s=0.25)
            if not self._retry_ready:
                app.reset.checkpoint = None
                self.retry_finished(resumed=False)
            return
        if app.reset.resume_point is None and app.reset.can_resume and self._tries == 0:
            await app.reset.save_resume_point()
        await app.reset.reset(f"{o.id}-{self._tries + 1}")

    def _tries_judged_here(self, p: CornerPass) -> bool:
        o = self.retrying
        return (o is not None and o.extra.get("decision") is None and p.corner_id == o.event.corner_id
                and (not self.standalone or self._retry_ready))

    def _judge_retry(self, p: CornerPass, ref: Any) -> None:
        o = self.retrying
        self._tries += 1
        ev = self.detector.detect(p, ref, flat=self.track.get(p.corner_id).major_only)
        fixed = p.valid and ev is None
        self.app.broadcast({"type": "retry_judged", "offer_id": o.id, "try": self._tries, "fixed": fixed,
                            "kinds": ev.kinds if ev else []})
        if self.standalone:
            self.retry_finished(resumed=False)
        elif fixed or self._tries >= self.max_retries:
            self.app._spawn(self.app.reset.resume(f"{o.id}-done"))
        else:
            self.app._spawn(self._rewind(o))

    async def _analyse(self, o: Offer) -> None:
        """Opt-in: the deeper think-mode look at the error. Spoken if it lands before the braking
        point of the first retry, otherwise shown only."""
        packet = (o.extra.get("packet") if self.standalone else
                  self.app.coach.last_packet if o.extra.get("decision") is not None else None)
        if packet is None or not self.app.providers:
            return
        try:
            d, _ = await ladder.decide(packet, self.app.providers)
        except Exception:  # noqa: BLE001
            return
        if d.mode == "rules" or not (d.cue or d.summary):
            return
        text = d.cue or d.summary
        c = self.track.get(o.event.corner_id)
        s = self.app.latest
        busy = self.retrying is o if self.standalone else self.app.coach.state in (AWAIT_RESET, RETRY)
        in_time = (s is not None and busy
                   and 0 < self.track.ai_time(s.pos_m, c.key_m) < 20)
        self.app.broadcast({"type": "offer_analysis", "offer_id": o.id, "text": text, "mode": d.mode,
                            "spoken": in_time})
        if in_time and self.app.announcer:
            self.app.announcer.say(text, "advice", decision_id=d.decision_id, mode=d.mode)

    def retry_finished(self, *, resumed: bool = True) -> None:
        """Release the offer after a one-shot attempt, failed rewind, or confirmed resume."""
        o, self.retrying = self.retrying, None
        self._retry_ready = False
        self.app.reset.held_event = None
        self._release_coach()
        if o is not None:
            self.app.broadcast({"type": "retry_finished", "offer_id": o.id, "resumed": resumed})
            if self.store is not None:
                self.app._spawn(self.store.drop(o.id))
