"""Live audio cue during retries. No LLM: pure position-crossing logic."""
from __future__ import annotations

import math
import struct
import tempfile
import wave
from pathlib import Path
from typing import Any, Callable, Protocol

from .models import CornerConfig

MAX_GAP_S = 0.2


class Player(Protocol):
    def play(self, name: str) -> None: ...


class NullPlayer:
    """Records calls (tests)."""

    def __init__(self) -> None:
        self.calls: list[str] = []

    def play(self, name: str) -> None:
        self.calls.append(name)


def _tone(freq: float, ms: int, rate: int = 22050) -> list[int]:
    n = int(rate * ms / 1000)
    fade = max(1, int(rate * 0.005))
    out = []
    for i in range(n):
        env = min(1.0, i / fade, (n - i) / fade)
        out.append(int(12000 * env * math.sin(2 * math.pi * freq * i / rate)))
    return out


def _write_wav(path: Path, samples: list[int], rate: int = 22050) -> None:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"".join(struct.pack("<h", s) for s in samples))


class WinsoundPlayer:
    """Synthesizes short WAVs once and plays them async via winsound (Windows only)."""

    def __init__(self) -> None:
        import winsound  # lazy: not available off Windows
        self._ws = winsound
        self._dir = Path(tempfile.mkdtemp(prefix="nomadsim-cues-"))
        gap = [0] * 1000
        sounds = {
            "pre": _tone(880, 80),
            "mark": _tone(880, 300),
            "hit": _tone(660, 110) + gap + _tone(990, 160),
            "miss": _tone(990, 110) + gap + _tone(660, 160),
        }
        self._paths = {}
        for name, s in sounds.items():
            p = self._dir / f"{name}.wav"
            _write_wav(p, s)
            self._paths[name] = str(p)

    def play(self, name: str) -> None:
        self._ws.PlaySound(self._paths[name], self._ws.SND_FILENAME | self._ws.SND_ASYNC)


class LiveCue:
    """Beeps at the target during a retry; in lap mode also a spoken reminder on the approach.

    `say(text)` speaks the reminder (the voice Announcer). `arm(..., wait_wrap=True)` (lap mode)
    stays dormant until the car crosses the lap line, so arming right after the corner exit
    survives the rest of the lap.
    """

    def __init__(self, corner: CornerConfig, player: Player, lead_s: float = 0.2,
                 say: Callable[[str], None] | None = None):
        self.corner, self.player, self.lead_s, self.say = corner, player, lead_s, say
        self.armed = False
        self.pending_wrap = False
        self.reminder = ""
        self._reset_run()

    def _reset_run(self) -> None:
        self._cues: list[tuple[str, float]] = []
        self._fired: set[str] = set()
        self._prev_t: float | None = None
        self._prev_proj: float | None = None
        self._prev_pos: float | None = None

    def arm(self, drill_id: str, target: dict, reminder: str = "", wait_wrap: bool = False) -> None:
        self._reset_run()
        c = self.corner
        if drill_id == "brake_point":
            mark = c.board_zero_m - target["marker_m"]
            cues = [("pre", mark - 50), ("mark", mark)]
        elif drill_id == "throttle_pickup":
            cues = [("mark", c.apex_window_m[1] + target["marker_m"])]
        elif drill_id == "brake_release":
            cues = [("mark", c.gate("turn_in_m"))]  # "ease off from here"
        else:
            return
        self.reminder = reminder if self.say else ""
        if self.reminder:
            cues.insert(0, ("say", c.reminder_pos_m))
        self._cues = cues
        self.armed, self.pending_wrap = True, wait_wrap

    def disarm(self) -> None:
        self.armed = self.pending_wrap = False
        self._reset_run()

    def on_sample(self, t_s: float, pos_m: float, speed_kmh: float) -> None:
        if not self.armed:
            return
        if self.pending_wrap:
            wrapped = self._prev_pos is not None and pos_m < self._prev_pos - 100
            self._prev_pos = pos_m
            if not wrapped:
                return
            self.pending_wrap = False  # new lap: cues between here and the look-ahead may fire now
            self._prev_t, self._prev_proj = t_s, pos_m
        proj = pos_m + (speed_kmh / 3.6) * self.lead_s
        if self._prev_t is not None:
            # a long gap or a lap wrap (position jumps backward) disarms for the rest of the run
            if t_s - self._prev_t > MAX_GAP_S or pos_m < self._prev_proj - 100:
                self.disarm()
                return
            if pos_m <= self.corner.exit_gate_m:
                for name, cue_pos in self._cues:
                    if name not in self._fired and self._prev_proj < cue_pos <= proj:
                        self._fired.add(name)
                        if name == "say":
                            try:
                                self.say(self.reminder)
                            except Exception:  # noqa: BLE001 - a voice problem must not stop the beeps
                                pass
                        else:
                            self.player.play(name)
        self._prev_t, self._prev_proj = t_s, proj

    def on_run_scored(self, attempt: Any, target_gap: float, tolerance: float) -> None:
        """Hit/miss tone, only if this run was armed. Then disarm."""
        if self.armed:
            self.player.play("hit" if abs(target_gap) <= tolerance else "miss")
        self.disarm()
