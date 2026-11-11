"""Raise the crash offer now, without crashing the car (whole-lap mode, running coach).

    uv run python scripts/trigger_crash.py
    uv run python scripts/trigger_crash.py --url ws://127.0.0.1:8020/ws --accept

Rev should say "Crashed. Press Next to rewind to just before it." and the phone's Next button lights up.
With --accept it also presses Next for you after a short pause, so the 3-2-1 and the rewind run.
"""
import argparse
import asyncio
import json

import aiohttp


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="ws://127.0.0.1:8020/ws")
    ap.add_argument("--accept", action="store_true", help="also accept the offer after --wait seconds")
    ap.add_argument("--wait", type=float, default=2.0)
    a = ap.parse_args()
    async with aiohttp.ClientSession() as http, http.ws_connect(a.url) as ws:
        await ws.send_str(json.dumps({"type": "simulate_crash"}))
        print("simulate_crash sent: watch Rev, the dashboard and the phone")
        if a.accept:
            await asyncio.sleep(a.wait)
            await ws.send_str(json.dumps({"type": "accept"}))
            print("accept sent: 3-2-1, then the rewind")
            await asyncio.sleep(6)


if __name__ == "__main__":
    asyncio.run(main())
