"""OfferManager: the retry offer for each error event (ROLLING_CHECKPOINTS.md, E4).

    waiting_cue --cue delivered--> open (countdown) --tap--> accepted
                                        |--time up--> expired
    any state but accepted --a newer event--> superseded

One current offer; the newest event replaces it. Expired and superseded offers stay retryable from
the history while their held checkpoint lives (hold_s, at most max_history); the manager returns
the ones that fall out so the caller can DROP their holds. The countdown starts when the cue is
delivered (voice starts, or text shown with voice off), not when the event fires.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Callable

from .events import CornerEvent, RetryStart

WAITING, OPEN, ACCEPTED, EXPIRED, SUPERSEDED = "waiting_cue", "open", "accepted", "expired", "superseded"


@dataclass
class Offer:
    id: str                          # = the event id
    event: CornerEvent
    start: RetryStart | None
    state: str = WAITING
    cue: str = ""
    cue_source: str = ""             # model | rules
    created: float = 0.0
    deadline: float | None = None
    closed: float | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    @property
    def retryable(self) -> bool:
        return self.start is not None

    def ms_left(self, now: float) -> int:
        return max(0, int(round(((self.deadline or now) - now) * 1000))) if self.state == OPEN else 0

    def to_dict(self, now: float) -> dict:
        return {"id": self.id, "state": self.state, "corner_id": self.event.corner_id,
                "corner": self.event.corner, "severity": self.event.severity, "kinds": self.event.kinds,
                "facts": self.event.facts, "cue": self.cue, "cue_source": self.cue_source,
                "retryable": self.retryable, "ms_left": self.ms_left(now),
                "start": None if self.start is None else {"source": self.start.source,
                                                          "pos_m": round(self.start.pos_m, 1)}}


class OfferManager:
    def __init__(self, countdown_s: float = 5.0, hold_s: float = 60.0, max_history: int = 5,
                 clock: Callable[[], float] = time.monotonic, on_change: Callable[[dict], None] | None = None):
        self.countdown_s, self.hold_s, self.max_history = countdown_s, hold_s, max_history
        self.clock, self.on_change = clock, on_change or (lambda e: None)
        self.current: Offer | None = None
        self.history: list[Offer] = []   # newest first

    def _emit(self, o: Offer) -> None:
        self.on_change({"type": "offer", **o.to_dict(self.clock())})

    def _retire(self, o: Offer, state: str) -> list[Offer]:
        o.state, o.closed = state, self.clock()
        self._emit(o)
        dropped = []
        if o.retryable:
            self.history.insert(0, o)
            while len(self.history) > self.max_history:
                dropped.append(self.history.pop())
        return dropped

    def new(self, event: CornerEvent, start: RetryStart | None) -> tuple[Offer, list[Offer]]:
        """A new event's offer. Returns it and the offers whose holds can go."""
        dropped: list[Offer] = []
        if self.current is not None and self.current.state in (WAITING, OPEN):
            dropped = self._retire(self.current, SUPERSEDED)
        o = Offer(event.id, event, start, created=self.clock())
        self.current = o
        self._emit(o)
        return o, dropped

    def cue_delivered(self, offer_id: str, cue: str, source: str) -> bool:
        o = self.current
        if o is None or o.id != offer_id or o.state != WAITING:
            if o is not None and o.id == offer_id and o.state == OPEN:
                return False          # a late model answer: the rules cue is already out
            for h in self.history:    # a late answer for an older offer: keep it for the history
                if h.id == offer_id:
                    h.extra["late_cue"] = cue
            return False
        o.cue, o.cue_source, o.state = cue, source, OPEN
        o.deadline = self.clock() + self.countdown_s
        self._emit(o)
        return True

    def accept(self, offer_id: str | None = None) -> Offer | None:
        """The open offer (no id, or its id), or a history entry that's still retryable."""
        o = self.current
        if o is not None and o.state == OPEN and offer_id in (None, o.id) and o.retryable:
            o.state, o.closed = ACCEPTED, self.clock()
            self._emit(o)
            return o
        if offer_id is None:
            return None
        for h in self.history:
            if h.id == offer_id and self.clock() - h.created <= self.hold_s:
                self.history.remove(h)
                h.state, h.closed = ACCEPTED, self.clock()
                self._emit(h)
                return h
        return None

    def tick(self) -> list[Offer]:
        """Expire the open offer when time is up and age out the history. Returns offers to drop."""
        now, dropped = self.clock(), []
        o = self.current
        if o is not None and o.state == OPEN and o.deadline is not None and now >= o.deadline:
            dropped += self._retire(o, EXPIRED)
        keep = []
        for h in self.history:
            (keep if now - h.created <= self.hold_s else dropped).append(h)
        self.history = keep
        return dropped

    def open_offer(self) -> Offer | None:
        o = self.current
        return o if o is not None and o.state == OPEN else None

    def snapshot(self) -> dict:
        now = self.clock()
        return {"current": None if self.current is None else self.current.to_dict(now),
                "history": [h.to_dict(now) for h in self.history]}
