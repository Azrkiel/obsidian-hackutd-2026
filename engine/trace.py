"""JSONL trace writer: one line per decision."""
from __future__ import annotations

import json
import time
import uuid
from pathlib import Path

from .models import Decision


class TraceWriter:
    def __init__(self, directory: str | Path = "traces", session: str | None = None):
        self.dir = Path(directory)
        self.session = session or time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:4]

    @property
    def path(self) -> Path:
        return self.dir / f"{self.session}.jsonl"

    def write(self, decision: Decision, packet: dict, rungs: list[dict]) -> dict:
        """Append one record; the directory is created lazily."""
        rec = {
            "ts": time.time(),
            "session": self.session,
            "decision": decision.to_dict(),
            "packet": packet,
            "rungs": rungs,
            "validation": [{"provider": r["provider"], "mode": r["mode"],
                            "outcome": r["outcome"], "reason": r["reason"]}
                           for r in rungs if r["mode"] != "rules"],
            "final": {"mode": decision.mode, "provider": decision.provider, "model": decision.model},
        }
        self.dir.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(rec, separators=(",", ":")) + "\n")
        return rec
