"""Browser-origin protection shared by the local web servers (coach dashboard, history viewer)."""
from __future__ import annotations

import os

from aiohttp import web

LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1"}


def _hostname(host: str) -> str:
    """The name part of a Host header: 'localhost:8020' -> 'localhost', '[::1]:8020' -> '::1'."""
    if host.startswith("["):
        return host[1:host.index("]")] if "]" in host else host
    return host.rsplit(":", 1)[0] if host.count(":") == 1 else host


def make_guard(local_only: bool):
    """Browser-origin protection for the local dashboard. Any web page you visit can open a WebSocket or send a request to
    127.0.0.1, and a WebSocket can read what it receives; so (1) a request that carries an Origin header must come from this
    same origin, and (2) while the dashboard is loopback-only, the Host header must be a loopback name, which stops DNS
    rebinding. The overlay and scripts send no Origin header, so they are unaffected."""
    @web.middleware
    async def guard(request: web.Request, handler):
        extra = {o.strip().rstrip("/") for o in os.getenv("PITPAL_ALLOWED_ORIGINS", "").split(",") if o.strip()}   # opt-in escape hatch, e.g. a tunnel
        if local_only and _hostname(request.host) not in LOOPBACK_HOSTS and not extra:
            raise web.HTTPForbidden(text="Unexpected Host header")
        origin = request.headers.get("Origin")
        if origin and origin != f"{request.scheme}://{request.host}" and origin.rstrip("/") not in extra:
            raise web.HTTPForbidden(text="Cross-origin requests are not allowed")
        resp = await handler(request)
        if not getattr(resp, "prepared", False):                       # a WebSocket is already on the wire
            resp.headers.setdefault("X-Content-Type-Options", "nosniff")
            resp.headers.setdefault("Referrer-Policy", "no-referrer")
            resp.headers.setdefault("X-Frame-Options", "DENY")
        return resp
    return guard
