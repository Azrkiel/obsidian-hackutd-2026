"""Cached, optional cloud history. HTTP handlers never wait for cloud requests."""
from __future__ import annotations

import asyncio
import copy
import hashlib
import json
import math
import re
import time
from dataclasses import is_dataclass, replace
from pathlib import Path
from typing import Any


def history_query(*, session_id=None, kind="laps", limit=20, cursor=None, source=None) -> dict:
    if isinstance(limit, bool):
        raise ValueError("Invalid page size")
    try:
        limit = int(limit)
    except (TypeError, ValueError):
        raise ValueError("Invalid page size") from None
    if not 1 <= limit <= (100 if session_id else 50):
        raise ValueError("Invalid page size")
    if session_id is not None and not re.fullmatch(r"[A-Za-z0-9_-]{1,160}", str(session_id)):
        raise ValueError("Invalid session")
    if kind not in ("laps", "attempts", "decisions"):
        raise ValueError("Invalid history category")
    if cursor is not None and (not isinstance(cursor, str) or len(cursor) > 2048):
        raise ValueError("Invalid history cursor")
    if source not in (None, "ac", "sim", "replay"):
        raise ValueError("Invalid telemetry source")
    return dict(session_id=session_id, kind=kind, limit=limit, cursor=cursor, source=source)


def _key(query: dict) -> str:
    return hashlib.sha256(json.dumps(query, sort_keys=True).encode()).hexdigest()


class HistoryService:
    def __init__(self, config=None, data_dir="data", *, client=None, config_error=None,
                 cache_budget=50 * 1024 * 1024):
        self.config, self.data_dir, self.client = config, Path(data_dir), client
        self.cache_budget = cache_budget
        self._pages: dict[str, dict] = {}
        self._task: asyncio.Task | None = None
        self._state = "config_error" if config_error else "ready" if config else "disabled"
        self._error = "Cloud configuration needs attention." if config_error else None
        self._last_success = None
        self._role = getattr(config, "role", "unknown")
        self.upload_status = None
        self._closed = False

    @property
    def cache_dir(self) -> Path | None:
        cfg = self.config
        if cfg is None or not cfg.identity:
            return None
        scope = json.dumps([cfg.url, cfg.database, cfg.identity], separators=(",", ":"))
        return self.data_dir / "cloud" / "cache" / hashlib.sha256(scope.encode()).hexdigest()

    async def start(self):
        if self.config is not None and self.client is None:
            from .cloud_client import CloudClient
            self.client = CloudClient(self.config)
        if self.cache_dir is not None:
            self._pages = await asyncio.to_thread(self._load_cache)

    def _load_cache(self) -> dict:
        pages = {}
        folder = self.cache_dir
        if folder is None or not folder.exists() or folder.is_symlink():
            return pages
        total = 0
        for path in sorted(folder.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
            try:
                if path.is_symlink() or path.stat().st_size > self.cache_budget:
                    continue
                total += path.stat().st_size
                if total > self.cache_budget:
                    continue
                entry = json.loads(path.read_text(encoding="utf-8"))
                if not isinstance(entry, dict) or not isinstance(entry.get("data"), dict):
                    continue
                query = history_query(**entry["query"])
                if path.stem != _key(query) or not math.isfinite(entry["updated_at"]):
                    continue
                if not isinstance(entry["data"].get("items"), list):
                    continue
                entry["fresh"] = False
                pages[path.stem] = entry
            except (OSError, ValueError, KeyError, TypeError):
                continue
        return pages

    def status(self) -> dict:
        result = {"state": self._state, "refreshing": self._task is not None and not self._task.done(),
                  "last_success": self._last_success, "error": self._error, "role": self._role}
        if callable(self.upload_status):
            result["uploads"] = self.upload_status()
        return result

    def page(self, **kwargs) -> dict:
        query = history_query(**kwargs)
        entry = self._pages.get(_key(query))
        data = copy.deepcopy(entry["data"]) if entry else {"items": [], "next_cursor": None}
        data["cache"] = {"state": ("fresh" if entry["fresh"] and self._state == "ready" else "stale")
                         if entry else "not_fetched", "updated_at": entry["updated_at"] if entry else None}
        data["status"] = self.status()
        return data

    def refresh(self, **kwargs) -> bool:
        query = history_query(**kwargs)
        if self.config is None or self.client is None or self._closed:
            return False
        if self._task is not None and not self._task.done():
            return False
        self._state, self._error = "refreshing", None
        self._task = asyncio.create_task(self._fetch(query))
        return True

    async def _fetch(self, query: dict):
        try:
            access = await self.client.device_status()
            cfg = self.config
            identity, device_id = access.get("identity"), access.get("device_id")
            if (not identity or not device_id or access.get("role") not in ("admin", "writer", "viewer")
                    or (cfg.identity and cfg.identity != identity)
                    or (cfg.device_id and cfg.device_id != device_id)):
                await self._deny()
                return
            self._role = access["role"]
            if not cfg.identity and is_dataclass(cfg):
                self.config = replace(cfg, identity=identity, device_id=device_id, role=self._role)
            args = dict(limit=query["limit"], cursor=query["cursor"])
            if query["session_id"]:
                data = await self.client.get_session(query["session_id"], kind=query["kind"], **args)
            else:
                data = await self.client.list_sessions(source=query["source"], **args)
            if not isinstance(data, dict) or not isinstance(data.get("items"), list):
                raise ValueError("Invalid history response")
            # Only the history contract is sent to the browser or cache.
            data = {k: data[k] for k in ("items", "next_cursor", "session") if k in data}
            data.setdefault("next_cursor", None)
            now = time.time()
            entry = {"query": query, "data": data, "updated_at": now, "fresh": True}
            self._pages[_key(query)] = entry
            await asyncio.to_thread(self._save_cache, _key(query), entry)
            self._state, self._error, self._last_success = "ready", None, now
        except asyncio.CancelledError:
            raise
        except Exception as error:
            if getattr(error, "kind", "") in ("auth", "auth_error", "permission", "forbidden"):
                await self._deny()
            else:
                self._state, self._error = "offline", "Cloud history is unavailable. Saved history is still available."

    async def _deny(self):
        self._state, self._error = "auth_error", "This device needs valid database access."
        self._pages.clear()
        folder = self.cache_dir
        if folder is not None:
            await asyncio.to_thread(self._clear_cache, folder)

    @staticmethod
    def _clear_cache(folder):
        if folder.exists() and not folder.is_symlink():
            for path in folder.glob("*.json"):
                if not path.is_symlink():
                    path.unlink(missing_ok=True)

    def _save_cache(self, key, entry):
        folder = self.cache_dir
        if folder is None:
            return
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / f"{key}.json"
        content = json.dumps(entry, ensure_ascii=False, allow_nan=False).encode("utf-8")
        if len(content) > self.cache_budget:
            return
        temporary = path.with_suffix(".tmp")
        temporary.write_bytes(content)
        temporary.replace(path)
        paths = sorted(folder.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
        total = 0
        for existing in paths:
            if existing.is_symlink():
                continue
            total += existing.stat().st_size
            if total > self.cache_budget:
                self._pages.pop(existing.stem, None)
                existing.unlink(missing_ok=True)

    async def close(self):
        self._closed = True
        if self._task is not None and not self._task.done():
            self._task.cancel()
            await asyncio.gather(self._task, return_exceptions=True)
        if self.client is not None:
            await self.client.close()
