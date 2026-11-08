"""Demo: uv run python -m engine.demo fixtures/attempts/late_brake.json [--retry fixtures/attempts/retry_hit.json]"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from . import ladder
from .config import load_attempt, load_corner
from .evidence import build_packet
from .models import DrillState
from .nemotron import default_providers

ROOT = Path(__file__).resolve().parent.parent


def _show(decision, rungs) -> None:
    print("\n--- decision ---")
    print(json.dumps(decision.to_dict(), indent=2))
    print("--- rungs ---")
    for r in rungs:
        print(" ", r)


async def _run(args: argparse.Namespace) -> None:
    corner = load_corner(args.corner)
    reference = load_attempt(args.reference)
    baseline = load_attempt(args.attempt)
    providers = default_providers(transport=args.transport)
    if not any(p.available for p in providers):
        print("No provider configured (NEMOTRON_BASE_URL / NVIDIA_API_KEY / OPENROUTER_API_KEY): falling back to rules.")

    def on_reasoning(t: str) -> None:
        sys.stdout.write(t)
        sys.stdout.flush()

    packet = build_packet(baseline, reference, baseline if baseline.valid else None, corner, None, None)
    print("packet:", json.dumps(packet, separators=(",", ":")))
    print("\n[thinking]")
    decision, rungs = await ladder.decide(packet, providers, on_reasoning=on_reasoning)
    _show(decision, rungs)
    if args.retry:
        if decision.action != "offer_drill":
            print("\nBaseline did not offer a drill; skipping retry.")
            return
        retry = load_attempt(args.retry)
        ds = DrillState(decision.drill_id, dict(decision.target), tries=1)
        packet = build_packet(retry, reference, baseline, corner, ds, baseline)
        print("\npacket:", json.dumps(packet, separators=(",", ":")))
        print("\n[thinking]")
        decision, rungs = await ladder.decide(packet, providers, on_reasoning=on_reasoning)
        _show(decision, rungs)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("attempt", help="baseline attempt JSON")
    ap.add_argument("--retry", help="retry attempt JSON (scored against the offered drill)")
    ap.add_argument("--corner", default=str(ROOT / "fixtures" / "corner_monza_t1.json"))
    ap.add_argument("--reference", default=str(ROOT / "fixtures" / "reference.json"))
    ap.add_argument("--transport", choices=["tools", "json"], default=None)
    args = ap.parse_args()
    try:
        import truststore
        truststore.inject_into_ssl()
    except ImportError:
        pass
    asyncio.run(_run(args))


if __name__ == "__main__":
    main()
