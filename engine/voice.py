"""Spoken coaching: Speaker backends and the Announcer (queue, quiet zone, spacing, staleness, mute).

Rules (Live voice coach, plan doc):
- nothing is spoken inside the quiet zone (the scored corner); a message that arrives then waits;
- at least `min_gap_s` between messages (measured from the end of the last one);
- a message older than its max age is dropped, never played late;
- mute drops everything queued and ignores new messages.
Speech runs on a worker thread, so a slow voice never delays telemetry.
"""
from __future__ import annotations

import re
import subprocess
import sys
import threading
import time
from dataclasses import dataclass, field
from typing import Callable, Protocol

from .models import in_zone

ADVICE, REMINDER, VERDICT = "advice", "reminder", "verdict"
MAX_AGE_S = {ADVICE: 10.0, VERDICT: 10.0, REMINDER: 3.0}  # a late reminder is wrong, not just late
PRIORITY = {REMINDER: 0, VERDICT: 1, ADVICE: 1}


class Speaker(Protocol):
    name: str

    def speak(self, text: str) -> None:  # blocks until spoken
        ...


class SilentSpeaker:
    """Records what would have been said (tests, --no-voice)."""
    name = "silent"

    def __init__(self) -> None:
        self.said: list[str] = []

    def speak(self, text: str) -> None:
        self.said.append(text)


_SAPI_SCRIPT = r"""
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Rate = {rate}
{null_output}
[Console]::Out.WriteLine('ready'); [Console]::Out.Flush()
while (($l = [Console]::In.ReadLine()) -ne $null) {{
  if ($l.Length -gt 0) {{ try {{ $s.Speak($l) }} catch {{ }} }}
  [Console]::Out.WriteLine('done'); [Console]::Out.Flush()
}}
"""


