"""The overlay's link to the coach: events in from ws://<coach>/ws, commands out.

Runs on its own thread with its own event loop so a slow frame never blocks the socket (and a slow
socket never blocks a frame). Events land on a queue the Tk loop drains. Besides the coach's events
it puts two of its own on the queue:  {"type": "_conn", "online": bool}  and
{"type": "_pair", "uri": str | None}  (the phone pairing link, from /pair.json).
"""
from __future__ import annotations

import asyncio
import json
import queue
import threading

import aiohttp


class CoachClient(threading.Thread):
    def __init__(self, base_url: str, out: "queue.Queue[dict]"):
        super().__init__(daemon=True, name="pitpal-client")
        self.base = base_url.rstrip("/")
        self.out = out
        self._loop: asyncio.AbstractEventLoop | None = None
        self._send_q: asyncio.Queue | None = None
        self._stop_evt = threading.Event()
        self._ready = threading.Event()

    def send(self, msg: dict) -> None:
        if self._loop is not None and self._send_q is not None:
            self._loop.call_soon_threadsafe(self._send_q.put_nowait, msg)

    def stop(self) -> None:
        self._stop_evt.set()

    def run(self) -> None:
        asyncio.run(self._main())

    async def _pair_uri(self, http: aiohttp.ClientSession) -> str | None:
        try:
            async with http.get(f"{self.base}/pair.json") as r:
                return (await r.json())["uri"] if r.status == 200 else None
        except (aiohttp.ClientError, asyncio.TimeoutError, ValueError, KeyError):
            return None

    async def _main(self) -> None:
        self._loop, self._send_q = asyncio.get_running_loop(), asyncio.Queue()
        timeout = aiohttp.ClientTimeout(total=None, connect=3)
        async with aiohttp.ClientSession(timeout=timeout) as http:
            while not self._stop_evt.is_set():
                try:
                    async with http.ws_connect(f"{self.base}/ws", heartbeat=20) as ws:
                        self.out.put({"type": "_conn", "online": True})
                        self.out.put({"type": "_pair", "uri": await self._pair_uri(http)})
                        sender = asyncio.create_task(self._sender(ws))
                        try:
                            async for msg in ws:
                                if msg.type != aiohttp.WSMsgType.TEXT:
                                    continue
                                try:
                                    e = json.loads(msg.data)
                                except ValueError:
                                    continue
                                self.out.put(e)
                                if e.get("type") == "input" and "pairing code" in str(e.get("message")):
                                    self.out.put({"type": "_pair", "uri": await self._pair_uri(http)})
                                if self._stop_evt.is_set():
                                    break
                        finally:
                            sender.cancel()
                except (aiohttp.ClientError, asyncio.TimeoutError, OSError):
                    pass
                self.out.put({"type": "_conn", "online": False})
                for _ in range(15):
                    if self._stop_evt.is_set():
                        return
                    await asyncio.sleep(0.1)

    async def _sender(self, ws: aiohttp.ClientWebSocketResponse) -> None:
        while True:
            msg = await self._send_q.get()
            await ws.send_str(json.dumps(msg))
