"""Compose optional cloud services without making game startup depend on a network."""
from __future__ import annotations

import asyncio
import os
from dataclasses import replace

from .cloud_config import CloudConfigError, load_config, read_profile, save_profile
from .cloud_history import HistoryService
from .cloud_sync import CloudSync


class CloudRuntime:
    def __init__(self, app, source_kind: str, *, config=None, error=None):
        self.app, self.source_kind, self.config = app, source_kind, config
        self.history = HistoryService(config, app.data_dir, config_error=error)
        self.history.upload_status = self.status
        self.sync = None
        self._task = None
        self._unsubscribe = None
        self._closed = False
        self._state = "config_error" if error else "pending" if config else "disabled"
        app.cloud_history, app.cloud_runtime = self.history, self

    def status(self):
        if self.sync is not None:
            return self.sync.status()
        return {"state": self._state, "pending": 0, "rejected": 0, "last_success": None,
                "capture_complete": self._state in ("disabled", "viewer"), "dropped": 0}

    async def start(self):
        if self.config is not None and self.config.role in ("writer", "admin") and self.config.identity and self.config.device_id:
            await self._enable_capture()
        try:
            await self.history.start()
        except Exception:
            self._state = "storage_error"
            self.history._state, self.history._error = "offline", "Saved cloud history could not be loaded."
        if self.config is not None:
            self._task = asyncio.create_task(self._discover(), name="cloud-device-access")

    async def _enable_capture(self):
        if self.sync is not None or self._closed:
            return
        app = self.app
        track = "" if self.source_kind == "ac" else getattr(app.track, "name", "") or getattr(app.track_model, "name", "") or app.corner.name
        self.sync = CloudSync(self.config, app.data_dir, self.source_kind, app.mode, track)
        try:
            await self.sync.start()
            self._unsubscribe = app.subscribe(self.sync.capture)
        except Exception:
            self._state = "storage_error"
            await self.sync.stop()
            self.sync = None

    async def _discover(self):
        while not self._closed:
            try:
                access = await self.history.client.device_status()
                identity = str(access.get("identity", "")).removeprefix("0x").lower()
                device_id, role = access.get("device_id"), access.get("role")
                cfg = self.config
                if (not identity or not device_id or role not in ("admin", "writer", "viewer")
                        or (cfg.identity and cfg.identity != identity) or (cfg.device_id and cfg.device_id != device_id)):
                    await self.history._deny()
                    self._state = "auth_error"
                    await self._disable_capture()
                    return
                self.config = replace(cfg, identity=identity, device_id=device_id, role=role,
                                      label=access.get("label") or cfg.label)
                self.history.config, self.history._role = self.config, role
                self.history._state, self.history._error = "ready", None
                if role in ("writer", "admin"):
                    await self._enable_capture()
                else:
                    self._state = "viewer"
                    await self._disable_capture()
                # Only update an existing vault-backed profile; env tokens are never persisted.
                if not any(name in os.environ for name in ("SPACETIMEDB_URL", "SPACETIMEDB_DATABASE", "SPACETIMEDB_TOKEN")):
                    try:
                        profile = await asyncio.to_thread(read_profile, self.app.data_dir)
                        if (profile and profile.get("url", "").rstrip("/") == cfg.url
                                and profile.get("database") == cfg.database and profile.get("identity") == identity):
                            await asyncio.to_thread(save_profile, self.app.data_dir, self.config)
                    except (OSError, CloudConfigError):
                        pass
                return
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                if getattr(exc, "kind", "") == "auth":
                    self._state = "auth_error"
                    await self.history._deny()
                    await self._disable_capture()
                    return
                self._state = "offline"
                self.history._state, self.history._error = "offline", "Cloud access is temporarily unavailable."
                await asyncio.sleep(10)

    async def _disable_capture(self):
        if self._unsubscribe is not None:
            self._unsubscribe()
            self._unsubscribe = None
        if self.sync is not None:
            await self.sync.stop()
            self.sync = None

    def update_metadata(self):
        if self.sync is not None and self.source_kind == "ac":
            self.sync.update_metadata(track=getattr(self.app.source, "track", "") or None,
                                      car=getattr(self.app.source, "car", "") or None)

    async def stop(self):
        self._closed = True
        if self._task is not None and not self._task.done():
            self._task.cancel()
            await asyncio.gather(self._task, return_exceptions=True)
        await self._disable_capture()
        await self.history.close()


def configure_cloud(app, source_kind: str, *, enabled=True, environ=None):
    config, error = None, None
    if enabled:
        try:
            config = load_config(app.data_dir, environ=environ)
        except CloudConfigError:
            error = "Cloud profile needs attention."
    return CloudRuntime(app, source_kind, config=config, error=error)
