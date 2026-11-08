"""History-only local viewer: uv run --extra cloud python -m coach.history."""
from __future__ import annotations

import argparse
import ipaddress
from pathlib import Path

from aiohttp import web

from .cloud_config import CloudConfigError, load_config
from .cloud_history import HistoryService
from .history_routes import make_history_app

ROOT = Path(__file__).resolve().parent.parent


def build_app(data_dir=ROOT / "data", *, environ=None):
    config, error = None, None
    try:
        config = load_config(data_dir, environ=environ)
    except CloudConfigError:
        error = "Cloud profile needs attention."
    return make_history_app(HistoryService(config, data_dir, config_error=error))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", default=str(ROOT / "data"))
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8020)
    args = parser.parse_args()
    try:
        local = args.host == "localhost" or ipaddress.ip_address(args.host).is_loopback
    except ValueError:
        local = False
    if not local:
        parser.error("The history viewer must listen on a loopback address.")
    if not 1 <= args.port <= 65535:
        parser.error("Port must be between 1 and 65535.")
    try:
        import truststore
        truststore.inject_into_ssl()
    except ImportError:
        pass
    try:
        web.run_app(build_app(args.data_dir), host=args.host, port=args.port)
    except OSError:
        parser.exit(1, f"Cannot start the history viewer on port {args.port}; close the other local server or choose --port.\n")


if __name__ == "__main__":
    main()
