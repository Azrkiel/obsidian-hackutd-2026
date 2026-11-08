"""Local coach history. Metrics and their reference are retained per lap as JSON."""
from __future__ import annotations

import hashlib
import json
import math
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean

from .analysis import driving_profile
from .models import Attempt, CornerConfig
from .tools import MAX_CUE_WORDS, check_spoken


def corner_hash(corner: CornerConfig) -> str:
    # Include both legacy gates and named overrides: either can affect scoring.
    geometry = {"start_gate_m": corner.start_gate_m, "exit_gate_m": corner.exit_gate_m,
                "apex_window_m": corner.apex_window_m, "gates": corner.gates,
                "board_zero_m": corner.board_zero_m, "tolerance": corner.tolerance}
    return hashlib.sha1(json.dumps(geometry, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def driver_name(value: str | None) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError("driver must be a name")
    value = value.strip()
    if len(value) > 80 or any(ord(c) < 32 for c in value):
        raise ValueError("driver must be at most 80 characters with no control characters")
    return value or None


def _numeric(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


class MemoryStore:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS session (
                    id TEXT PRIMARY KEY, driver TEXT, corner TEXT NOT NULL,
                    corner_hash TEXT NOT NULL, started_at TEXT NOT NULL,
                    ended_at TEXT, goals TEXT NOT NULL DEFAULT '[]', summary TEXT NOT NULL DEFAULT ''
                );
                CREATE INDEX IF NOT EXISTS session_driver ON session(driver, corner, started_at);
                CREATE TABLE IF NOT EXISTS lap (
                    session_id TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
                    attempt_id TEXT NOT NULL, valid INTEGER NOT NULL, comparable INTEGER NOT NULL,
                    section_s REAL, metrics TEXT NOT NULL, reference_metrics TEXT NOT NULL,
                    PRIMARY KEY (session_id, attempt_id)
                );
            """)

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        try:
            with db:
                yield db
        finally:
            db.close()

    def history(self, driver: str | None, corner: CornerConfig, exclude: str | None = None) -> dict:
        if driver is None:
            return {"error": "no driver"}
        with self.connect() as db:
            rows = db.execute("""SELECT * FROM session s WHERE driver=? AND corner=?
                AND id != ? AND EXISTS (SELECT 1 FROM lap WHERE session_id=s.id)
                ORDER BY started_at DESC, id DESC LIMIT 3""",
                (driver, corner.name, exclude or "")).fetchall()
            changed = any(row["corner_hash"] != corner_hash(corner) for row in rows)
            sessions, deltas = [], {}
            for row in rows:
                laps = db.execute("SELECT * FROM lap WHERE session_id=?", (row["id"],)).fetchall()
                entry = {"date": row["started_at"][:10], "laps": len(laps),
                         "goals": json.loads(row["goals"]), "summary": row["summary"]}
                good = [lap for lap in laps if lap["valid"] and lap["comparable"]]
                if not changed:
                    sections = [lap["section_s"] for lap in good if lap["section_s"] is not None]
                    entry["best_section_s"] = min(sections) if sections else None
                    by_metric = {}
                    for lap in good:
                        metrics, reference = json.loads(lap["metrics"]), json.loads(lap["reference_metrics"])
                        for key in corner.tolerance:
                            x, y = metrics.get(key), reference.get(key)
                            if _numeric(x) and _numeric(y):
                                by_metric.setdefault(key, []).append(x - y)
                    for key, values in by_metric.items():
                        deltas.setdefault(key, []).append(mean(values))
                sessions.append(entry)
        tendencies = [{"metric": key, "mean_delta": round(mean(values), 3),
                       "sessions_over_tol": sum(round(abs(v), 6) > corner.tolerance[key] for v in values),
                       "of": len(values)} for key, values in sorted(deltas.items())]
        return {"driver": driver, "corner_changed": changed, "sessions": sessions, "tendencies": tendencies}

    def delete_driver(self, driver: str) -> None:
        """Delete local session and lap rows, including through the foreign-key cascade."""
        with self.connect() as db:
            db.execute("DELETE FROM session WHERE driver=?", (driver,))


class SessionMemory:
    def __init__(self, store: MemoryStore, corner: CornerConfig, driver: str | None = None,
                 reference_trace: list | None = None):
        self.store, self.corner, self.driver = store, corner, driver_name(driver)
        self.reference_trace = reference_trace or []
        self.session_id: str | None = None
        self.goals: list[dict] = []

    def record(self, attempt: Attempt, reference: Attempt, trace: list | None = None,
               reference_trace: list | None = None) -> None:
        from dataclasses import asdict
        metrics, ref = asdict(attempt), asdict(reference)
        if trace:
            metrics.update(driving_profile(trace, self.corner))
        reference_trace = reference_trace if reference_trace is not None else self.reference_trace
        if reference_trace:
            ref.update(driving_profile(reference_trace, self.corner))
        # Retain the scorer's section time for the best-lap result.
        with self.store.connect() as db:
            if self.session_id is None:
                self.session_id = uuid.uuid4().hex
                self.goals = []
                db.execute("INSERT INTO session(id,driver,corner,corner_hash,started_at) VALUES(?,?,?,?,?)",
                           (self.session_id, self.driver, self.corner.name, corner_hash(self.corner),
                            datetime.now(timezone.utc).isoformat()))
            comparable = abs(attempt.entry_kmh - reference.entry_kmh) <= self.corner.comparable_entry_kmh
            db.execute("INSERT OR IGNORE INTO lap VALUES(?,?,?,?,?,?,?)",
                       (self.session_id, attempt.attempt_id, attempt.valid, comparable,
                        attempt.section_s, json.dumps(metrics), json.dumps(ref)))

    def history(self) -> dict:
        return self.store.history(self.driver, self.corner, self.session_id)

    def note(self, decision, drill=None) -> None:
        if decision.plan:
            self.goals = [{"drill_id": g["drill_id"],
                           "outcome": {"done": "met", "failed": "skipped"}.get(g["status"], "unfinished"),
                           "tries": g["tries"]} for g in decision.plan["goals"]]
        elif decision.action == "offer_drill":
            if not self.goals:
                self.goals.append({"drill_id": decision.drill_id, "outcome": "unfinished", "tries": 0})
            self.goals[-1]["tries"] = drill.tries if drill else 0
        elif self.goals:
            self.goals[-1].update(tries=drill.tries if drill else 0,
                                  outcome={"drill_complete": "met", "no_progress": "skipped"}.get(
                                      decision.end_reason, "unfinished"))
        if self.session_id:
            with self.store.connect() as db:
                db.execute("UPDATE session SET goals=? WHERE id=?", (json.dumps(self.goals), self.session_id))

    def finish(self, model_summary: str | None = None, evidence: dict | None = None) -> None:
        if self.session_id is None:
            return
        summary = "; ".join(f"{g['drill_id'].replace('_', ' ')} {g['outcome']} in {g['tries']} "
                            f"{'try' if g['tries'] == 1 else 'tries'}"
                            for g in self.goals) or "No coaching goals completed."
        if model_summary and check_spoken(model_summary, "summary", MAX_CUE_WORDS, evidence or {})[0]:
            summary = " ".join(model_summary.split())
        with self.store.connect() as db:
            db.execute("UPDATE session SET ended_at=?, summary=? WHERE id=?",
                       (datetime.now(timezone.utc).isoformat(), summary, self.session_id))
        self.session_id = None
        self.goals = []
