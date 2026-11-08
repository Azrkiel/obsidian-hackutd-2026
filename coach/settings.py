"""Whole-lap settings (ROLLING_CHECKPOINTS.md, G): saved in data/settings.json, applied live.

    reference        "pb" (personal best, AI line until there is one) | "ai"
    sensitivity_s    time lost in a corner that counts as an error, 0.1-0.5 s
    countdown_s      how long a retry offer stays open, 3-10 s
    lead_time_s      the retry starts this long before the brake point, 3-6 s
    voice            speak cues (true) or text only (false)

The dashboard's GET/POST /settings and the WebSocket "settings" command use this; the Pit Pal
panel will use the same API.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, fields
from pathlib import Path
from typing import Any

LIMITS: dict[str, tuple[float, float]] = {"sensitivity_s": (0.1, 0.5), "countdown_s": (3.0, 10.0),
                                          "lead_time_s": (3.0, 6.0)}


class SettingsError(ValueError):
    pass


@dataclass
class Settings:
    reference: str = "pb"
    sensitivity_s: float = 0.25
    countdown_s: float = 5.0
    lead_time_s: float = 4.0
    voice: bool = True

    def to_dict(self) -> dict:
        return asdict(self)

    @staticmethod
    def check(changes: dict[str, Any]) -> dict[str, Any]:
        """Validate a partial update; returns the cleaned values or raises SettingsError."""
        if not isinstance(changes, dict):
            raise SettingsError("settings must be an object")
        known = {f.name for f in fields(Settings)}
        out: dict[str, Any] = {}
        for k, v in changes.items():
            if k not in known:
                raise SettingsError(f"unknown setting {k!r}")
            if k == "reference":
                if v not in ("pb", "ai"):
                    raise SettingsError("reference must be 'pb' or 'ai'")
            elif k == "voice":
                if not isinstance(v, bool):
                    raise SettingsError("voice must be true or false")
            else:
                if isinstance(v, bool) or not isinstance(v, (int, float)):
                    raise SettingsError(f"{k} must be a number")
                lo, hi = LIMITS[k]
                if not lo <= v <= hi:
                    raise SettingsError(f"{k} must be between {lo:g} and {hi:g}")
                v = float(v)
            out[k] = v
        return out


class SettingsStore:
    def __init__(self, path: str | Path | None, defaults: Settings | None = None):
        self.path = Path(path) if path else None
        self.value = defaults or Settings()
        if self.path and self.path.exists():
            try:
                saved = json.loads(self.path.read_text(encoding="utf-8"))
                self.value = Settings(**{**self.value.to_dict(), **Settings.check(saved)})
            except (OSError, ValueError, TypeError):
                pass   # a broken file falls back to the defaults (and is rewritten on the next change)

    def update(self, changes: dict[str, Any]) -> dict[str, Any]:
        """Apply a validated partial update and save. Returns only what changed."""
        clean = Settings.check(changes)
        changed = {k: v for k, v in clean.items() if getattr(self.value, k) != v}
        if changed:
            self.value = Settings(**{**self.value.to_dict(), **changed})
            self._save()
        return changed

    def _save(self) -> None:
        if not self.path:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.value.to_dict(), indent=1) + "\n", encoding="utf-8")
        tmp.replace(self.path)
