"""A scripted tour of every Rev state, with no coach running (python -m pitpal --demo).

It plays the same events the coach streams, so what you see here is what the game will show. Handy
for checking the overlay on a new screen, and for the demo table.
"""
from __future__ import annotations

import queue
import threading
import time

PAIR_URI = "nomadsim://pair?v=1&h=192.168.1.24&p=5005&k=AAAAAAAAAAAAAAAAAAAAAA&n=RIG&id=0a1b2c3d"


def _health(phone: str = "silent", arduino: str = "silent", mode: str = "fast", muted: bool = False) -> dict:
    return {"type": "health", "ai": {"mode": mode, "provider": "nemotron", "label": "Nemotron · fast" if mode == "fast" else "Rules (AI unavailable)"},
            "inputs": {"phone": phone, "arduino": arduino, "pairing": {"mode": "optional", "paired": 0}},
            "voice": {"speaker": "windows", "muted": muted, "queued": 0}, "track": "Monza", "mode": "lap"}


def _drive(q: "queue.Queue[dict]", seconds: float, **kw) -> None:
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        q.put({"type": "telemetry", "status": "live", "speed_kmh": 142.0, "gas": 0.8, "brake": 0.0, "steer": 0.0,
               "pos_m": 900.0, "g_lat": 0.1, "slip_f": 0.02, "slip_r": 0.03, "tyres_out": 0, **kw})
        time.sleep(0.1)


def tour(q: "queue.Queue[dict]", loop: bool = True) -> None:
    def say(text: str, hold: float = 3.0, i: int = 1) -> None:
        q.put({"type": "voice", "id": i, "kind": "advice", "text": text, "status": "speaking"})
        time.sleep(hold)
        q.put({"type": "voice", "id": i, "kind": "advice", "text": text, "status": "spoken"})

    while True:
        q.put({"type": "_conn", "online": True})
        q.put({"type": "_pair", "uri": PAIR_URI})
        q.put(_health())
        time.sleep(7.0)                                           # pairing: SCAN ME
        q.put(_health(phone="live", arduino="live"))
        time.sleep(4.0)                                           # connected, idle
        q.put({"type": "corner_event", "corner": "Turn 1", "kinds": ["late_brake"]})
        time.sleep(2.5)                                           # thinking
        say("Brake 12 m later. Keep the car straight.")
        _drive(q, 3.0)                                            # racing: helmet on
        q.put({"type": "offer", "id": "e1", "state": "open", "corner": "Turn 1", "cue": "You braked late into Turn 1. Brake at the 100 m board.", "ms_left": 6000})
        _drive(q, 5.0)
        q.put({"type": "offer", "id": "e1", "state": "accepted"})
        for n in (3, 2, 1):
            q.put({"type": "countdown", "n": n})
            time.sleep(1.0)
        q.put({"type": "countdown", "n": 0})
        q.put({"type": "retry_judged", "offer_id": "e1", "try": 2, "fixed": True})
        _drive(q, 3.0)
        _drive(q, 1.0, brake=0.95, slip_f=0.6, speed_kmh=180.0)   # a lock-up
        _drive(q, 3.0)
        q.put(_health(phone="live", arduino="silent"))             # pedals drop out
        _drive(q, 4.5)
        q.put(_health(phone="live", arduino="live", mode="rules"))
        _drive(q, 3.5)
        if not loop:
            return


def start(q: "queue.Queue[dict]", loop: bool = True) -> None:
    threading.Thread(target=tour, args=(q, loop), daemon=True, name="pitpal-demo").start()
