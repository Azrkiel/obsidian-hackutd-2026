"""Check the Lua app's rolling checkpoints in game and measure what a save costs (ROLLING_CHECKPOINTS.md B, C).

Run on the game PC with AC on track (offline practice) and the coach NOT running (both use UDP 9102):

    uv run python scripts/checkpoint_probe.py --seconds 300            # lap for 5 min, then a summary
    uv run python scripts/checkpoint_probe.py --seconds 40 --hold-at 10 --restore-at 35
        # holds the newest save at 10 s, restores it at 35 s: the car should jump back ~25 s

Watch the frame time in game (CSP FPS counter) while it runs. The summary gives:
  call_ms  time inside saveCarStateAsync, i.e. the frame cost of each save (the go/no-go number)
  done_ms  until the state arrived
  bytes    state size
"""
from __future__ import annotations

import argparse
import asyncio
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from coach.checkpoints import CheckpointStore  # noqa: E402


def summary(name: str, values: list[float]) -> str:
    if not values:
        return f"{name:8} (none)"
    v = sorted(values)
    p95 = v[min(len(v) - 1, int(0.95 * len(v)))]
    return (f"{name:8} n={len(v)} min={v[0]:.2f} median={statistics.median(v):.2f} "
            f"p95={p95:.2f} max={v[-1]:.2f}")


async def main(a: argparse.Namespace) -> int:
    seen = []
    store = CheckpointStore(lambda e: print("  ", e.get("message", e)), period_s=a.period, keep=a.keep,
                            anchors=[float(x) for x in a.anchors.split(",") if x], cfg_every_s=5)
    orig = store.feed

    def feed(line: str):
        cp = orig(line)
        if cp:
            seen.append(cp)
            print(f"CK {cp.seq:4} {cp.kind} pos={cp.spline:.4f} {cp.speed_kmh:6.1f} km/h lap {cp.lap} "
                  f"call={cp.call_ms:.2f} ms done={cp.done_ms:.2f} ms {cp.size} B")
        return cp

    store.feed = feed
    try:
        await store.start()
    except OSError as e:
        print(f"cannot listen on 127.0.0.1:9102 ({e}); is the coach running? Stop it first.")
        return 2
    await asyncio.sleep(0.5)
    if not store.lua_ok:
        print("no CFGOK from the Lua app on 127.0.0.1:9101: is the new nomadsim_reset installed and "
              "AC on track?")
    loop = asyncio.get_running_loop()
    t0 = loop.time()
    held = False
    try:
        while loop.time() - t0 < a.seconds:
            el = loop.time() - t0
            if a.hold_at is not None and not held and el >= a.hold_at and store.latest():
                cp = store.latest()
                held = await store.hold("probe", cp)
                print(f">> HOLD seq {cp.seq} at pos {cp.spline:.4f}: {'ok' if held else 'FAILED'}")
            if a.restore_at is not None and held and el >= a.restore_at:
                ok = await store.restore("probe1", "probe")
                print(f">> RESTORE: {'ACK (check the car jumped back)' if ok else 'FAILED'}")
                a.restore_at = None
            await asyncio.sleep(0.1)
    finally:
        await store.stop()
    timed = [c for c in seen if c.kind == "t"]
    print("\n--- summary ---")
    print(summary("call_ms", [c.call_ms for c in seen if c.call_ms >= 0]))
    print(summary("done_ms", [c.done_ms for c in seen]))
    print(summary("bytes", [float(c.size) for c in seen]))
    if len(timed) > 1:
        gaps = [b.t - a_.t for a_, b in zip(timed, timed[1:])]
        print(summary("gap_s", gaps), f"(target {a.period:g} s)")
    print(f"anchor saves: {sum(c.kind == 'a' for c in seen)}")
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--seconds", type=float, default=60)
    ap.add_argument("--period", type=float, default=1.0)
    ap.add_argument("--keep", type=int, default=20)
    ap.add_argument("--anchors", default="", help="track positions 0..1, comma separated")
    ap.add_argument("--hold-at", type=float, default=None, help="hold the newest save after this many s")
    ap.add_argument("--restore-at", type=float, default=None, help="restore the held save after this many s")
    sys.exit(asyncio.run(main(ap.parse_args())))
