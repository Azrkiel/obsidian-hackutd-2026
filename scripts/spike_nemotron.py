"""Live API spike: latency / reasoning / tool-call reliability of Nemotron modes.

Usage: uv run python scripts/spike_nemotron.py [--n 5] [--provider brev|nvidia|openrouter]
Needs NEMOTRON_BASE_URL (Brev vLLM), NVIDIA_API_KEY or OPENROUTER_API_KEY.
On brev the think@512 and think@256 rows are the same call (vLLM has no reasoning budget).
"""
from __future__ import annotations

import argparse
import asyncio
import statistics
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import truststore  # noqa: E402

truststore.inject_into_ssl()  # TLS interception on this machine

from engine.config import load_attempt, load_corner  # noqa: E402
from engine.evidence import build_packet  # noqa: E402
from engine.nemotron import ProviderError, default_providers  # noqa: E402
from engine.tools import validate  # noqa: E402


def pct(xs: list[float], p: float) -> float:
    if not xs:
        return float("nan")
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(round(p * (len(xs) - 1))))]


async def one(prov, packet, mode, transport, think_tokens):
    t0 = time.monotonic()
    row = {"first_ms": None, "total_ms": None, "reasoning_len": 0, "valid": False, "err": ""}
    try:
        res = await prov.call(packet, mode, transport=transport, think_tokens=think_tokens)
        row.update(first_ms=res.first_reasoning_ms, total_ms=res.latency_ms,
                   reasoning_len=len(res.reasoning))
        ok, why = validate(res.call, packet)
        row["valid"] = ok
        row["err"] = why or ""
    except ProviderError as e:
        row["total_ms"] = (time.monotonic() - t0) * 1000
        row["err"] = e.kind
    except Exception as e:  # noqa: BLE001
        row["total_ms"] = (time.monotonic() - t0) * 1000
        row["err"] = repr(e)[:40]
    return row


async def main_async(args) -> None:
    corner = load_corner(ROOT / "fixtures" / "corner_monza_t1.json")
    ref = load_attempt(ROOT / "fixtures" / "reference.json")
    att = load_attempt(ROOT / "fixtures" / "attempts" / "late_brake.json")
    packet = build_packet(att, ref, att, corner, None, None)
    provs = [p for p in default_providers() if p.available and args.provider in (None, p.name)]
    if not provs:
        print("No provider configured (NEMOTRON_BASE_URL / NVIDIA_API_KEY / OPENROUTER_API_KEY). Nothing to do.")
        return
    configs = [("think@512", "think", "tools", 512), ("think@256", "think", "tools", 256),
               ("fast", "fast", "tools", None), ("think@256 json", "think", "json", 256)]
    for prov in provs:
        print(f"\n== {prov.name} ({prov.model}) ==")
        print(f"{'config':<16}{'first_ms':>9}{'total_ms':>9}{'reason_chars':>13}{'valid':>7}  errors")
        for label, mode, transport, tt in configs:
            rows = [await one(prov, packet, mode, transport, tt) for _ in range(args.n)]
            for r in rows:
                f = "-" if r["first_ms"] is None else f"{r['first_ms']:.0f}"
                print(f"{label:<16}{f:>9}{r['total_ms']:>9.0f}{r['reasoning_len']:>13}"
                      f"{str(r['valid']):>7}  {r['err']}")
            tot = [r["total_ms"] for r in rows if r["total_ms"] is not None]
            first = [r["first_ms"] for r in rows if r["first_ms"] is not None]
            print(f"  {label}: valid {sum(r['valid'] for r in rows)}/{len(rows)}  "
                  f"total p50 {statistics.median(tot):.0f} p95 {pct(tot, .95):.0f}"
                  + (f"  first p50 {statistics.median(first):.0f} p95 {pct(first, .95):.0f}" if first else ""))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--n", type=int, default=5, help="calls per config (default 5)")
    ap.add_argument("--provider", choices=["brev", "nvidia", "openrouter"], default=None)
    args = ap.parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
