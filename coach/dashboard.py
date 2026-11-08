"""aiohttp dashboard: GET / (page), GET /ws (events out, commands in), GET /state (snapshot)."""
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

    web_app.router.add_get("/", index)
    web_app.router.add_get("/state", state)
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
