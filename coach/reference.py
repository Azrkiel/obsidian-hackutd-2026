"""What a corner is judged against (ROLLING_CHECKPOINTS.md, D): the AI line, or the driver's best.

Mode "pb" (the default): the personal best for that corner, falling back to the AI line until the
corner has a clean pass. Mode "ai": always the AI line. One mode for the whole track.

Personal bests live in data/personal_best.json, per corner: the fastest clean pass (segment time).
They're tied to the track (name and length), so a best set on one track file is never compared
with another; reset() clears them.
"""
from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass
from pathlib import Path

from engine.models import Attempt

from .track import Track, TrackCorner
from .corner_pass import CornerPass

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PB = ROOT / "data" / "personal_best.json"
MODES = ("pb", "ai")


@dataclass(frozen=True)
class RefCorner:
    corner_id: str
    source: str                      # "ai" | "pb"
    segment_s: float
    entry_kmh: float
    min_kmh: float
    exit_kmh: float
    brake_onset_m: float | None
    throttle_pickup_m: float | None
    set_at: float | None = None      # unix time, personal bests only

    def as_attempt(self) -> Attempt:
        """The existing per-corner pieces (evidence, drills) take an Attempt as their reference."""
        return Attempt(attempt_id=f"ref-{self.source}-{self.corner_id}", valid=True, invalid_reason=None,
                       entry_kmh=self.entry_kmh, apex_kmh=self.min_kmh, exit_kmh=self.exit_kmh,
                       brake_onset_m=self.brake_onset_m or 0.0, peak_brake=1.0 if self.brake_onset_m else 0.0,
                       throttle_pickup_m=self.throttle_pickup_m or 0.0, section_s=self.segment_s,
                       min_kmh=self.min_kmh)


def ai_reference(c: TrackCorner) -> RefCorner:
    a = c.ai
    return RefCorner(c.id, "ai", float(a["segment_s"]), float(a["entry_kmh"]), float(a["min_kmh"]),
                     float(a["exit_kmh"]), c.brake_m, a.get("throttle_pickup_m"))


class References:
    def __init__(self, track: Track, path: str | Path | None = DEFAULT_PB, mode: str = "pb"):
        self.track = track
        self.path = Path(path) if path else None
        self.mode = mode
        self._ai = {c.id: ai_reference(c) for c in track.corners}
        self._pb: dict[str, RefCorner] = {}
        self._load()

    @property
    def mode(self) -> str:
        return self._mode

    @mode.setter
    def mode(self, m: str) -> None:
        if m not in MODES:
            raise ValueError(f"reference mode must be one of {MODES}")
        self._mode = m

    @property
    def _key(self) -> dict:
        return {"track": self.track.name, "length_m": round(self.track.length_m, 1)}

    def _load(self) -> None:
        if not self.path or not self.path.exists():
            return
        try:
            d = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return
        if {k: d.get(k) for k in self._key} != self._key:
            return   # another track (or the synthetic one): not comparable
        for cid, r in d.get("corners", {}).items():
            if cid in self._ai:
                self._pb[cid] = RefCorner(**{**r, "corner_id": cid, "source": "pb"})

    def _save(self) -> None:
        if not self.path:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        body = {**self._key, "corners": {k: {f: v for f, v in asdict(r).items() if f not in ("corner_id", "source")}
                                         for k, r in sorted(self._pb.items())}}
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(body, indent=1) + "\n", encoding="utf-8")
        tmp.replace(self.path)

    # -- queries --
    def get(self, corner_id: str) -> RefCorner:
        if self._mode == "pb" and corner_id in self._pb:
            return self._pb[corner_id]
        return self._ai[corner_id]

    def ai(self, corner_id: str) -> RefCorner:
        return self._ai[corner_id]

    def personal_best(self, corner_id: str) -> RefCorner | None:
        return self._pb.get(corner_id)

    def summary(self) -> dict:
        return {"mode": self._mode, "personal_bests": {
            k: round(r.segment_s, 3) for k, r in sorted(self._pb.items())}}

    # -- updates --
    def offer(self, p: CornerPass, clean: bool) -> bool:
        """A pass the coach found clean becomes the personal best if it's the fastest so far."""
        if not (clean and p.valid) or p.corner_id not in self._ai:
            return False
        old = self._pb.get(p.corner_id)
        if old is not None and p.segment_s >= old.segment_s:
            return False
        self._pb[p.corner_id] = RefCorner(p.corner_id, "pb", round(p.segment_s, 3), round(p.entry_kmh, 1),
                                          round(p.min_kmh, 1), round(p.exit_kmh, 1),
                                          None if p.brake_onset_m is None else round(p.brake_onset_m, 1),
                                          round(p.attempt.throttle_pickup_m, 1) if p.attempt and p.attempt.throttle_pickup_m else None,
                                          set_at=round(time.time()))
        self._save()
        return True

    def reset(self) -> None:
        self._pb.clear()
        if self.path and self.path.exists():
            self.path.unlink()
