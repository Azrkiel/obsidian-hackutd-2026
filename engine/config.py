"""Load corner config JSON."""
from __future__ import annotations

import json
from pathlib import Path

from .models import Attempt, CornerConfig


def load_corner(path: str | Path) -> CornerConfig:
    d = json.loads(Path(path).read_text(encoding="utf-8"))
    d.pop("_note", None)
    d["apex_window_m"] = tuple(d["apex_window_m"])
    return CornerConfig(**d)


def load_attempt(path: str | Path) -> Attempt:
    d = json.loads(Path(path).read_text(encoding="utf-8"))
    return Attempt.from_dict(d)
