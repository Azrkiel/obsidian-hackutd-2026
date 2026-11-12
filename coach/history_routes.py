"""Same-origin history endpoints shared by the coach and history-only viewer."""
from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import urlsplit

from aiohttp import web

from . import telemetry_log
from .cloud_history import HistoryService, history_query

STATIC = Path(__file__).parent / "static"
HISTORY_SERVICE = web.AppKey("history_service", HistoryService)
_HEADERS = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}


def add_telemetry_routes(app: web.Application, directory) -> None:
    """Local telemetry CSVs: GET /telemetry, /telemetry/{session}.json?lap=N, /telemetry/{session}.csv?lap=N."""
    directory = Path(directory)

    def lap_arg(request):
        raw = request.query.get("lap")
        if raw in (None, ""):
            return None
        try:
            lap = int(raw)
        except ValueError:
            raise web.HTTPBadRequest(text="Invalid lap") from None
        if not 1 <= lap <= 9999:
            raise web.HTTPBadRequest(text="Invalid lap")
        return lap

    async def index(_):
        return web.json_response({"sessions": telemetry_log.list_sessions(directory)}, headers=_HEADERS)

    async def as_json(request):
        sid, lap = request.match_info["session"], lap_arg(request)
        rows = telemetry_log.read_session(directory, sid)
        if rows is None:
            raise web.HTTPNotFound(text="No telemetry saved for this session on this PC")
        laps = sorted({int(r["lap"]) for r in rows})
        pick = lap if lap in laps else (laps[-1] if laps else None)
        sel = [r for r in rows if int(r["lap"]) == pick]
        return web.json_response({"laps": laps, "lap": pick, "t": [float(r["t_s"]) for r in sel],
                                  "speed": [float(r["speed_kmh"]) for r in sel],
                                  "gas": [float(r["gas"]) for r in sel], "brake": [float(r["brake"]) for r in sel],
                                  "pos": [float(r["pos_m"]) for r in sel]}, headers=_HEADERS)

    async def as_csv(request):
        sid, lap = request.match_info["session"], lap_arg(request)
        rows = telemetry_log.read_session(directory, sid, lap)
        if rows is None:
            raise web.HTTPNotFound(text="No telemetry saved for this session on this PC")
        name = f"pitpal-telemetry-{sid}" + (f"-lap{lap}" if lap else "") + ".csv"
        return web.Response(text=telemetry_log.to_csv(rows), content_type="text/csv",
                            headers={**_HEADERS, "Content-Disposition": f'attachment; filename="{name}"'})

    app.router.add_get("/telemetry", index)
    app.router.add_get("/telemetry/{session}.json", as_json)
    app.router.add_get("/telemetry/{session}.csv", as_csv)


def add_history_routes(app: web.Application, service: HistoryService, *, root=False):
    app[HISTORY_SERVICE] = service
    add_telemetry_routes(app, service.data_dir / "telemetry")

    def query(request, *, body=None):
        values = dict(request.query) if body is None else body
        if not isinstance(values, dict) or set(values) - {"session_id", "kind", "limit", "cursor", "source"}:
            raise web.HTTPBadRequest(text="Invalid history request")
        values = {k: (None if v == "" else v) for k, v in values.items()}
        if "session_id" in request.match_info:
            values["session_id"] = request.match_info["session_id"]
        try:
            return history_query(**values)
        except (ValueError, TypeError):
            raise web.HTTPBadRequest(text="Invalid history request") from None

    async def page(request):
        return web.json_response(service.page(**query(request)), headers=_HEADERS)

    async def status(_):
        return web.json_response(service.status(), headers=_HEADERS)

    async def refresh(request):
        origin = request.headers.get("Origin")
        if origin and origin != f"{request.scheme}://{request.host}":
            raise web.HTTPForbidden(text="Use the local history page to refresh")
        if request.content_length and request.content_length > 8192:
            raise web.HTTPRequestEntityTooLarge(max_size=8192, actual_size=request.content_length)
        try:
            data = await request.json()
        except (ValueError, TypeError, json.JSONDecodeError):
            raise web.HTTPBadRequest(text="Expected a JSON history request") from None
        started = service.refresh(**query(request, body=data))
        return web.json_response({"started": started, "status": service.status()}, status=202, headers=_HEADERS)

    async def html(_):
        headers = {**_HEADERS, "Content-Security-Policy": "default-src 'self'; script-src 'self'; "
                   "style-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"}
        return web.Response(text=(STATIC / "cloud-history.html").read_text(encoding="utf-8"),
                            content_type="text/html", headers=headers)

    async def script(_):
        return web.Response(text=(STATIC / "cloud-history.js").read_text(encoding="utf-8"),
                            content_type="application/javascript", headers=_HEADERS)

    if root:
        app.router.add_get("/", html)
    app.router.add_get("/cloud-history-view", html)
    app.router.add_get("/cloud-history.js", script)
    app.router.add_get("/cloud-history", page)
    app.router.add_get("/cloud-history/status", status)
    app.router.add_post("/cloud-history/refresh", refresh)
    app.router.add_get("/cloud-history/{session_id}", page)


def make_history_app(service: HistoryService) -> web.Application:
    app = web.Application(client_max_size=8192)
    add_history_routes(app, service, root=True)
    app.router.add_static("/pitpal/", STATIC / "pitpal")  # Pit Pal fonts and art (the coach dashboard adds its own)

    async def lifecycle(_):
        await service.start()
        yield
        await service.close()

    app.cleanup_ctx.append(lifecycle)
    return app
