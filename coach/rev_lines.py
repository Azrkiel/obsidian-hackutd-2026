"""Rev's own lines: a short reaction to a notable moment (a quick lap, a fixed corner, a slow lap).

Nemotron writes the line in fast mode with a tight deadline; if no provider answers in time, or the
answer is unusable, a rules line is used instead, so Rev is never silent for want of a model and the
coach never waits on one. The line goes out as a `rev_line` event (the overlay shows it) and through
the announcer (so it is spoken only where the driver can hear it: straights, never in a corner).
"""
from __future__ import annotations

import asyncio
import json
import re
import time
from typing import Any, Callable

SYSTEM = (
    "You are Rev, a small pixel-art pit-crew companion beside a driver in a racing sim. React to ONE "
    "driving moment in at most 9 words. Speak to the driver as 'you'. Plain racing words, calm, like a "
    "pit-wall coach. No emoji, no exclamation marks, no questions, no quotes. Use only the facts given. "
    "Reply with the line only.")

RULES = {
    "fixed": ("good", "Fixed. That's the line."),
    "quick_lap": ("good", "Quick lap. Hold that pace."),
    "slow_lap": ("bad", "Slow lap. Reset and go again."),
}
MAX_WORDS = 12


def clean(text: str) -> str | None:
    """One plain sentence, or None if the model's answer is not usable as a spoken line."""
    t = " ".join((text or "").replace("\n", " ").split()).strip(" \"'`")
    t = re.sub(r"[!?]+", ".", t)
    if not t or len(t.split()) > MAX_WORDS or len(t) > 90 or re.search(r"[^\x20-\x7e]", t):
        return None
    return t if t.endswith(".") else t + "."


class RevLines:
    def __init__(self, app: Any, timeout_s: float = 1.6, min_gap_s: float = 10.0,
                 clock: Callable[[], float] = time.monotonic):
        self.app, self.timeout_s, self.min_gap_s, self.clock = app, timeout_s, min_gap_s, clock
        self._last = -1e9

    @staticmethod
    def moment(e: dict) -> dict | None:
        t = e.get("type")
        if t == "retry_judged" and e.get("fixed"):
            return {"kind": "fixed", "facts": {"tries_needed": e.get("try")}}
        if t == "track_lap" and e.get("lap_time_s"):
            d = float(e.get("delta_s") or 0.0)
            if d <= -0.15:
                return {"kind": "quick_lap", "facts": {"lap_time_s": round(e["lap_time_s"], 2), "corners_delta_s": round(d, 2)}}
            if d >= 0.5:
                return {"kind": "slow_lap", "facts": {"lap_time_s": round(e["lap_time_s"], 2), "corners_delta_s": round(d, 2)}}
        return None

    def on_event(self, e: dict) -> None:
        m = self.moment(e)
        if m is None or self.clock() - self._last < self.min_gap_s:
            return
        self._last = self.clock()
        try:
            self.app._spawn(self.line(m))
        except RuntimeError:        # no event loop (a sync caller): skip, never break the coach
            pass

    async def _ask(self, m: dict) -> str | None:
        for p in getattr(self.app, "providers", []):
            if not getattr(p, "available", False) or not hasattr(p, "say"):
                continue
            try:
                text = await asyncio.wait_for(
                    p.say(SYSTEM, json.dumps({"moment": m["kind"], **m["facts"]}, separators=(",", ":"))),
                    self.timeout_s)
            except Exception:  # noqa: BLE001 - a model problem must never reach the driver
                continue
            if clean(text):
                return clean(text)
        return None

    async def line(self, m: dict) -> dict:
        mood, fallback = RULES[m["kind"]]
        text = await self._ask(m)
        ev = {"type": "rev_line", "text": text or fallback, "mood": mood,
              "source": "nemotron" if text else "rules", "moment": m["kind"]}
        self.app.broadcast(ev)
        if getattr(self.app, "announcer", None) is not None:
            self.app.announcer.say(ev["text"], "advice", mode="rev")
        return ev
