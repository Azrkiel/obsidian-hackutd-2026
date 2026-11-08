"""aiohttp dashboard: GET / (page), GET /ws (events out, commands in), GET /state (snapshot),
GET /track (whole-lap mode: corners, talk zones, recent laps), GET /pair.svg (phone pairing QR),
GET/POST /settings and POST /personal_best/reset (retry offers)."""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

from aiohttp import WSMsgType, web

from .app import CoachApp

STATIC = Path(__file__).parent / "static"


def make_web_app(app: CoachApp) -> web.Application:
    web_app = web.Application()

    async def index(_: web.Request) -> web.StreamResponse:
        return web.Response(text=(STATIC / "index.html").read_text(encoding="utf-8"),
                            content_type="text/html")

    async def state(_: web.Request) -> web.StreamResponse:
        return web.json_response(app.snapshot())

    async def history(request: web.Request) -> web.StreamResponse:
        try:
            limit = int(request.query.get("limit", "100"))
        except ValueError:
            raise web.HTTPBadRequest(text="limit must be an integer")
        if not app.history:
            return web.json_response({"enabled": False, "drivers": [], "sessions": [], "laps": [], "decisions": []})
        try:
            data = await asyncio.to_thread(app.history.read, limit, request.query.get("driver_id"))
            return web.json_response(data)
        except Exception:
            return web.json_response({"enabled": True, "error": "History unavailable"}, status=503)

    async def history_config(_: web.Request) -> web.StreamResponse:
        return web.json_response(app.history_config())

    async def trace(request: web.Request) -> web.StreamResponse:
        if not app.history or not app.history.path.is_file():
            raise web.HTTPNotFound()
        try:
            rows = await asyncio.to_thread(app.history.trace, request.match_info["lap_id"])
        except Exception:
            raise web.HTTPServiceUnavailable(text="History unavailable")
        if rows is None:
            raise web.HTTPNotFound()
        return web.json_response({"rows": rows})

    async def pair_svg(_: web.Request) -> web.StreamResponse:
        """The phone pairing QR code (only with --inputs). The dashboard listens on 127.0.0.1 by
        default; with --host 0.0.0.0 anyone on the LAN could fetch the code, so keep it local."""
        hub = app.inputs
        if hub is None or hub.pairing is None or hub.pairing_mode == "off":
            raise web.HTTPNotFound(text="pairing is off: start the coach with --inputs")
        return web.Response(text=hub.pairing.qr_svg(), content_type="image/svg+xml",
                            headers={"Cache-Control": "no-store"})
    async def track(_: web.Request) -> web.StreamResponse:
        info = app.track_info()
        if info is None:
            return web.json_response({"error": "not in whole-lap mode (--track)"}, status=404)
        return web.json_response({**info, "laps": list(app.track_laps)})

    async def ws_handler(request: web.Request) -> web.StreamResponse:
        ws = web.WebSocketResponse(heartbeat=20)
        await ws.prepare(request)
        q: asyncio.Queue[dict] = asyncio.Queue()
        q.put_nowait(app.snapshot())
        unsub = app.subscribe(q.put_nowait)

        async def writer() -> None:
            while True:
                await ws.send_str(json.dumps(await q.get(), default=str))

        wtask = asyncio.create_task(writer())
        try:
            async for msg in ws:
                if msg.type == WSMsgType.TEXT:
                    try:
                        data = json.loads(msg.data)
                    except ValueError:
                        data = None
                    await app.handle_command(data)
        finally:
            unsub()
            wtask.cancel()
            await asyncio.gather(wtask, return_exceptions=True)
        return ws

    async def get_settings(_: web.Request) -> web.StreamResponse:
        if app.settings is None:
            raise web.HTTPNotFound(text="settings need --whole-lap")
        from .settings import LIMITS
        return web.json_response({"settings": app.settings.value.to_dict(),
                                  "limits": {k: list(v) for k, v in LIMITS.items()},
                                  "references": app.references.summary()})

    async def post_settings(request: web.Request) -> web.StreamResponse:
        if app.settings is None:
            raise web.HTTPNotFound(text="settings need --whole-lap")
        try:
            changes = await request.json()
            changed = await app.update_settings(changes)
        except ValueError as e:   # bad JSON or a value out of range (SettingsError)
            return web.json_response({"error": str(e)}, status=400)
        return web.json_response({"settings": app.settings.value.to_dict(), "changed": sorted(changed)})

    async def reset_pb(_: web.Request) -> web.StreamResponse:
        if not app.reset_personal_best():
            raise web.HTTPNotFound(text="personal bests need --whole-lap")
        return web.json_response(app.references.summary())

    web_app.router.add_get("/", index)
    web_app.router.add_get("/settings", get_settings)
    web_app.router.add_post("/settings", post_settings)
    web_app.router.add_post("/personal_best/reset", reset_pb)
    web_app.router.add_get("/state", state)
    web_app.router.add_get("/history", history)
    web_app.router.add_get("/history/config", history_config)
    web_app.router.add_get("/history/trace/{lap_id}", trace)
    async def viewer(_: web.Request) -> web.StreamResponse:
        return web.FileResponse(STATIC / "history" / "index.html")
    web_app.router.add_get("/history-viewer/", viewer)
    web_app.router.add_static("/history-viewer/assets/", STATIC / "history" / "assets")
    web_app.router.add_get("/pair.svg", pair_svg)
    web_app.router.add_get("/track", track)
    web_app.router.add_static("/pitpal/", STATIC / "pitpal")  # Pit Pal fonts and art
    web_app.router.add_get("/ws", ws_handler)
    return web_app


class Dashboard:
    def __init__(self, app: CoachApp, host: str = "127.0.0.1", port: int = 8020):
        self.app, self.host, self.port = app, host, port
        self._runner: web.AppRunner | None = None

    async def start(self) -> None:
        self._runner = web.AppRunner(make_web_app(self.app))
        await self._runner.setup()
        await web.TCPSite(self._runner, self.host, self.port).start()

    async def stop(self) -> None:
        if self._runner:
            await self._runner.cleanup()
