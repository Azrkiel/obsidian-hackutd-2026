"""The whole-lap track model (fixtures/tracks/<track>.json, from scripts/ac_track_extract.py --track-out).

Positions are metres along the AI line from the start/finish line, like Sample.pos_m.
Each corner: entry gate .. exit gate, the AI brake point (None for a flat-out corner), turn-in,
apexes and the AI line's own numbers for that corner. `profile` is the AI speed every 10 m: it
turns the retry lead time (seconds) into an anchor position before each corner.
"""
from __future__ import annotations

import bisect
import json
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any

from engine.models import CornerConfig

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_TRACK = ROOT / "fixtures" / "tracks" / "monza.json"
MIN_KMH = 10.0


@dataclass(frozen=True)
class TrackCorner:
    id: str
    name: str
    kind: str                       # "brake" | "flat" (flat out: major errors only)
    entry_m: float
    brake_m: float | None
    turn_in_m: float
    apex_m: tuple[float, ...]
    apex_window_m: tuple[float, float]
    exit_m: float
    ai: dict[str, float]
    board_zero_m: float | None = None   # the 0 m brake board (lap coach config); turn-in if unknown

    @property
    def major_only(self) -> bool:
        return self.kind == "flat"

    @property
    def key_m(self) -> float:
        """Where the retry lead time counts back from: the brake point, or turn-in when flat."""
        return self.brake_m if self.brake_m is not None else self.turn_in_m

    @classmethod
    def from_dict(cls, d: dict) -> "TrackCorner":
        return cls(d["id"], d["name"], d["kind"], float(d["entry_m"]),
                   None if d.get("brake_m") is None else float(d["brake_m"]), float(d["turn_in_m"]),
                   tuple(float(x) for x in d["apex_m"]), tuple(float(x) for x in d["apex_window_m"]),
                   float(d["exit_m"]), dict(d.get("ai", {})),
                   None if d.get("board_zero_m") is None else float(d["board_zero_m"]))


class Track:
    def __init__(self, name: str, length_m: float, corners: list[TrackCorner], profile: list[list[float]],
                 source: str = ""):
        self.name, self.length_m, self.source = name, float(length_m), source
        self.corners = sorted(corners, key=lambda c: c.entry_m)
        self._d = [float(r[0]) for r in profile]
        self._kmh = [max(MIN_KMH, float(r[1])) for r in profile]
        self._gas = [float(r[2]) if len(r) > 2 else 0.0 for r in profile]
        self._brake = [float(r[3]) if len(r) > 3 else 0.0 for r in profile]
        self._by_id = {c.id: c for c in self.corners}

    @classmethod
    def load(cls, path: str | Path = DEFAULT_TRACK) -> "Track":
        d = json.loads(Path(path).read_text(encoding="utf-8"))
        return cls(d["name"], d["length_m"], [TrackCorner.from_dict(c) for c in d["corners"]],
                   d["profile"], d.get("_source", ""))

    @property
    def synthetic(self) -> bool:
        return "synthetic" in self.source.lower()

    def get(self, corner_id: str) -> TrackCorner | None:
        return self._by_id.get(corner_id)

    def wrap(self, pos_m: float) -> float:
        return pos_m % self.length_m

    # -- AI line --
    def _at(self, col: list[float], pos_m: float) -> float:
        p = self.wrap(pos_m)
        i = bisect.bisect_right(self._d, p) - 1
        j = (i + 1) % len(self._d)
        d0, d1 = self._d[i], self._d[j] if j else self.length_m
        f = 0.0 if d1 == d0 else (p - d0) / (d1 - d0)
        return col[i] + f * (col[j] - col[i])

    def ai_kmh(self, pos_m: float) -> float:
        return self._at(self._kmh, pos_m)

    def ai_pedals(self, pos_m: float) -> tuple[float, float]:
        """(gas, brake) of the AI line at pos_m."""
        return self._at(self._gas, pos_m), self._at(self._brake, pos_m)

    def ai_time(self, a_m: float, b_m: float, step_m: float = 5.0) -> float:
        """Seconds the AI takes from a to b, driving forward (wraps past the line)."""
        span = (b_m - a_m) % self.length_m
        n = max(1, int(span / step_m))
        h = span / n
        t, v0 = 0.0, self.ai_kmh(a_m) / 3.6
        for k in range(1, n + 1):
            v1 = self.ai_kmh(a_m + k * h) / 3.6
            t += h * 0.5 * (1 / v0 + 1 / v1)
            v0 = v1
        return t

    def pos_before(self, pos_m: float, seconds: float, step_m: float = 5.0) -> float:
        """The position the AI passes `seconds` before reaching pos_m."""
        t, p = 0.0, pos_m
        v1 = self.ai_kmh(p) / 3.6
        for _ in range(int(self.length_m / step_m)):
            v0 = self.ai_kmh(p - step_m) / 3.6
            dt = step_m * 0.5 * (1 / v0 + 1 / v1)
            if t + dt >= seconds:
                return self.wrap(p - step_m * (seconds - t) / dt)
            t, p, v1 = t + dt, p - step_m, v0
        return self.wrap(p)

    # -- corners --
    def anchor_m(self, corner: TrackCorner, lead_s: float) -> float:
        return self.pos_before(corner.key_m, lead_s)

    def anchor_splines(self, lead_s: float) -> list[float]:
        """Anchors as track positions 0..1, in corner order (anchor i+1 = corners[i]) for the Lua CFG."""
        return [self.anchor_m(c, lead_s) / self.length_m for c in self.corners]

    def corner_at(self, pos_m: float) -> TrackCorner | None:
        p = self.wrap(pos_m)
        return next((c for c in self.corners if c.entry_m <= p <= c.exit_m), None)

    def next_corner(self, pos_m: float) -> TrackCorner:
        """The corner whose entry is next ahead of pos_m (the one you're in counts if before its entry)."""
        p = self.wrap(pos_m)
        return next((c for c in self.corners if c.entry_m >= p), self.corners[0])

    def corner_config(self, corner: TrackCorner, base: CornerConfig) -> CornerConfig:
        """A CornerConfig for the existing per-corner pieces (scorer, drills, evidence, live cues).
        Tolerances and drill limits come from `base`; flat corners get no brake drills."""
        gates: dict[str, Any] = {"turn_in_m": corner.turn_in_m, "apex1_m": corner.apex_m[0],
                                 "apex2_m": corner.apex_m[-1], "start_m": corner.entry_m,
                                 "exit_m": corner.exit_m}
        if corner.brake_m is not None:
            gates["brake_m"] = corner.brake_m
        allowed = dict(base.allowed)
        if corner.major_only:
            allowed["drills"] = []
        return replace(base, name=corner.name, track_length_m=self.length_m, start_gate_m=corner.entry_m,
                       apex_window_m=corner.apex_window_m, exit_gate_m=corner.exit_m,
                       board_zero_m=corner.board_zero_m if corner.board_zero_m is not None else corner.turn_in_m,
                       gates=gates, allowed=allowed, reminder_m=None, id=corner.id)