class SapiSpeaker:
    """Windows built-in voice (System.Speech via one long-lived PowerShell). Offline, instant, robotic."""
    name = "windows"

    def __init__(self, rate: int = 1, null_output: bool = False, timeout_s: float = 15.0):
        if sys.platform != "win32":
            raise RuntimeError("SAPI voice is Windows-only")
        self.rate, self.null_output, self.timeout_s = rate, null_output, timeout_s
        self._lock = threading.Lock()
        self._proc: subprocess.Popen | None = None
        self._start()

    def _start(self) -> None:
        script = _SAPI_SCRIPT.format(rate=int(self.rate),
                                     null_output="$s.SetOutputToNull()" if self.null_output else "")
        self._proc = subprocess.Popen(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", script],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            text=True, encoding="ascii", errors="replace", bufsize=1,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        self._readline_until("ready")

    def _readline_until(self, want: str) -> None:
        assert self._proc and self._proc.stdout
        out: list[str] = []

        def read() -> None:
            while True:
                line = self._proc.stdout.readline()
                if not line or line.strip() == want:
                    out.append(line)
                    return

        t = threading.Thread(target=read, daemon=True)
        t.start()
        t.join(self.timeout_s)
        if t.is_alive() or not out or not out[0]:
            raise RuntimeError(f"SAPI voice did not answer {want!r}")

    def speak(self, text: str) -> None:
        line = text.encode("ascii", "ignore").decode().replace("\n", " ").strip()
        with self._lock:
            for attempt in (0, 1):
                try:
                    if self._proc is None or self._proc.poll() is not None:
                        self._start()
                    self._proc.stdin.write(line + "\n")
                    self._proc.stdin.flush()
                    self._readline_until("done")
                    return
                except (OSError, RuntimeError, ValueError):
                    self.close()
                    if attempt:
                        raise

    def close(self) -> None:
        p, self._proc = self._proc, None
        if p is not None:
            try:
                p.kill()
            except OSError:
                pass


class FallbackSpeaker:
    """Try `primary`; on any error use `fallback` for this message (and keep trying primary)."""

    def __init__(self, primary: Speaker, fallback: Speaker):
        self.primary, self.fallback = primary, fallback
        self.name = f"{primary.name}+{fallback.name}"

    def speak(self, text: str) -> None:
        try:
            self.primary.speak(text)
        except Exception:  # noqa: BLE001 - a broken voice must never kill coaching
            self.fallback.speak(text)


_UNITS = [
    (re.compile(r"(\d+(?:\.\d+)?)\s*m board\b"), r"\1 board"),
    (re.compile(r"(\d+(?:\.\d+)?)\s*km/h\b"), r"\1 kilometres an hour"),
    (re.compile(r"\b1\s*m\b"), "1 metre"),
    (re.compile(r"(\d+(?:\.\d+)?)\s*m\b"), r"\1 metres"),
    (re.compile(r"(\d+(?:\.\d+)?)\s*s\b"), r"\1 seconds"),
    (re.compile(r"(\d+(?:\.\d+)?)\s*%"), r"\1 percent"),
]


def spoken(text: str) -> str:
    """Make a cue read well aloud: '100 m board' -> '100 board', '4 m' -> '4 metres'."""
    out = " ".join((text or "").split())
    for rx, rep in _UNITS:
        out = rx.sub(rep, out)
    return out


def make_speaker(kind: str = "auto") -> Speaker:
    """'windows' | 'nvidia' | 'silent' | 'auto' (windows on Windows, else silent).
    nvidia falls back to windows (or silent) per message."""
    if kind == "silent":
        return SilentSpeaker()
    base: Speaker
    try:
        base = SapiSpeaker() if sys.platform == "win32" else SilentSpeaker()
    except Exception:  # noqa: BLE001
        base = SilentSpeaker()
    if kind == "nvidia":
        try:
            from .nvidia_tts import NvidiaSpeaker
            return FallbackSpeaker(NvidiaSpeaker(), base)
        except Exception:  # noqa: BLE001 - not installed / no key: the built-in voice
            return base
    return base


@dataclass
class Message:
    text: str
    kind: str
    created: float
    max_age_s: float
    id: int = 0
    meta: dict = field(default_factory=dict)


def _thread_runner(fn: Callable[[], None]) -> None:
    threading.Thread(target=fn, daemon=True, name="nomadsim-voice").start()


class Announcer:
    """Queue spoken messages and release them when the driver can hear them.

    Call `on_position(pos_m)` with every telemetry sample and `pump()` regularly (each sample,
    plus a slow timer for when telemetry is off). `runner` runs the blocking speak call; tests
    pass a synchronous runner.
    """

    def __init__(self, speaker: Speaker, quiet_zone: tuple[float, float] | None = None,
                 min_gap_s: float = 5.0, clock: Callable[[], float] = time.monotonic,
                 runner: Callable[[Callable[[], None]], None] = _thread_runner,
                 on_event: Callable[[dict], None] | None = None, muted: bool = False,
                 quiet_zones: list[tuple[float, float]] | None = None,
                 talk_zones: list[tuple[float, float]] | None = None):
        self.speaker, self.quiet_zone, self.min_gap_s = speaker, quiet_zone, min_gap_s
        # whole-lap mode: quiet in every corner; speech only inside talk_zones (the straights).
        # A zone [a, b] with a > b wraps over the lap line.
        self.quiet_zones = ([quiet_zone] if quiet_zone else []) + list(quiet_zones or [])
        self.talk_zones = list(talk_zones or [])
        self.clock, self.runner, self.on_event = clock, runner, on_event
        self.muted = muted
        self.queue: list[Message] = []
        self.speaking = False
        self.last_end: float | None = None
        self.pos_m: float | None = None
        self._n = 0
        self._lock = threading.Lock()

    # -- state --
    @property
    def in_quiet_zone(self) -> bool:
        if self.pos_m is None:
            return False
        return any(in_zone(self.pos_m, z) for z in self.quiet_zones)

    @property
    def can_talk(self) -> bool:
        """Outside every quiet zone and, when talk zones are set, inside one. No telemetry: talk."""
        if self.pos_m is None:
            return True
        if self.in_quiet_zone:
            return False
        return not self.talk_zones or any(in_zone(self.pos_m, z) for z in self.talk_zones)

    def on_position(self, pos_m: float) -> None:
        self.pos_m = pos_m

    def set_muted(self, muted: bool) -> None:
        with self._lock:
            self.muted = muted
            dropped, self.queue = self.queue, []
        for m in dropped:
            self._event(m, "dropped", "muted")
        self._emit({"type": "voice_mute", "muted": muted})

    def toggle_mute(self) -> bool:
        self.set_muted(not self.muted)
        return self.muted

    # -- input --
    def say(self, text: str, kind: str = ADVICE, max_age_s: float | None = None,
            **meta) -> Message | None:
        text = spoken(text)
        if not text:
            return None
        self._n += 1
        m = Message(text, kind, self.clock(), MAX_AGE_S.get(kind, 10.0) if max_age_s is None
                    else max_age_s, self._n, meta)
        if self.muted:
            self._event(m, "dropped", "muted")
            return m
        with self._lock:
            if kind == REMINDER:  # only the newest reminder matters
                old = [q for q in self.queue if q.kind == REMINDER]
                self.queue = [q for q in self.queue if q.kind != REMINDER]
            else:
                old = []
            self.queue.append(m)
            self.queue.sort(key=lambda q: (PRIORITY.get(q.kind, 1), q.created))
        for q in old:
            self._event(q, "dropped", "replaced")
        self._event(m, "queued")
        self.pump()
        return m

    # -- release --
    def pump(self) -> None:
        now = self.clock()
        with self._lock:
            stale = [m for m in self.queue if now - m.created > m.max_age_s]
            self.queue = [m for m in self.queue if now - m.created <= m.max_age_s]
            nxt = None
            if (self.queue and not self.speaking and not self.muted and self.can_talk
                    and (self.last_end is None or now - self.last_end >= self.min_gap_s)):
                nxt = self.queue.pop(0)
                self.speaking = True
        for m in stale:
            self._event(m, "dropped", "stale")
        if nxt is not None:
            self._event(nxt, "speaking")
            self.runner(lambda: self._speak(nxt))

    def _speak(self, m: Message) -> None:
        err = None
        try:
            self.speaker.speak(m.text)
        except Exception as e:  # noqa: BLE001
            err = repr(e)
        finally:
            with self._lock:
                self.speaking = False
                self.last_end = self.clock()
        self._event(m, "error" if err else "spoken", err)

    # -- events --
    def _emit(self, e: dict) -> None:
        if self.on_event:
            try:
                self.on_event(e)
            except Exception:  # noqa: BLE001
                pass

    def _event(self, m: Message, status: str, reason: str | None = None) -> None:
        self._emit({"type": "voice", "id": m.id, "kind": m.kind, "text": m.text,
                    "status": status, "reason": reason, **m.meta})
