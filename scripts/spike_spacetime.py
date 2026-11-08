"""Verify a registered device against a real SpacetimeDB database.

By default, writes one clearly labelled simulator session, repeats a result write,
and reads back each result kind. --verify-only performs authorized reads only.
No credential value is printed. The database module must already be published.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from dataclasses import replace
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from coach.cloud_client import CloudClient, CloudError
from coach.cloud_config import CloudConfigError, load_config
from coach.cloud_records import RecordProjector


async def probe(config, *, verify_only: bool = False, client_factory=CloudClient) -> dict:
    client = client_factory(config)
    try:
        membership = await client.device_status()
        if (not isinstance(membership, dict) or membership.get("role") not in ("admin", "writer", "viewer") or
                not membership.get("identity") or not membership.get("device_id")):
            raise CloudError("auth")
        if ((config.identity and config.identity != membership["identity"]) or
                (config.device_id and config.device_id != membership["device_id"])):
            raise CloudError("auth")
        verified = replace(config, identity=membership["identity"], device_id=membership["device_id"],
                           role=membership["role"], label=membership.get("label") or config.label)
        client.config = verified
        if verify_only:
            page = await client.list_sessions(limit=1)
            if not isinstance(page, dict) or not isinstance(page.get("items"), list):
                raise CloudError("response")
            if page["items"]:
                sid = page["items"][0].get("session_id")
                if not sid:
                    raise CloudError("response")
                await client.get_session(sid, kind="laps", limit=1)
            return {"mode": "read-only", "role": verified.role, "sessions_seen": len(page["items"])}
        if verified.role not in ("admin", "writer"):
            raise CloudError("auth")

        projector = RecordProjector("sim", "lap", "SpacetimeDB connection test", "test-only")
        entries = [projector.session_record()]
        entries += projector.capture({"type": "run", "role": "baseline", "corner_id": "test-corner",
            "attempt": {"attempt_id": "probe-attempt", "valid": True, "invalid_reason": None,
                        "entry_kmh": 100.0, "apex_kmh": 80.0, "exit_kmh": 110.0,
                        "brake_onset_m": 100.0, "peak_brake": .8, "throttle_pickup_m": 150.0,
                        "section_s": 4.0}})
        entries += projector.capture({"type": "decision", "decision_id": "probe-decision",
            "attempt_id": "probe-attempt", "corner_id": "test-corner", "action": "end_drill",
            "end_reason": "within_tolerance", "summary": "Connection test only.", "mode": "rules",
            "provider": None, "model": None, "latency_ms": 0.0})
        entries += projector.capture({"type": "track_lap", "lap": 1, "valid": True,
            "invalid_reason": None, "lap_time_s": 90.0, "delta_s": 0.0, "corners": []})
        entries.append(projector.end())
        for entry in entries:
            await client.record(entry["kind"], entry["record"])
        attempt = next(entry for entry in entries if entry["kind"] == "attempt")
        await client.record("attempt", attempt["record"])

        counts = {}
        for kind, singular in (("laps", "lap"), ("attempts", "attempt"), ("decisions", "decision")):
            page = await client.get_session(projector.session_id, kind=kind, limit=100)
            expected = {e["record"]["record_id"] for e in entries if e["kind"] == singular}
            if (not isinstance(page, dict) or not isinstance(page.get("items"), list) or
                    {row.get("record_id") for row in page["items"]} != expected or
                    len(page["items"]) != len(expected) or page.get("next_cursor") is not None or
                    page.get("session", {}).get("session_id") != projector.session_id or
                    page.get("session", {}).get("payload", {}).get("status") != "closed"):
                raise CloudError("response")
            counts[kind] = len(page["items"])
        return {"mode": "write-read", "role": verified.role, "session_id": projector.session_id,
                "counts": counts, "duplicate_safe": True}
    finally:
        await client.close()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=ROOT / "data")
    parser.add_argument("--verify-only", action="store_true", help="read history without creating a test session")
    return parser


async def amain(args) -> int:
    try:
        config = load_config(args.data_dir)
        if config is None:
            print("Cloud history is not configured. Complete device setup first.", file=sys.stderr)
            return 2
        result = await probe(config, verify_only=args.verify_only)
    except (CloudError, CloudConfigError) as exc:
        print(str(exc), file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2))
    return 0


def main() -> None:
    try:
        import truststore
        truststore.inject_into_ssl()
    except ImportError:
        pass
    try:
        raise SystemExit(asyncio.run(amain(build_parser().parse_args())))
    except KeyboardInterrupt:
        raise SystemExit(130) from None


if __name__ == "__main__":
    main()
