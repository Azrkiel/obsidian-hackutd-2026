"""Optional local history. Only the worker touches SQLite on the write path.

Events are ordered on an unbounded queue (a few events per scored pass, never samples).
UUIDs are independent of the engine's process-local attempt/decision labels. Mutable rows
carry a revision so an HTTP response cannot acknowledge a newer, unsent local update.
"""

from __future__ import annotations

import json
import logging
import queue
import sqlite3
import threading
import time
from contextlib import closing
from pathlib import Path
from uuid import NAMESPACE_URL, uuid4, uuid5

log = logging.getLogger(__name__)
KEYS = {
    "driver": "driver_id",
    "session": "session_id",
    "lap": "lap_id",
    "lap_trace": "lap_id",
    "decision": "decision_id",
}
METRICS = (
    "section_s",
    "entry_kmh",
    "apex_kmh",
    "exit_kmh",
    "brake_onset_m",
    "brake_board_m",
    "peak_brake",
    "throttle_pickup_m",
    "release_s",
    "trail_brake_share",
    "lockup_s",
    "wheelspin_s",
    "min_kmh",
    "min_pos_m",
)
_SYNC = "synced_at REAL, revision INTEGER NOT NULL DEFAULT 1"
SCHEMA = f"""
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS driver (
 driver_id TEXT PRIMARY KEY, name TEXT NOT NULL, source TEXT NOT NULL, created_at REAL NOT NULL, {_SYNC});
CREATE TABLE IF NOT EXISTS session (
 session_id TEXT PRIMARY KEY, driver_id TEXT NOT NULL REFERENCES driver(driver_id),
 track TEXT NOT NULL, car TEXT NOT NULL, corner TEXT NOT NULL, mode TEXT NOT NULL, agent INTEGER, model TEXT,
 started_at REAL NOT NULL, ended_at REAL, plan TEXT, recording TEXT, {_SYNC});
CREATE TABLE IF NOT EXISTS lap (
 lap_id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES session(session_id), n INTEGER,
 attempt_id TEXT, role TEXT, valid INTEGER, invalid_reason TEXT,
 {", ".join(k + " REAL" for k in METRICS)},
 input_dropout INTEGER, inputs TEXT, at REAL NOT NULL, {_SYNC});
CREATE TABLE IF NOT EXISTS lap_trace (
 lap_id TEXT PRIMARY KEY REFERENCES lap(lap_id), rows TEXT NOT NULL, {_SYNC});
CREATE TABLE IF NOT EXISTS decision (
 decision_id TEXT PRIMARY KEY, lap_id TEXT NOT NULL REFERENCES lap(lap_id), label TEXT,
 action TEXT, drill_id TEXT, target TEXT, cue TEXT, verdict TEXT, mode TEXT, provider TEXT,
 model TEXT, latency_ms REAL, summary TEXT, at REAL NOT NULL, {_SYNC});
CREATE INDEX IF NOT EXISTS session_driver ON session(driver_id, started_at);
CREATE INDEX IF NOT EXISTS lap_session ON lap(session_id, n);
CREATE INDEX IF NOT EXISTS decision_lap ON decision(lap_id);
PRAGMA user_version=1;
"""


def row_dict(row):
    out = dict(row)
    for key in ("plan", "target", "inputs", "rows"):
        if key in out and out[key] is not None:
            out[key] = json.loads(out[key])
    for key in ("valid", "agent", "input_dropout"):
        if key in out:
            out[key] = bool(out[key])
    return out


