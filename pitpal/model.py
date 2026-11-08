"""Rev's brain: coach events in, one thing to show out. No Tk in here, so it is unit-tested.

Events are the dicts the coach streams on ws://127.0.0.1:8020/ws (see docs/PITPAL_OVERLAY.md), plus
three the overlay client adds itself: {"type": "_conn", "online": bool}, {"type": "_pair", "uri": str|None}.

What Rev wears (design system README: the helmet is for racing sessions only, plain white for
pairing and empty states):
    racer        the main form: idle, thinking, talking, offers
    helmet_suit  while you are driving (racing session)
    suit         the rewind countdown
    base         pairing, warnings, no coach
An outfit never changes while Rev is talking.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .reactions import Moment, Reactor

RACER, HELMET, SUIT, BASE = "racer", "helmet_suit", "suit", "base"
READ_MIN_S, READ_PER_CHAR_S = 2.0, 0.04
MAX_WORDS = 9              # a bubble is a glance, not a paragraph: the voice says the rest
MAX_REST_WORDS = 12        # the second sentence: the action ("Brake at the 100 board and turn in late.")
WARN_HOLD_S = 2.0          # a problem must last this long before Rev warns (cables wobble)
PAIR_GRACE_S = 2.5         # an already-paired phone usually reconnects on its own: wait before the QR
PARKED_S = 60.0            # stopped this long = a real stop (pits, restart): idle bubble and "Lights out." again


def read_time(text: str) -> float:
    return max(READ_MIN_S, 1.2 + len(text) * READ_PER_CHAR_S)


def _clip(s: str, n: int) -> str:
    words = s.split()
    return s if len(words) <= n else " ".join(words[:n]).rstrip(",;:.") + "…"


def split_cue(text: str) -> tuple[str, str]:
    """A cue for the bubble: the first sentence in bold (what happened), the next sentence regular
    (what to do: for lap cues this is Nemotron's action, so it must not be cut). Each is kept short."""
    text = " ".join((text or "").split())
    i = text.find(". ")
    if i < 0:
        return _clip(text, MAX_WORDS), ""
    first, rest = text[: i + 1], text[i + 2:]
    j = rest.find(". ")
    rest = rest if j < 0 else rest[: j + 1]
    return _clip(first, MAX_WORDS), _clip(rest, MAX_REST_WORDS)


@dataclass
class View:
    outfit: str
    anim: str
    anim_t0: float
    bubble: dict | None
    chip: dict | None            # {"dot": go|caution|brand, "label": str}
    muted: bool
    actions: list[str]           # shown on hover: accept | resume | mute
    flash: bool = False          # the frame right after an outfit swap
    card: dict = field(default_factory=dict)
    racing: bool = False


class RevModel:
    def __init__(self, reactor: Reactor | None = None):
        self.reactor = reactor or Reactor()
        self.online = False
        self.health: dict = {}
        self.first_health_at: float | None = None
        self.pair_uri: str | None = None
        self.phone_live = self.phone_ever_live = False
        self.arduino_ever_live = False
        self.tele: dict = {}
        self.tele_at = -1e9
        self._drive_since: float | None = None
        self._still_since: float | None = None
        self.racing = False
        self.session_started = False     # the car has driven this session
        self._was_parked = False         # stopped for PARKED_S since then
        self.talk_id: int | None = None
        self.talk_text = ""
        self.talk_until: float | None = None
        self.moment: tuple[Moment, float] | None = None       # (moment, until)
        self.offer: dict | None = None
        self.thinking_until = 0.0
        self.thinking_label = "Reading the corner…"
        self.countdown: int | None = None
        self.tries = 0
        self.max_tries = 5
        self.last_cue = ""
        self.last_lap = ""
        self._cond_since: dict[str, float] = {}
        self._warn_text: dict[str, tuple[str, str]] = {}
        self._outfit = BASE
        self._flash_until = 0.0
        self._anim, self._anim_t0 = "idle", 0.0
        self._ai_mode: str | None = None
        self._kind: str | None = None
        self.outbox: list[dict] = []     # commands for the coach (e.g. say a reaction out loud)

    # ---------------------------------------------------------------- input
    def feed(self, e: dict, now: float) -> None:
        t = e.get("type")
        h = getattr(self, f"_on_{t.lstrip('_')}", None) if isinstance(t, str) else None
        if h is not None:
            h(e, now)

    def _show(self, m: Moment, now: float) -> None:
        self.moment = (m, now + m.dur)
        if m.anim != "idle":
            self._set_anim(m.anim, now)

    def _set_anim(self, name: str, now: float) -> None:
        self._anim, self._anim_t0 = name, now

    def _on_conn(self, e: dict, now: float) -> None:
        self.online = bool(e.get("online"))
        if not self.online:
            self.offer = self.countdown = None
            self.talk_id = None

    def _on_pair(self, e: dict, now: float) -> None:
        self.pair_uri = e.get("uri")

    def _on_snapshot(self, e: dict, now: float) -> None:
        self._on_health(e.get("health") or {}, now)
        cur = (e.get("offers") or {}).get("current")
        if cur:
            self._on_offer(cur, now)

    def _on_health(self, e: dict, now: float) -> None:
        if not e:
            return
        self.health = e
        if self.first_health_at is None:
            self.first_health_at = now
        inp = e.get("inputs") or {}
        phone = inp.get("phone") == "live"
        if phone and not self.phone_live and self.pair_wanted():
            self._show(Moment("Connected.", "", "text", "hop", 2.4, "conn"), now)
        self.phone_live = phone
        self.phone_ever_live |= phone
        self.arduino_ever_live |= inp.get("arduino") == "live"
        mode = (e.get("ai") or {}).get("mode")
        if self._ai_mode in ("think", "fast") and mode == "rules":
            self._show(Moment("AI offline.", "Rules coach on.", "warn", "warn", 2.6, "ai"), now)
        if mode:
            self._ai_mode = mode

    def pair_wanted(self) -> bool:
        return bool((self.health.get("inputs") or {}).get("pairing")) and not self.phone_ever_live

    def _on_telemetry(self, e: dict, now: float) -> None:
        self.tele, self.tele_at = e, now
        live, speed = e.get("status") == "live", e.get("speed_kmh", 0.0)
        if live and speed > self.reactor.th.racing_kmh * 0.8:
            self._still_since = None
            self._drive_since = self._drive_since if self._drive_since is not None else now
            if not self.racing and now - self._drive_since >= 1.0:
                self.racing = True
                # once per session: not again after a spin or an off, only after a real stop
                if not self.session_started or self._was_parked:
                    self._show(Moment("Lights out.", "", "text", "hop", 1.6, "go"), now)
                self.session_started, self._was_parked = True, False
        else:
            self._drive_since = None
            self._still_since = self._still_since if self._still_since is not None else now
            if self.racing and now - self._still_since >= (5.0 if live else 2.0):
                self.racing = False
            if now - self._still_since >= PARKED_S:
                self._was_parked = True
        m = self.reactor.feed(e, now)
        # a warning (lock-up, wheels off) may cut in on a cosmetic moment, never the other way round
        if m is not None and (self.moment is None or self.moment[1] < now
                              or (m.kind == "warn" and self.moment[0].kind != "warn")):
            self._show(m, now)
            # Rev has no voice of his own: the coach says it (on the next straight, if still fresh)
            self.outbox.append({"type": "rev_say", "text": m.bold, "key": m.key})

    def _on_voice(self, e: dict, now: float) -> None:
        st, text = e.get("status"), e.get("text", "")
        if st == "speaking":
            self.talk_id, self.talk_text, self.talk_until = e.get("id"), text, None
            self.last_cue = text
            self.thinking_until = 0.0
            self._set_anim("talk", now)
        elif st in ("spoken", "error") and e.get("id") == self.talk_id:
            self.talk_until = now + 1.4
        elif st == "dropped" and e.get("reason") == "muted" and text:
            self.last_cue = text
            self._show(Moment(*split_cue(text), "text", "idle", read_time(text), "cue"), now)

    def _on_voice_mute(self, e: dict, now: float) -> None:
        pass   # the muted flag arrives with the next health

    def _on_decision(self, e: dict, now: float) -> None:
        self.thinking_until = 0.0
        text = e.get("cue") or e.get("summary") or ""
        if text:
            self.last_cue = text
            if self.health.get("voice") is None:       # voice off: show it instead of saying it
                self._show(Moment(*split_cue(text), "text", "idle", read_time(text), "cue"), now)

    def _on_thinking(self, e: dict, now: float) -> None:
        self.thinking_until = now + 6.0
        self._set_anim("think", now)

    def _on_status(self, e: dict, now: float) -> None:
        if e.get("state") == "DECIDING":
            self.thinking_until = now + 12.0
            self._set_anim("think", now)

    def _on_corner_event(self, e: dict, now: float) -> None:
        self.thinking_label = f"Reading {e.get('corner') or 'the corner'}…"
        self.thinking_until = now + 10.0
        self._set_anim("think", now)

    def _on_offer(self, e: dict, now: float) -> None:
        st = e.get("state")
        if st == "waiting_cue":
            self.thinking_label = f"Reading {e.get('corner') or 'the corner'}…"
            self.thinking_until = now + 10.0
        elif st == "open":
            self.thinking_until = 0.0
            ms = max(0, int(e.get("ms_left") or 0))
            self.offer = {"id": e.get("id"), "cue": e.get("cue") or "", "end": now + ms / 1000.0,
                          "total": max(ms, 1) / 1000.0, "corner": e.get("corner") or ""}
            if self.offer["cue"]:
                self.last_cue = self.offer["cue"]
        else:                                              # accepted | expired | superseded
            if self.offer and e.get("id") in (None, self.offer["id"]):
                self.offer = None

    def _on_countdown(self, e: dict, now: float) -> None:
        n = int(e.get("n") or 0)
        self.countdown = n if n > 0 else None
        if n > 0:
            self.offer = None
            self.thinking_until = 0.0

    def _on_retry_started(self, e: dict, now: float) -> None:
        self.tries = 0
        if e.get("single_retry"):
            self._show(Moment("Rewinding…", dur=2.0, key="rewind"), now)

    def _on_reset_confirmed(self, e: dict, now: float) -> None:
        if self.moment is not None and self.moment[0].key == "rewind":
            self.moment = None

    def _on_retry_judged(self, e: dict, now: float) -> None:
        self.tries = int(e.get("try") or self.tries + 1)
        if e.get("fixed"):
            self._show(Moment("Clean.", "", "text", "hop", 2.2, "judged"), now)
        else:
            self._show(Moment("Not yet.", "", "text", "idle", 1.8, "judged"), now)

    def _on_retry_finished(self, e: dict, now: float) -> None:
        if e.get("resumed", True):
            self._show(Moment("Back on track.", "", "text", "idle", 1.6, "judged"), now)

    def _on_reset_failed(self, e: dict, now: float) -> None:
        self._show(Moment("Rewind failed.", "", "warn", "warn", 3.0, "reset"), now)

    def _on_track_lap(self, e: dict, now: float) -> None:
        lt = e.get("lap_time_s")
        self.last_lap = (f"Lap {e.get('lap')}: {lt:.2f} s" if lt else f"Lap {e.get('lap')}: not timed")

    def _on_rev_line(self, e: dict, now: float) -> None:
        """A line the backend wrote for Rev (Nemotron or rules): shown, and spoken by the voice."""
        text = e.get("text") or ""
        if text:
            self._show(Moment(*split_cue(text), "text", "hop" if e.get("mood") == "good" else "idle",
                              read_time(text), "line"), now)

    # --------------------------------------------------------------- output
    def _warnings(self, now: float) -> tuple[str, str] | None:
        inp = self.health.get("inputs") or {}
        conds = {
            "phone": (self.phone_ever_live and inp.get("phone") == "silent",
                      ("Phone lost.", "Check the app.")),
            "pedals": (self.arduino_ever_live and inp.get("arduino") == "silent",
                       ("Pedals lost.", "Using phone.")),
        }
        out = None
        for name, (bad, text) in conds.items():
            if bad:
                since = self._cond_since.setdefault(name, now)
                if now - since >= WARN_HOLD_S and out is None:
                    out = text
            else:
                self._cond_since.pop(name, None)
        return out

    def _chip(self) -> dict | None:
        ai = self.health.get("ai")
        if not ai:
            return None
        dot = {"think": "caution", "fast": "go", "ready": "go"}.get(ai.get("mode"), "brand")
        return {"dot": dot, "label": ai.get("label") or "Rules"}

    def _card(self, now: float) -> dict:
        h = self.health
        track = h.get("track") or "Rev"
        rows = []
        if self.last_cue:
            rows.append(("go", self.last_cue))
        if self.last_lap:
            rows.append(("muted", self.last_lap))
        ai = (h.get("ai") or {}).get("label")
        if ai:
            rows.append(("caution" if (h.get("ai") or {}).get("mode") == "think" else "go", ai))
        inp = h.get("inputs") or {}
        if inp:
            rows.append(("go" if inp.get("phone") == "live" else "muted",
                         "Phone connected" if inp.get("phone") == "live" else "Phone not connected"))
            rows.append(("go" if inp.get("arduino") == "live" else "muted",
                         "Pedals connected" if inp.get("arduino") == "live" else "Pedals: phone or off"))
        return {"title": f"{track} · try {self.tries} of {self.max_tries}" if self.tries else track,
                "tries": self.tries, "max": self.max_tries, "rows": rows[:5]}

    def view(self, now: float) -> View:
        speaking = self.talk_id is not None and (self.talk_until is None or now < self.talk_until)
        if self.talk_id is not None and not speaking:
            self.talk_id = None
        if self.moment and now >= self.moment[1]:
            self.moment = None
        thinking = now < self.thinking_until
        warn = self._warnings(now)
        mom = self.moment[0] if self.moment else None
        pairing = (self.online and self.pair_wanted() and self.pair_uri
                   and self.first_health_at is not None and now - self.first_health_at > PAIR_GRACE_S)

        bubble: dict | None
        want = RACER
        if not self.online:
            bubble, want = {"kind": "idle", "title": "Rev", "sub": "Looking for the coach…"}, BASE
        elif self.countdown is not None:
            bubble, want = {"kind": "countdown", "n": self.countdown, "label": "Rewinding"}, SUIT
        elif warn:
            bubble, want = {"kind": "warn", "bold": warn[0], "rest": warn[1]}, BASE
        elif mom is not None and mom.kind == "warn":
            bubble, want = {"kind": "warn", "bold": mom.bold, "rest": mom.rest}, BASE
        elif self.offer is not None:
            left = max(0.0, self.offer["end"] - now)
            bubble = {"kind": "offer", "frac": min(1.0, left / self.offer["total"]),
                      "hint": "Press Next to retry",
                      **dict(zip(("bold", "rest"), split_cue(self.offer["cue"])))}
        elif speaking:
            bubble = {"kind": "text", **dict(zip(("bold", "rest"), split_cue(self.talk_text)))}
        elif mom is not None:
            bubble = {"kind": "text", "bold": mom.bold, "rest": mom.rest}
        elif thinking:
            bubble = {"kind": "thinking", "cells": 1 + int((now * 2) % 3), "label": self.thinking_label}
        elif pairing:
            bubble, want = {"kind": "pairing", "uri": self.pair_uri}, BASE
        elif not self.racing and (not self.session_started or self._was_parked):
            # before the first lap or after a real stop; a spin or an off gets no "Ready when you are"
            bubble = {"kind": "idle", "title": "Rev", "sub": "Ready when you are"}
        else:
            bubble = None
        if self.online and want == RACER and (self.racing or (self.session_started and not self._was_parked)):
            want = HELMET                # the helmet stays on through a spin or an off

        # an outfit never changes while Rev is talking
        if want != self._outfit and not speaking:
            self._outfit, self._flash_until = want, now + 0.12

        # animation follows what is happening; one-shots (hop, wince, warn) settle back to idle
        kind = bubble["kind"] if bubble else None
        if kind != self._kind:
            self._kind = kind
            if kind == "warn" and self._anim in ("idle", "think", "talk"):   # a specific wince/hop stands
                self._set_anim("warn", now)
        if speaking and self._anim != "talk":
            self._set_anim("talk", now)
        elif not speaking and self._anim == "talk":
            self._set_anim("idle", now)
        if kind == "thinking" and self._anim == "idle":
            self._set_anim("think", now)
        elif kind != "thinking" and self._anim == "think":
            self._set_anim("idle", now)
        if self._anim in ("hop", "wince", "warn") and now - self._anim_t0 > 1.2:
            self._set_anim("idle", now)
        actions = (["accept"] if self.offer else []) + ["resume", "mute"]
        return View(outfit=self._outfit, anim=self._anim, anim_t0=self._anim_t0, bubble=bubble,
                    chip=None if self.racing else self._chip(), actions=actions,
                    muted=bool((self.health.get("voice") or {}).get("muted")), flash=now < self._flash_until,
                    card=self._card(now), racing=self.racing)
