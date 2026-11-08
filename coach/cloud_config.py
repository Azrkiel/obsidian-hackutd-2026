"""Immutable cloud targets and non-secret local profile storage."""
from __future__ import annotations

import ipaddress
import json
import os
import re
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Mapping
from urllib.parse import urlsplit

from .cloud_credentials import CloudCredentialError, CredentialStore

MAX_PROFILE_BYTES = 16 * 1024
_TARGET_ENV = ("SPACETIMEDB_URL", "SPACETIMEDB_DATABASE", "SPACETIMEDB_TOKEN")
_PROFILE_FIELDS = {"schema_version", "url", "database", "identity", "device_id", "label", "enabled", "role"}


class CloudConfigError(Exception):
    """A redacted configuration error suitable for local status output."""


def validate_url(value: str) -> str:
    if not isinstance(value, str) or not value or len(value) > 2048 or any(c.isspace() for c in value):
        raise CloudConfigError("Invalid cloud server URL.")
    try:
        parsed = urlsplit(value)
        port = parsed.port
        host = parsed.hostname
        if not host or parsed.username is not None or parsed.password is not None:
            raise ValueError
        # "?" / "#" with nothing after still parse as empty query/fragment, so check the raw text too.
        if "?" in value or "#" in value or parsed.path not in ("", "/"):
            raise ValueError
        if parsed.scheme not in ("https", "http") or port == 0:
            raise ValueError
        if parsed.scheme == "http":
            try:
                local = ipaddress.ip_address(host).is_loopback
            except ValueError:
                local = host.lower() == "localhost"
            if not local:
                raise ValueError
    except (ValueError, TypeError):
        raise CloudConfigError("Cloud server must use HTTPS, or HTTP on a loopback address, without credentials, paths or query parameters.") from None
    return value.rstrip("/")


def validate_database(value: str) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}", value):
        raise CloudConfigError("Invalid cloud database name or identity.")
    return value


def _identity(value: str, *, allow_empty: bool = False) -> str:
    if value == "" and allow_empty:
        return ""
    if not isinstance(value, str) or not re.fullmatch(r"(?:0x)?[0-9a-fA-F]{64}", value):
        raise CloudConfigError("Invalid public cloud identity; rerun device setup.")
    return value.removeprefix("0x").lower()


def _public_text(value: str, name: str, max_length: int, *, allow_empty=False) -> str:
    if not isinstance(value, str) or len(value) > max_length or any(ord(c) < 32 for c in value) or (not value and not allow_empty):
        raise CloudConfigError(f"Invalid cloud {name}.")
    return value


@dataclass(frozen=True)
class CloudConfig:
    url: str
    database: str
    token: str = field(repr=False)
    identity: str = ""
    device_id: str = ""
    label: str = "environment"
    enabled: bool = True
    role: str = "unknown"

    def __post_init__(self):
        object.__setattr__(self, "url", validate_url(self.url))
        validate_database(self.database)
        if not isinstance(self.token, str) or not self.token or len(self.token) > 16384 or any(c.isspace() for c in self.token):
            raise CloudConfigError("Missing or invalid cloud credential.")
        object.__setattr__(self, "identity", _identity(self.identity, allow_empty=True))
        _public_text(self.device_id, "device ID", 128, allow_empty=True)
        _public_text(self.label, "device label", 80)
        if type(self.enabled) is not bool or self.role not in ("unknown", "admin", "writer", "viewer"):
            raise CloudConfigError("Invalid cloud profile settings.")

    @property
    def binding(self) -> dict[str, str]:
        return {"url": self.url, "database": self.database, "identity": self.identity}


def profile_path(data_dir: str | Path) -> Path:
    return Path(data_dir) / "cloud" / "config.json"


def read_profile(data_dir: str | Path) -> dict | None:
    path = profile_path(data_dir)
    try:
        if not path.exists():
            return None
        if path.stat().st_size > MAX_PROFILE_BYTES:
            raise CloudConfigError("Cloud profile is too large.")
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, ValueError):
        raise CloudConfigError("Unable to read cloud profile; check device setup.") from None
    if not isinstance(raw, dict) or set(raw) - _PROFILE_FIELDS:
        raise CloudConfigError("Cloud profile contains unsupported fields; credentials must stay in the credential store.")
    if raw.get("schema_version", 1) != 1 or type(raw.get("enabled", True)) is not bool:
        raise CloudConfigError("Unsupported cloud profile version or settings.")
    return raw


def load_config(data_dir: str | Path = "data", environ: Mapping[str, str] | None = None,
                store=None) -> CloudConfig | None:
    env = os.environ if environ is None else environ
    present = [name in env for name in _TARGET_ENV]
    if any(present):
        if not all(present) or not all(env[name] for name in _TARGET_ENV):
            raise CloudConfigError("Set SPACETIMEDB_URL, SPACETIMEDB_DATABASE and SPACETIMEDB_TOKEN together.")
        return CloudConfig(env[_TARGET_ENV[0]], env[_TARGET_ENV[1]], env[_TARGET_ENV[2]],
                           env.get("SPACETIMEDB_IDENTITY", ""), env.get("SPACETIMEDB_DEVICE_ID", ""),
                           env.get("SPACETIMEDB_LABEL", "environment"))
    raw = read_profile(data_dir)
    if raw is None or not raw.get("enabled", True):
        return None
    required = ("url", "database", "identity", "device_id", "label")
    if any(not isinstance(raw.get(name), str) or not raw[name] for name in required):
        raise CloudConfigError("Cloud profile is incomplete; rerun device setup.")
    url, database, identity = validate_url(raw["url"]), validate_database(raw["database"]), _identity(raw["identity"])
    try:
        token = (store or CredentialStore()).get_token(url, database, identity)
    except CloudCredentialError:
        raise CloudConfigError("Cloud credential store is unavailable; check the cloud installation.") from None
    if not token:
        raise CloudConfigError("Cloud credential is missing; recover or replace this device identity.")
    return CloudConfig(url, database, token, identity, raw["device_id"], raw["label"],
                       raw.get("enabled", True), raw.get("role", "unknown"))


def save_profile(data_dir: str | Path, config: CloudConfig) -> None:
    if not config.identity or not config.device_id:
        raise CloudConfigError("Verified public identity and device ID are required to save a profile.")
    body = {"schema_version": 1, **config.binding, "device_id": config.device_id,
            "label": config.label, "enabled": config.enabled, "role": config.role}
    path = profile_path(data_dir)
    temporary = path.with_name(f"config.{uuid.uuid4().hex}.tmp")
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with temporary.open("w", encoding="utf-8", newline="\n") as stream:
            json.dump(body, stream, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    except OSError:
        raise CloudConfigError("Unable to save the cloud profile.") from None
    finally:
        temporary.unlink(missing_ok=True)
