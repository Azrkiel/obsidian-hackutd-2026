"""Target-bound history files, atomically persisted off the coach's event loop."""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
import tempfile
import uuid
from pathlib import Path

from .cloud_records import validate_record


class OutboxFull(OSError):
    pass


def binding_for(config) -> dict:
    return {"url": str(config.url).rstrip("/"), "database": str(config.database),
            "identity": str(config.identity)}


class CloudOutbox:
    def __init__(self, directory: str | Path, target: dict, *, max_bytes: int = 256 * 1024 * 1024):
        self.target = dict(target)
        digest = hashlib.sha256(json.dumps(self.target, sort_keys=True).encode()).hexdigest()[:24]
        self.directory = Path(directory) / "outbox" / digest
        self.rejected = Path(directory) / "rejected" / digest
        self.max_bytes = max_bytes
        self._entries: dict[str, dict] = {}
        self._sizes: dict[str, int] = {}
        self._lock = asyncio.Lock()
        self.rejected_count = 0

    @property
    def count(self) -> int:
        return len(self._entries)

    @staticmethod
    def _id(record_id: str) -> str:
        if not isinstance(record_id, str) or re.fullmatch(r"[a-zA-Z0-9_-]{1,128}", record_id) is None:
            raise ValueError("invalid history record ID")
        return record_id

    async def initialize(self) -> None:
        async with self._lock:
            await asyncio.to_thread(self._load)

    def _load(self) -> None:
        self.directory.mkdir(parents=True, exist_ok=True)
        self.rejected.mkdir(parents=True, exist_ok=True)
        self._entries, self._sizes = {}, {}
        for path in self.directory.glob("*.json"):
            try:
                if path.stat().st_size > 40 * 1024:
                    raise ValueError("oversized outbox file")
                body = path.read_bytes()
                value = json.loads(body)
                record = value["record"]
                rid = self._id(record["record_id"])
                if value["target"] != self.target or path.stem != rid:
                    raise ValueError("history target mismatch")
                if value["kind"] not in ("session", "lap", "attempt", "decision"):
                    raise ValueError("invalid history record kind")
                validate_record(record)
                self._entries[rid] = {"kind": value["kind"], "record": record}
                self._sizes[rid] = len(body)
            except (ValueError, KeyError, TypeError, UnicodeError):
                destination = self.rejected / f"corrupt-{uuid.uuid4().hex}.json"
                destination.write_text(json.dumps({"reason": "corrupt local history file", "filename": path.name}))
                path.unlink()
        self.rejected_count = sum(1 for _ in self.rejected.glob("*.json"))

    async def put(self, entry: dict) -> None:
        record = entry["record"]
        rid = self._id(record["record_id"])
        validate_record(record)
        if entry.get("kind") not in ("session", "lap", "attempt", "decision"):
            raise ValueError("invalid history record kind")
        entry = {"kind": entry["kind"], "record": record}
        body = json.dumps({"target": self.target, **entry}, separators=(",", ":"), allow_nan=False).encode()
        async with self._lock:
            if rid in self._entries:
                if self._entries[rid] != entry:
                    raise ValueError("conflicting local history record")
                return
            if sum(self._sizes.values()) + len(body) > self.max_bytes:
                raise OutboxFull("history outbox capacity reached")
            await asyncio.to_thread(self._write, rid, body)
            self._entries[rid] = json.loads(json.dumps(entry))
            self._sizes[rid] = len(body)

    def _write(self, rid: str, body: bytes) -> None:
        self.directory.mkdir(parents=True, exist_ok=True)
        fd, temporary = tempfile.mkstemp(prefix=".", suffix=".tmp", dir=self.directory)
        try:
            with os.fdopen(fd, "wb") as output:
                output.write(body)
                output.flush()
                os.fsync(output.fileno())
            os.replace(temporary, self.directory / f"{rid}.json")
        finally:
            Path(temporary).unlink(missing_ok=True)

    async def pending(self) -> list[dict]:
        async with self._lock:
            return sorted(self._entries.values(), key=lambda e: (
                e["record"]["session_id"], e["record"]["sequence"], e["record"]["record_id"]))

    async def ack(self, record_id: str) -> None:
        rid = self._id(record_id)
        async with self._lock:
            await asyncio.to_thread((self.directory / f"{rid}.json").unlink, missing_ok=True)
            self._entries.pop(rid, None)
            self._sizes.pop(rid, None)

    async def quarantine(self, record_id: str, reason: str = "validation") -> None:
        rid = self._id(record_id)
        async with self._lock:
            entry = self._entries.get(rid)
            if entry is None:
                return
            # The reason is a category, never a remote response that might contain credentials.
            reason = reason if reason in ("validation", "blocked-parent", "conflict") else "validation"
            body = json.dumps({"target": self.target, **entry, "reason": reason}, allow_nan=False).encode()
            await asyncio.to_thread(self._reject, rid, body)
            self._entries.pop(rid, None)
            self._sizes.pop(rid, None)
            self.rejected_count += 1

    def _reject(self, rid: str, body: bytes) -> None:
        self.rejected.mkdir(parents=True, exist_ok=True)
        destination = self.rejected / f"{rid}.json"
        destination.write_bytes(body)
        (self.directory / f"{rid}.json").unlink(missing_ok=True)

    async def quarantine_session(self, session_id: str) -> None:
        for entry in await self.pending():
            if entry["record"]["session_id"] == session_id:
                await self.quarantine(entry["record"]["record_id"], "blocked-parent")
