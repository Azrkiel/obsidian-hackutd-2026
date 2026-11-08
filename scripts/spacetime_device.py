"""Enroll a local runtime identity, report access, or export cloud history.

Only public enrollment values are printed. This helper never logs into an
administrator account, publishes a module, or grants itself database access.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
import uuid
from dataclasses import replace
from pathlib import Path

import aiohttp

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from coach.cloud_config import (CloudConfig, CloudConfigError, load_config, profile_path,
                                read_profile, save_profile, validate_database, validate_url)
from coach.cloud_credentials import CloudCredentialError, CredentialStore


async def _identity_response(response) -> dict:
    if response.status != 200:
        raise CloudConfigError("The cloud server could not issue a device identity.")
    try:
        body = bytearray()
        async for chunk in response.content.iter_chunked(4096):
            body.extend(chunk)
            if len(body) > 32768:
                raise ValueError
        value = json.loads(body)
        if not isinstance(value, dict) or not isinstance(value.get("identity"), str) or not isinstance(value.get("token"), str):
            raise ValueError
        return value
    except (ValueError, UnicodeError):
        raise CloudConfigError("The cloud server returned an invalid identity response.") from None


async def verify_identity(config: CloudConfig, session=None) -> None:
    if not config.identity:
        raise CloudConfigError("Device public identity is missing; complete setup first.")
    own = session is None
    session = session or aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5))
    try:
        async with session.get(f"{config.url}/v1/identity/{config.identity}/verify",
                               headers={"Authorization": f"Bearer {config.token}"}, allow_redirects=False) as response:
            if response.status != 204:
                raise CloudConfigError("The stored device credential could not be verified.")
    except (aiohttp.ClientError, asyncio.TimeoutError):
        raise CloudConfigError("Unable to reach the cloud server to verify this device.") from None
    finally:
        if own:
            await session.close()


async def setup_device(data_dir: str | Path, server: str, database: str, label: str,
                       *, store=None, session=None, replace_identity: bool = False) -> CloudConfig:
    server, database = validate_url(server), validate_database(database)
    store = store or CredentialStore()
    previous = read_profile(data_dir)
    if previous is not None and not replace_identity:
        if previous.get("url", "").rstrip("/") != server or previous.get("database") != database:
            raise CloudConfigError("The existing profile targets another database; use a separate data directory or explicit --replace.")
        if not previous.get("enabled", True):
            raise CloudConfigError("The existing cloud profile is disabled; enable it before repeating setup.")
        config = load_config(data_dir, environ={}, store=store)
        await verify_identity(config, session=session)
        return config
    # Validate the label before requesting or storing a new secret.
    if not isinstance(label, str) or not label or len(label) > 80 or any(ord(c) < 32 for c in label):
        raise CloudConfigError("Device label must contain 1 to 80 printable characters.")
    own = session is None
    session = session or aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5))
    try:
        async with session.post(f"{server}/v1/identity", allow_redirects=False) as response:
            issued = await _identity_response(response)
        config = CloudConfig(server, database, issued["token"], issued["identity"],
                             str(uuid.uuid4()), label)
        await verify_identity(config, session=session)
        store.set_token(config.url, config.database, config.identity, config.token)
        try:
            if previous is not None:
                archive = profile_path(data_dir).with_name(f"config.previous.{uuid.uuid4().hex}.json")
                archive.write_text(json.dumps(previous, indent=2) + "\n", encoding="utf-8")
            save_profile(data_dir, config)
        except Exception:
            try:
                store.delete_token(config.url, config.database, config.identity)
            except Exception:
                pass
            raise
        return config
    except (aiohttp.ClientError, asyncio.TimeoutError):
        raise CloudConfigError("Unable to reach the cloud server for device setup.") from None
    finally:
        if own:
            await session.close()


async def status_device(data_dir: str | Path, config: CloudConfig, *, client=None) -> dict:
    if config.identity:
        await verify_identity(config)
    own = client is None
    if own:
        from coach.cloud_client import CloudClient
        client = CloudClient(config)
    try:
        status = await client.device_status()
        if not isinstance(status, dict) or not isinstance(status.get("identity"), str):
            raise CloudConfigError("Cloud registration identity does not match this device profile.")
        identity = status["identity"].removeprefix("0x").lower()
        if config.identity and identity != config.identity:
            raise CloudConfigError("Cloud registration identity does not match this device profile.")
        if (config.device_id and status.get("device_id") != config.device_id) or status.get("role") not in ("admin", "writer", "viewer"):
            raise CloudConfigError("Cloud registration does not match this device profile.")
        verified = replace(config, identity=identity, device_id=status.get("device_id", ""),
                           role=status["role"], label=status.get("label", config.label))
        if not verified.device_id:
            raise CloudConfigError("Cloud registration does not include a device ID.")
        if not config.identity:
            await verify_identity(verified)
        # Environment-only use must not create a profile whose token is absent from the vault.
        existing = read_profile(data_dir)
        if existing and all(existing.get(key) == value for key, value in verified.binding.items()):
            save_profile(data_dir, verified)
        return {"status": "registered", "url": config.url, "database": config.database,
                "identity": verified.identity, "device_id": verified.device_id,
                "label": verified.label, "role": verified.role}
    finally:
        if own:
            await client.close()


def _page(page: dict) -> tuple[list, str | None]:
    if not isinstance(page, dict) or not isinstance(page.get("items"), list):
        raise CloudConfigError("Invalid cloud history page.")
    cursor = page.get("next_cursor")
    if cursor is not None and not isinstance(cursor, str):
        raise CloudConfigError("Invalid cloud history pagination.")
    return page["items"], cursor


def _next_cursor(cursor: str | None, seen: set[str]) -> bool:
    if cursor is None:
        return False
    if cursor in seen or len(seen) >= 100000:
        raise CloudConfigError("Cloud history pagination did not advance.")
    seen.add(cursor)
    return True


async def export_history(client, destination: str | Path) -> None:
    """Stream all pages, replacing a backup only after a fully successful export."""
    destination = Path(destination)
    temporary = destination.with_name(f"{destination.name}.{uuid.uuid4().hex}.tmp")
    try:
        destination.parent.mkdir(parents=True, exist_ok=True)
        with temporary.open("w", encoding="utf-8", newline="\n") as stream:
            stream.write('{"schema_version":1,"exported_at":')
            stream.write(json.dumps(time.time()))
            stream.write(',"sessions":[')
            cursor, seen, first_session = None, set(), True
            while True:
                sessions, next_cursor = _page(await client.list_sessions(limit=50, cursor=cursor))
                for session in sessions:
                    if not isinstance(session, dict) or not isinstance(session.get("session_id"), str):
                        raise CloudConfigError("Invalid cloud history session.")
                    if not first_session:
                        stream.write(",")
                    first_session = False
                    stream.write('{"session":' + json.dumps(session, allow_nan=False))
                    for kind in ("laps", "attempts", "decisions"):
                        stream.write("," + json.dumps(kind) + ":[")
                        child_cursor, child_seen, first_child = None, set(), True
                        while True:
                            items, child_next = _page(await client.get_session(
                                session["session_id"], kind=kind, limit=100, cursor=child_cursor))
                            for item in items:
                                if not first_child:
                                    stream.write(",")
                                first_child = False
                                stream.write(json.dumps(item, allow_nan=False))
                            if not _next_cursor(child_next, child_seen):
                                break
                            child_cursor = child_next
                        stream.write("]")
                    stream.write("}")
                if not _next_cursor(next_cursor, seen):
                    break
                cursor = next_cursor
            stream.write("]}\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, destination)
    finally:
        try:
            temporary.unlink(missing_ok=True)
        except OSError:
            pass


def parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="command", required=True)
    setup = sub.add_parser("setup", help="Issue and securely store a runtime credential.")
    setup.add_argument("--server", default=None)
    setup.add_argument("--database", default=None)
    setup.add_argument("--label", default="game-pc")
    setup.add_argument("--replace", action="store_true", help="Replace the profile identity, preserving pending uploads and an archived public profile.")
    setup.add_argument("--data-dir", type=Path, default=ROOT / "data")
    status = sub.add_parser("status", help="Verify credentials and registered role.")
    status.add_argument("--data-dir", type=Path, default=ROOT / "data")
    export = sub.add_parser("export", help="Export every authorized cloud history page.")
    export.add_argument("--data-dir", type=Path, default=ROOT / "data")
    export.add_argument("--output", type=Path, default=ROOT / "data" / "cloud" / "exports" / "history.json")
    return ap


async def run(args: argparse.Namespace) -> dict:
    if args.command == "setup":
        server = args.server or input("SpacetimeDB server [https://maincloud.spacetimedb.com]: ").strip() or "https://maincloud.spacetimedb.com"
        database = args.database or input("Published database name or identity: ").strip()
        config = await setup_device(args.data_dir, server, database, args.label, replace_identity=args.replace)
        return {"status": "profile_saved", "database": config.database, "url": config.url,
                "identity": config.identity, "device_id": config.device_id, "label": config.label,
                "next": "Ask the database administrator to register this public identity and device ID as writer or viewer, then run status."}
    config = load_config(args.data_dir)
    if config is None:
        raise CloudConfigError("Cloud history is not configured or is disabled; run setup first.")
    if args.command == "status":
        return await status_device(args.data_dir, config)
    from coach.cloud_client import CloudClient
    client = CloudClient(config)
    try:
        await export_history(client, args.output)
    finally:
        await client.close()
    return {"status": "exported", "path": str(args.output.resolve())}


def main() -> None:
    args = parser().parse_args()
    try:
        import truststore
        truststore.inject_into_ssl()
    except ImportError:
        pass
    try:
        result = asyncio.run(run(args))
    except (CloudConfigError, CloudCredentialError) as error:
        print(f"Cloud setup: {error}", file=sys.stderr)
        raise SystemExit(1) from None
    except KeyboardInterrupt:
        raise SystemExit(130) from None
    except Exception:
        # Client/backend exceptions can contain credentials; expose only a known category.
        print("Cloud operation failed. Check network access, device registration and profile settings.", file=sys.stderr)
        raise SystemExit(1) from None
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
