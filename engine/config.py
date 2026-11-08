"""Load corner config JSON."""
from __future__ import annotations

import json
from pathlib import Path

from .models import Attempt, CornerConfig, Track


def load_corner(path: str | Path) -> CornerConfig:
    d = json.loads(Path(path).read_text(encoding="utf-8"))
    d = {k: v for k, v in d.items() if not k.startswith("_")}
    d["apex_window_m"] = tuple(d["apex_window_m"])
    return CornerConfig(**d)


def load_attempt(path: str | Path) -> Attempt:
    d = json.loads(Path(path).read_text(encoding="utf-8"))
    return Attempt.from_dict(d.get("attempt", d))


def load_track(path: str | Path) -> Track:
    """fixtures/track_*.json: name, length_m, talk_zones, defaults (merged into every corner), corners[]."""
    d = json.loads(Path(path).read_text(encoding="utf-8"))
    defaults = {k: v for k, v in (d.get("defaults") or {}).items() if not k.startswith("_")}
    corners = []
    for c in d["corners"]:
        cd = {**defaults, **{k: v for k, v in c.items() if not k.startswith("_")}}
        cd.setdefault("track_length_m", d["length_m"])
        cd["apex_window_m"] = tuple(cd["apex_window_m"])
        corners.append(CornerConfig(**cd))
    return Track(name=d["name"], length_m=float(d["length_m"]), corners=corners,
                 talk_zones=[tuple(z) for z in d.get("talk_zones") or []])


def load_track_reference(path: str | Path) -> dict[str, tuple[Attempt, list]]:
    """{"corners": {id: {"attempt": {...}, "trace": [...]}}} -> {id: (Attempt, trace)}."""
    d = json.loads(Path(path).read_text(encoding="utf-8"))
    return {cid: (Attempt.from_dict(v["attempt"]), v.get("trace") or [])
            for cid, v in d["corners"].items()}
