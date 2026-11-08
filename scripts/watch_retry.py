"""Watch checkpoint rewinds from the running coach's dashboard.

    uv run python scripts/watch_retry.py --log retry.log
    uv run python scripts/watch_retry.py --url ws://127.0.0.1:8020/ws --all

Run alongside the coach on the game PC. This is a read-only WebSocket listener.
It reports the held checkpoint, receiver-to-accept latency, accept-to-load delay,
and load-to-telemetry confirmation. "Slow" flags are guides for the one-shot mode.
For frame hitches, compare against the in-game frame-time display. To compare
capture costs at different cadences, stop the coach and run checkpoint_probe.py
with --period 1 and --period 3 in comparable offline practice runs.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import time
from contextlib import nullcontext
from dataclasses import dataclass
from pathlib import Path

import aiohttp

KEEP = {"input", "offer", "retry_started", "retry_judged", "retry_finished", "resume_point",
        "countdown", "reset_request", "reset_confirmed", "reset_failed", "status", "prompt",
        "resumed", "corner_event"}
QUIET = {"health", "live", "telemetry", "snapshot"}


def interval(label: str, start: float, end: float, slow_ms: int | None = None) -> str:
    ms = round((end - start) * 1000)
    flag = " [slow]" if slow_ms is not None and ms > slow_ms else ""
    return f"{label}={ms} ms{flag}"


def checkpoint(offer: dict) -> str:
    start = offer.get("start")
    if start is None:
        return "checkpoint unavailable"
    source = start["source"]
    fallback = " (fallback)" if source in ("buffer", "oldest") else ""
    return f"checkpoint={source}{fallback} at {start['pos_m']:.1f} m"


@dataclass
class RetryTiming:
    offer_id: str
    accepted_at: float
    phone_at: float | None
    single_retry: bool
    request_id: str | None = None
    requested_at: float | None = None


class RetryWatch:
    def __init__(self) -> None:
        self.phone_at: float | None = None
        self.accepted_offer: dict = {}
        self.active: RetryTiming | None = None

    def details(self, event: dict, ts: float) -> list[str]:
        kind = event.get("type")
        active = self.active
        if kind == "input" and event.get("message") == "phone: next":
            self.phone_at = ts
        elif kind == "offer":
            offer = event.get("offer") or event
            if offer.get("state") == "accepted":
                self.accepted_offer = offer
            if offer.get("state") in ("open", "accepted"):
                return [checkpoint(offer)]
        elif kind == "retry_started":
            phone_at = self.phone_at
            if phone_at is not None and not 0 <= ts - phone_at <= 2:
                phone_at = None
            self.phone_at = None
            offer_id = event["offer_id"]
            self.active = RetryTiming(offer_id, ts, phone_at, bool(event.get("single_retry")))
            details = [f"{event['corner']} ({offer_id})"]
            if self.accepted_offer.get("id") == offer_id:
                details.append(checkpoint(self.accepted_offer))
            if phone_at is not None:
                details.append(interval("receiver-to-accept", phone_at, ts))
            return details
        elif kind == "status" and (event.get("message") or "").startswith("ignored:"):
            self.phone_at = None
        elif active is not None:
            if kind == "reset_request" and event.get("slot") == "checkpoint":
                active.request_id = event.get("decision_id")
                active.requested_at = ts
                return [interval("accept-to-request", active.accepted_at, ts,
                                 500 if active.single_retry else None)]
            if kind == "reset_confirmed" and active.requested_at is not None and (
                    event.get("slot") == "checkpoint" and event.get("decision_id") == active.request_id):
                details = [interval("request-to-confirm", active.requested_at, ts, 1000)]
                if active.phone_at is not None:
                    details.append(interval("receiver-to-confirm", active.phone_at, ts))
                active.requested_at = None
                return details
            if kind == "reset_failed":
                details = [interval("accept-to-failure", active.accepted_at, ts)]
                if active.requested_at is not None:
                    details.append(interval("request-to-failure", active.requested_at, ts))
                return details
            if kind == "retry_finished" and event.get("offer_id") == active.offer_id:
                self.active = None
        return []


def describe(e: dict) -> str:
    t = e.get("type")
    if t == "countdown":
        return f"countdown n={e.get('n')}"
    if t == "offer":
        o = e.get("offer") or e
        return f"offer {o.get('state', '')} {o.get('id', '')} {o.get('corner', '')}".strip()
    if t == "status":
        return f"status {e.get('state') or e.get('status') or ''} {e.get('message') or ''}".strip()
    rest = {k: v for k, v in e.items() if k not in ("type", "ts", "text")}
    return f"{t} {e.get('text') or e.get('message') or json.dumps(rest, separators=(',', ':'))[:160]}"


async def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default="ws://127.0.0.1:8020/ws")
    ap.add_argument("--all", action="store_true", help="also print non-retry events, excluding high-rate telemetry")
    ap.add_argument("--log", type=Path, help="append the console output to this file")
    args = ap.parse_args()
    watch = RetryWatch()
    with args.log.open("a", encoding="utf-8", buffering=1) if args.log else nullcontext() as log:
        async with aiohttp.ClientSession() as session, session.ws_connect(args.url, heartbeat=10) as ws:
            print(f"listening on {args.url} (Ctrl+C to stop)", flush=True)
            async for msg in ws:
                if msg.type != aiohttp.WSMsgType.TEXT:
                    continue
                try:
                    event = json.loads(msg.data)
                except ValueError:
                    continue
                if not isinstance(event, dict) or event.get("type") in QUIET:
                    continue
                if not args.all and event.get("type") not in KEEP:
                    continue
                ts = float(event.get("ts") or time.time())
                details = watch.details(event, ts)
                stamp = time.strftime("%H:%M:%S", time.localtime(ts))
                line = f"{stamp}.{int(ts % 1 * 1000):03d}  " + " | ".join([describe(event), *details])
                print(line, flush=True)
                if log is not None:
                    print(line, file=log)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
    except (OSError, aiohttp.ClientError) as error:
        raise SystemExit(f"retry watcher: {error}") from None