class HistoryRecorder:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.error: str | None = None
        self._queue = queue.SimpleQueue()
        self._thread: threading.Thread | None = None
        self._ready = threading.Event()
        self.changed = (
            threading.Event()
        )  # sync worker wakeup; never waited on by the coach
        self._closed = False
        self._available = False
        self._laps: dict[str, tuple[str, str]] = {}
        self._decision_ids: dict[tuple[str, str], str] = {}
        self.session_id: str | None = None
        self.driver_id: str | None = None
        self._memory = {"sessions": []}
        self._stats = {"last_s": None, "best_today_s": None, "lap_id": None}

    def start(self, metadata: dict) -> None:
        self._metadata = dict(metadata)
        self._thread = threading.Thread(
            target=self._worker, name="history-sqlite", daemon=True
        )
        self._thread.start()
        self._ready.wait(
            5
        )  # called via to_thread during startup, before telemetry starts

    def submit(self, event: dict) -> None:
        if event.get("type") in {
            "run",
            "decision",
            "plan",
            "session",
            "reference",
            "identity",
        }:
            if not self._closed and self._available:
                self._queue.put(event)

    def flush(self, timeout: float = 5) -> None:
        if not self._thread or not self._thread.is_alive():
            return
        done = threading.Event()
        self._queue.put(done)
        if not done.wait(timeout):
            raise TimeoutError("history worker did not drain")

    def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        if self._thread and self._thread.is_alive():
            self._queue.put(None)
            self._thread.join(5)
            if self._thread.is_alive():
                log.error("history worker did not stop within 5 seconds")

    def _connect(self):
        db = sqlite3.connect(self.path, timeout=2)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        return db

    def _worker(self):
        db = None
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            db = self._connect()
            db.executescript(SCHEMA)
            self._open_session(db, time.time())
            db.commit()
            self._refresh_cache(db)
            self._available = True
        except Exception as exc:
            self.error = str(exc)
            log.exception("History disabled: cannot open local storage")
            if db:
                db.close()
            return
        finally:
            self._ready.set()
        try:
            while True:
                event = self._queue.get()
                if isinstance(event, threading.Event):
                    event.set()
                    continue
                try:
                    with db:
                        if event is None:
                            self._update(
                                db, "session", self.session_id, ended_at=time.time()
                            )
                        else:
                            self._write_event(db, event)
                    self._refresh_cache(db)
                    self.error = None
                    self.changed.set()
                except Exception as exc:
                    self.error = str(exc)
                    log.exception("History event failed; coaching continues")
                if event is None:
                    break
        finally:
            db.close()

    @staticmethod
    def _insert(db, table, row):
        cols = list(row)
        db.execute(
            f'INSERT INTO "{table}" ({",".join(chr(34) + c + chr(34) for c in cols)}) '
            f"VALUES ({','.join('?' for _ in cols)})",
            list(row.values()),
        )

    @staticmethod
    def _update(db, table, key, **values):
        db.execute(
            f'UPDATE "{table}" SET {",".join(chr(34) + c + chr(34) + "=?" for c in values)}, '
            f"synced_at=NULL, revision=revision+1 WHERE {KEYS[table]}=?",
            [*values.values(), key],
        )

    def _driver(self, db, at):
        m = self._metadata
        self.driver_id = m.get("driver_id") or str(
            uuid5(NAMESPACE_URL, f"nomadsim:{m['source']}:{m['name']}")
        )
        old = db.execute(
            "SELECT * FROM driver WHERE driver_id=?", (self.driver_id,)
        ).fetchone()
        if not old:
            self._insert(
                db,
                "driver",
                dict(
                    driver_id=self.driver_id,
                    name=m["name"],
                    source=m["source"],
                    created_at=at,
                ),
            )
        elif old["name"] != m["name"] or old["source"] != m["source"]:
            self._update(
                db, "driver", self.driver_id, name=m["name"], source=m["source"]
            )

    def _open_session(self, db, at):
        self._driver(db, at)
        self.session_id, self._n = str(uuid4()), 0
        self._insert(
            db,
            "session",
            dict(
                session_id=self.session_id,
                driver_id=self.driver_id,
                **{
                    k: self._metadata.get(k)
                    for k in ("track", "car", "corner", "mode", "model", "recording")
                },
                agent=bool(self._metadata.get("agent")),
                started_at=at,
                ended_at=None,
                plan=None,
            ),
        )

    def _write_event(self, db, event):
        kind, at = event["type"], event.get("ts", time.time())
        if kind == "session":
            self._update(db, "session", self.session_id, ended_at=at)
            self._open_session(db, at)
        elif kind == "identity":
            self._metadata.update(event["metadata"])
            self._driver(db, at)
            self._update(
                db,
                "session",
                self.session_id,
                driver_id=self.driver_id,
                track=self._metadata.get("track"),
                car=self._metadata.get("car"),
            )
        elif kind == "run":
            a = event["attempt"]
            self._n += 1
            lid = str(uuid4())
            self._insert(
                db,
                "lap",
                dict(
                    lap_id=lid,
                    session_id=self.session_id,
                    n=self._n,
                    attempt_id=a["attempt_id"],
                    role=event["role"],
                    valid=a["valid"],
                    invalid_reason=a.get("invalid_reason"),
                    **{k: a.get(k) for k in METRICS},
                    input_dropout=a.get("invalid_reason")
                    in ("pedal_dropout", "steering_dropout"),
                    inputs=json.dumps(event.get("inputs")),
                    at=at,
                ),
            )
            self._insert(
                db,
                "lap_trace",
                dict(lap_id=lid, rows=json.dumps(event.get("trace", []))),
            )
            self._laps[a["attempt_id"]] = (lid, self.session_id)
        elif kind in ("decision", "plan", "reference"):
            aid = (
                (event.get("attempt") or {}).get("attempt_id")
                if kind == "reference"
                else event.get("attempt_id")
            )
            pair = self._laps.get(aid)
            if pair is None:
                return
            lid, sid = pair
            if kind == "reference":
                self._update(db, "lap", lid, role="reference")
            elif kind == "plan":
                self._update(db, "session", sid, plan=json.dumps(event.get("plan")))
            else:
                label = str(event.get("decision_id", ""))
                key = (lid, label)
                if key in self._decision_ids:
                    return
                did = str(uuid4())
                self._insert(
                    db,
                    "decision",
                    dict(
                        decision_id=did,
                        lap_id=lid,
                        label=label,
                        **{
                            k: event.get(k)
                            for k in (
                                "action",
                                "drill_id",
                                "cue",
                                "verdict",
                                "mode",
                                "provider",
                                "model",
                                "latency_ms",
                                "summary",
                            )
                        },
                        target=json.dumps(event.get("target")),
                        at=at,
                    ),
                )
                self._decision_ids[key] = did
                if event.get("model"):
                    self._update(db, "session", sid, model=event["model"])

    def _refresh_cache(self, db):
        m = self._metadata
        sessions = db.execute(
            "SELECT * FROM session WHERE driver_id=? AND session_id!=? "
            "AND track IS ? AND car IS ? AND corner IS ? ORDER BY started_at DESC LIMIT 5",
            (
                self.driver_id,
                self.session_id,
                m.get("track"),
                m.get("car"),
                m.get("corner"),
            ),
        ).fetchall()
        past = []
        for row in sessions:
            session = row_dict(row)
            session["laps"] = [
                row_dict(r)
                for r in db.execute(
                    "SELECT * FROM lap WHERE session_id=? ORDER BY n DESC LIMIT 20",
                    (row["session_id"],),
                )
            ]
            session["decisions"] = [
                row_dict(r)
                for r in db.execute(
                    "SELECT d.* FROM decision d JOIN lap l USING(lap_id) WHERE l.session_id=? ORDER BY d.at DESC LIMIT 20",
                    (row["session_id"],),
                )
            ]
            past.append(session)
        self._memory = {"driver_id": self.driver_id, "sessions": past}
        rows = db.execute(
            "SELECT l.lap_id,l.section_s,l.valid,l.at FROM lap l JOIN session s USING(session_id) "
            "WHERE s.driver_id=? AND s.track IS ? AND s.car IS ? AND s.corner IS ? ORDER BY l.at DESC",
            (self.driver_id, m.get("track"), m.get("car"), m.get("corner")),
        ).fetchall()
        midnight = time.mktime((*time.localtime()[:3], 0, 0, 0, 0, 0, -1))
        best = [
            r["section_s"]
            for r in rows
            if r["valid"] and r["section_s"] > 0 and r["at"] >= midnight
        ]
        last = rows[0] if rows else None
        self._stats = {
            "lap_id": last["lap_id"] if last else None,
            "last_s": last["section_s"] if last and last["valid"] else None,
            "last_valid": bool(last["valid"]) if last else None,
            "best_today_s": min(best) if best else None,
        }

    def driver_history(self):
        return self._memory  # worker replaces, never mutates published snapshots

    def stats(self):
        return self._stats

    def read(self, limit: int = 100, driver_id: str | None = None):
        if not self.path.is_file() or not self._available:
            return {
                "enabled": True,
                "error": self.error,
                "drivers": [],
                "sessions": [],
                "laps": [],
                "decisions": [],
            }
        with closing(self._connect()) as db:
            sessions = db.execute(
                "SELECT * FROM session WHERE (? IS NULL OR driver_id=?) "
                "ORDER BY started_at DESC LIMIT ?",
                (driver_id, driver_id, max(1, min(limit, 500))),
            ).fetchall()
            ids = [s["session_id"] for s in sessions]
            placeholders = ",".join("?" for _ in ids) or "NULL"
            laps = db.execute(
                f"SELECT * FROM lap WHERE session_id IN ({placeholders}) ORDER BY at DESC",
                ids,
            ).fetchall()
            decisions = db.execute(
                f"SELECT d.* FROM decision d JOIN lap l USING(lap_id) "
                f"WHERE l.session_id IN ({placeholders}) ORDER BY d.at DESC",
                ids,
            ).fetchall()
            drivers = db.execute(
                "SELECT * FROM driver WHERE (? IS NULL OR driver_id=?)",
                (driver_id, driver_id),
            ).fetchall()
            return dict(
                enabled=True,
                error=self.error,
                drivers=[row_dict(r) for r in drivers],
                sessions=[row_dict(r) for r in sessions],
                laps=[row_dict(r) for r in laps],
                decisions=[row_dict(r) for r in decisions],
            )

    def trace(self, lap_id: str):
        with closing(self._connect()) as db:
            row = db.execute(
                "SELECT rows FROM lap_trace WHERE lap_id=?", (lap_id,)
            ).fetchone()
            return json.loads(row[0]) if row else None
