"""python -m pitpal [--url http://127.0.0.1:8020] [--scale N] [--side left|right] [--demo]"""
from __future__ import annotations

import argparse
import queue

from .window import Overlay


def main() -> None:
    ap = argparse.ArgumentParser(prog="pitpal", description="Rev, the Pit Pal overlay for Assetto Corsa")
    ap.add_argument("--url", default="http://127.0.0.1:8020", help="the coach's dashboard address")
    ap.add_argument("--scale", type=int, default=None, help="Rev's whole-number zoom (default: from the screen)")
    ap.add_argument("--side", choices=["left", "right"], default=None, help="which screen edge Rev sits on")
    ap.add_argument("--demo", action="store_true", help="play a scripted tour of every state, no coach needed")
    a = ap.parse_args()
    if a.demo:
        from . import demo
        q: "queue.Queue[dict]" = queue.Queue()
        ov = Overlay(a.url, a.scale, a.side, feed=q)
        demo.start(q)
    else:
        ov = Overlay(a.url, a.scale, a.side)
    ov.run()


if __name__ == "__main__":
    main()
