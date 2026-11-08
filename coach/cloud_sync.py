"""Optional background persistence/upload service; live event callbacks never perform I/O."""
from __future__ import annotations

import asyncio
import random
import time
from pathlib import Path

from .cloud_client import CloudClient, CloudError
from .cloud_outbox import CloudOutbox, binding_for
from .cloud_records import RecordProjector


class CloudSync:
    def __init__(self, config, data_dir: str | Path, source: str, mode: str, track: str,
                 car: str = "", *, client=None, outbox=None, buffer_size: int = 256,
                 retry_base: float = 1.0):
        self.config = config
        self.projector = RecordProjector(source, mode, track, car)
        self.client = client or CloudClient(config)
        self.outbox = outbox or CloudOutbox(Path(data_dir) / "cloud", binding_for(config))
        self._buffer: asyncio.Queue = asyncio.Queue(maxsize=buffer_size)
        self._wake = asyncio.Event()
        self._writer: asyncio.Task | None = None
        self._uploader: asyncio.Task | None = None
        self._running = False
        self._stopping = False
        self._state = "disabled"
        self._error: str | None = None
        self._incomplete = False
        self._dropped = 0
        self._last_success: float | None = None
        self._blocked_sessions: set[str] = set()
        self.retry_base = retry_base

    @property
    def session_id(self) -> str:
        return self.projector.session_id

    async def start(self) -> None:
        if self._running:
            return
        try:
            await self.outbox.initialize()
        except (OSError, ValueError):
            self._state, self._error, self._incomplete = "storage-error", "local-storage", True
            return
        self._running, self._stopping, self._state = True, False, "syncing"
        self._writer = asyncio.create_task(self._persist(), name="cloud-history-writer")
        self._uploader = asyncio.create_task(self._upload(), name="cloud-history-uploader")
        self._enqueue(self.projector.session_record())

    def _enqueue(self, entry: dict) -> None:
        try:
            self._buffer.put_nowait(entry)
        except asyncio.QueueFull:
            self._incomplete = True
            self._dropped += 1
            self._error = "capture-buffer-full"

    def capture(self, event: dict) -> None:
        if not self._running or self._stopping:
            return
        try:
            entries = self.projector.capture(event)
        except (ValueError, TypeError, KeyError, OverflowError):
            self._incomplete, self._error = True, "invalid-history-event"
            self._dropped += 1
            return
        for entry in entries:
            self._enqueue(entry)

    def update_metadata(self, track: str | None = None, car: str | None = None) -> None:
        if not self._running or self._stopping:
            return
        try:
            for entry in self.projector.update_metadata(track, car):
                self._enqueue(entry)
        except (ValueError, TypeError):
            self._incomplete, self._error = True, "invalid-history-metadata"

    def status(self) -> dict:
        pending = self.outbox.count + self._buffer.qsize()
        state = self._state
        if state in ("syncing", "synced"):
            state = "syncing" if pending else "synced"
        return {"state": state, "pending": pending, "rejected": self.outbox.rejected_count,
                "last_success": self._last_success, "capture_complete": not self._incomplete,
                "dropped": self._dropped, "error": self._error}

    async def _persist(self) -> None:
        while True:
            entry = await self._buffer.get()
            try:
                await self.outbox.put(entry)
                if entry["record"]["session_id"] in self._blocked_sessions:
                    await self.outbox.quarantine(entry["record"]["record_id"], "blocked-parent")
                self._wake.set()
            except (OSError, ValueError):
                self._incomplete, self._state, self._error = True, "storage-error", "local-storage"
                self._dropped += 1
            finally:
                self._buffer.task_done()

    async def _upload(self) -> None:
        failures = 0
        verified = False
        while True:
            entries = []
            try:
                if not verified:
                    membership = await self.client.device_status()
                    if not isinstance(membership, dict) or membership.get("role") not in ("writer", "admin"):
                        raise CloudError("auth")
                    if (membership.get("identity") != self.config.identity or
                            membership.get("device_id") != self.config.device_id):
                        raise CloudError("auth")
                    verified = True
                entries = await self.outbox.pending()
                if not entries:
                    self._wake.clear()
                    # Recheck after clearing, because persistence may have raced this task.
                    if self.outbox.count:
                        continue
                    if self._state != "storage-error":
                        self._state = "synced"
                    await self._wake.wait()
                    continue
                entry = entries[0]
                await self.client.record(entry["kind"], entry["record"])
                await self.outbox.ack(entry["record"]["record_id"])
                failures, self._last_success = 0, time.time()
                if self._state != "storage-error":
                    self._state, self._error = "syncing", None
            except CloudError as exc:
                if exc.kind == "auth":
                    self._state, self._error = "auth-error", "cloud-access"
                    return
                if exc.kind == "validation" and verified and entries:
                    self._incomplete, self._error = True, "cloud-record-rejected"
                    try:
                        await self.outbox.quarantine(entry["record"]["record_id"])
                        if entry["kind"] == "session":
                            self._blocked_sessions.add(entry["record"]["session_id"])
                            await self.outbox.quarantine_session(entry["record"]["session_id"])
                    except OSError:
                        self._state, self._error = "storage-error", "local-storage"
                        return
                    continue
                self._state, self._error = "offline", "cloud-unavailable"
                delay = max(exc.retry_after or 0, min(30.0, self.retry_base * 2 ** min(failures, 6)))
                failures += 1
                await asyncio.sleep(delay + random.uniform(0, min(delay * .1, 1.0)))
            except (OSError, ValueError):
                self._state, self._error, self._incomplete = "storage-error", "local-storage", True
                return

    async def stop(self) -> None:
        if self._stopping:
            return
        self._stopping = True
        if self._running:
            try:
                # A stop marker is persisted locally; shutdown never waits for a network retry.
                await asyncio.wait_for(self._buffer.put(self.projector.end(self._incomplete)), .5)
                await asyncio.wait_for(self._buffer.join(), 1.5)
                # Give an already-connected uploader a scheduling turn, without a network wait.
                if self._state in ("syncing", "synced"):
                    await asyncio.sleep(.02)
            except (asyncio.TimeoutError, ValueError):
                self._incomplete, self._error = True, "shutdown-persistence-timeout"
        self._running = False
        tasks = [task for task in (self._writer, self._uploader) if task is not None]
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        await self.client.close()
