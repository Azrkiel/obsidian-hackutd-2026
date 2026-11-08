"""SQLite outbox -> authenticated SpacetimeDB HTTP reducers, entirely off the drive loop."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import threading
import time
from contextlib import closing
from dataclasses import dataclass, field
from urllib.parse import quote, urlparse

import aiohttp

from .history import KEYS, HistoryRecorder

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class SyncConfig:
    url: str
    database: str
    token: str = field(repr=False)

    @classmethod
    def from_env(cls):
        values = [
            os.getenv(k, "").strip()
            for k in ("SPACETIME_URL", "SPACETIME_DB", "SPACETIME_TOKEN")
        ]
        if not all(values):
            if any(values):
                log.warning(
                    "History sync off: set SPACETIME_URL, SPACETIME_DB and SPACETIME_TOKEN together"
                )
            return None
        parsed = urlparse(values[0])
        if (
            parsed.scheme not in ("http", "https")
            or not parsed.netloc
            or parsed.username
            or parsed.password
        ):
            log.warning("History sync off: SPACETIME_URL must be an HTTP(S) origin")
            return None
        return cls(values[0].rstrip("/"), values[1], values[2])


class HistorySync:
    def __init__(self, history: HistoryRecorder, config: SyncConfig):
        self.history, self.config = history, config
        self._stop = threading.Event()
        self._thread = None
        self._registered = False
        self._http = None
        self.error = None

    def start(self):
        self._thread = threading.Thread(
            target=lambda: asyncio.run(self._run()), name="history-sync", daemon=True
        )
        self._thread.start()

    def stop(self):
        self._stop.set()
        self.history.changed.set()
        if self._thread:
            self._thread.join(7)

    async def close(self):
        if self._http:
            await self._http.close()
            self._http = None

    async def _run(self):
        backoff = 1
        try:
            while not self._stop.is_set():
                self.history.changed.clear()
                ok = await self.sync_once()
                if ok:
                    backoff = 1
                    await asyncio.to_thread(self.history.changed.wait, 5)
                else:
                    # New laps must not defeat backoff during an outage.
                    await asyncio.to_thread(self._stop.wait, backoff)
                    backoff = min(backoff * 2, 60)
        finally:
            await self.close()

    def pending_count(self):
        with closing(self.history._connect()) as db:
            return sum(
                db.execute(
                    f'SELECT count(*) FROM "{t}" WHERE synced_at IS NULL'
                ).fetchone()[0]
                for t in KEYS
            )

    def _pending(self):
        # Dependency order: all drivers before sessions, all sessions before laps and decisions.
        # Each lap and its trace are one HTTP transaction, including trace-only retries.
        pending = []
        with closing(self.history._connect()) as db:
            for table, reducer, order in (
                ("driver", "upsert_driver", "created_at"),
                ("session", "start_session", "started_at"),
            ):
                for row in db.execute(
                    f'SELECT * FROM "{table}" WHERE synced_at IS NULL ORDER BY {order}'
                ):
                    payload = self._payload(row)
                    pending.append(
                        (reducer, payload, [(table, row[KEYS[table]], row["revision"])])
                    )
            laps = db.execute(
                "SELECT l.* FROM lap l JOIN lap_trace t USING(lap_id) "
                "WHERE l.synced_at IS NULL OR t.synced_at IS NULL ORDER BY l.at"
            ).fetchall()
            for row in laps:
                trace = db.execute(
                    "SELECT * FROM lap_trace WHERE lap_id=?", (row["lap_id"],)
                ).fetchone()
                pending.append(
                    (
                        "record_lap",
                        {"lap": self._payload(row), "trace": self._payload(trace)},
                        [
                            ("lap", row["lap_id"], row["revision"]),
                            ("lap_trace", row["lap_id"], trace["revision"]),
                        ],
                    )
                )
            for row in db.execute(
                "SELECT * FROM decision WHERE synced_at IS NULL ORDER BY at"
            ):
                pending.append(
                    (
                        "record_decision",
                        self._payload(row),
                        [("decision", row["decision_id"], row["revision"])],
                    )
                )
        return pending

    @staticmethod
    def _payload(row):
        # JSON-valued columns stay strings in both databases; viewers parse on demand.
        result = dict(row)
        result.pop("synced_at", None)
        for name in ("valid", "agent", "input_dropout"):
            if name in result:
                result[name] = bool(result[name])
        return result

    def _ack(self, versions):
        with closing(self.history._connect()) as db, db:
            for table, key, revision in versions:
                db.execute(
                    f'UPDATE "{table}" SET synced_at=? WHERE {KEYS[table]}=? AND revision=?',
                    (time.time(), key, revision),
                )

    async def _call(self, reducer, payload=None):
        if self._http is None:
            self._http = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5))
        url = f"{self.config.url}/v1/database/{quote(self.config.database, safe='')}/call/{reducer}"
        async with self._http.post(
            url,
            json=[] if payload is None else [json.dumps(payload, allow_nan=False)],
            headers={"Authorization": f"Bearer {self.config.token}"},
            allow_redirects=False,
        ) as response:
            if not 200 <= response.status < 300:
                # Do not log responses, URLs, headers or exception strings: they may contain tokens.
                raise RuntimeError(f"HTTP {response.status} from {reducer}")

    async def sync_once(self):
        try:
            if not self._registered:
                await self._call("register_coach")
                self._registered = True
            pending = await asyncio.to_thread(self._pending)
            for reducer, payload, versions in pending:
                if self._stop.is_set():
                    return False
                await self._call(reducer, payload)
                await asyncio.to_thread(self._ack, versions)
            self.error = None
            return True
        except Exception as exc:
            self.error = type(exc).__name__
            log.warning(
                "History sync unavailable (%s); local rows retained", self.error
            )
            return False
