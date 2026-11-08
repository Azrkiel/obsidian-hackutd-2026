"""Low-volume SpacetimeDB HTTP transport. Exceptions contain no credentials or remote bodies."""
from __future__ import annotations

import asyncio
import json
import math
import time
from email.utils import parsedate_to_datetime
from urllib.parse import quote

import aiohttp


class CloudError(Exception):
    def __init__(self, kind: str, message: str = "", *, retry_after: float | None = None):
        self.kind, self.retry_after = kind, retry_after
        # Caller-provided messages may be a remote exception. Keep public output categorical.
        super().__init__({"auth": "Cloud access denied; check device registration and credentials.",
                          "retryable": "Cloud connection temporarily unavailable.",
                          "validation": "Cloud record rejected.",
                          "not_found": "Cloud history record was not found.",
                          "response": "Unexpected cloud response."}.get(kind, "Cloud operation failed."))


def _denial(text: str) -> bool:
    text = text.lower()
    return any(s in text for s in ("unauthorized", "unauthorised", "forbidden", "access denied",
                                   "not authorized", "not registered", "unregistered", "revoked",
                                   "disabled device", "viewer cannot", "writer required", "access_denied", "auth:"))


def _application_error(text: str) -> str | None:
    if _denial(text):
        return "auth"
    text = text.lower()
    if "not_found" in text:
        return "not_found"
    if any(marker in text for marker in ("validation:", "invalid_record", "invalid_request", "conflict")):
        return "validation"
    return None


def _retry_after(value: str | None) -> float | None:
    if not value:
        return None
    try:
        seconds = float(value)
        return max(0.0, seconds) if math.isfinite(seconds) else None
    except ValueError:
        try:
            return max(0.0, parsedate_to_datetime(value).timestamp() - time.time())
        except (ValueError, TypeError, OverflowError):
            return None


def decode_result(value):
    """Decode string procedure returns and the HTTP API's result envelopes."""
    for _ in range(5):
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except ValueError:
                if not value.strip():
                    return None
                raise CloudError("response") from None
        elif isinstance(value, dict) and "Err" in value:
            raise CloudError(_application_error(str(value["Err"])) or "validation")
        elif isinstance(value, dict) and set(value) == {"Ok"}:
            value = value["Ok"]
        else:
            return value
    raise CloudError("response")


class CloudClient:
    def __init__(self, config, session: aiohttp.ClientSession | None = None, *, timeout: float = 5.0):
        self.config, self._session, self.timeout = config, session, timeout
        self._owns_session = session is None

    async def call(self, name: str, args: list):
        if self._session is None:
            self._session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout))
        base = str(self.config.url).rstrip("/")
        url = f"{base}/v1/database/{quote(str(self.config.database), safe='')}/call/{quote(name, safe='')}"
        try:
            async with self._session.post(url, json=args, params={"confirmed": "true"},
                                          headers={"Authorization": f"Bearer {self.config.token}"},
                                          allow_redirects=False,
                                          timeout=aiohttp.ClientTimeout(total=self.timeout)) as response:
                if 300 <= response.status < 400:
                    raise CloudError("response")
                raw = bytearray()
                async for chunk in response.content.iter_chunked(16384):
                    raw.extend(chunk)
                    if len(raw) > 8 * 1024 * 1024:
                        raise CloudError("response")
                try:
                    body = raw.decode("utf-8")
                except UnicodeError:
                    raise CloudError("response") from None
                if response.status in (401, 403):
                    raise CloudError("auth")
                application_error = _application_error(body) if response.status >= 400 else None
                if application_error:
                    raise CloudError(application_error)
                if response.status == 429 or response.status >= 500:
                    raise CloudError("retryable", retry_after=_retry_after(response.headers.get("Retry-After")))
                if response.status >= 400:
                    raise CloudError("auth" if _denial(body) else "validation")
                if not body.strip():
                    return None
                try:
                    value = json.loads(body)
                except ValueError:
                    raise CloudError("response") from None
                return decode_result(value)
        except CloudError:
            raise
        except (aiohttp.ClientError, asyncio.TimeoutError, OSError):
            raise CloudError("retryable") from None

    async def record(self, kind: str, record: dict):
        if kind not in ("session", "lap", "attempt", "decision"):
            raise ValueError("invalid cloud record kind")
        return await self.call(f"record_{kind}", [json.dumps(record, separators=(",", ":"), allow_nan=False)])

    async def list_sessions(self, limit: int = 20, cursor: str | None = None, source: str | None = None):
        return await self.call("list_sessions", [json.dumps({"limit": limit, "cursor": cursor, "source": source})])

    async def get_session(self, session_id: str, kind: str = "laps", limit: int = 100, cursor: str | None = None):
        return await self.call("get_session", [json.dumps({"session_id": session_id, "kind": kind,
                                                         "limit": limit, "cursor": cursor})])

    async def device_status(self):
        return await self.call("device_status", ["{}"])

    async def close(self) -> None:
        if self._owns_session and self._session is not None:
            await self._session.close()
            self._session = None
