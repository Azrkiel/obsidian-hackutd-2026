"""One command for the race PC: coach + dashboard + local race history, no hosting.

    uv run python scripts/rig.py              # Assetto Corsa (shared memory, CSP reset, phone/Arduino inputs)
    uv run python scripts/rig.py --sim        # try it without the game
    uv run python scripts/rig.py --lan        # phones on the same Wi-Fi can open the dashboard and viewer
    uv run python scripts/rig.py -- --agent --track fixtures/track_monza.json   # extra coach flags after --

What it does:
1. Starts a local SpacetimeDB server (127.0.0.1:3000, data in data/spacetime) if the SpacetimeDB CLI
   is installed (`spacetime` on PATH, SPACETIME_CLI, or --spacetime-cli). Without it, history is still
   saved in SQLite (data/history.sqlite3) and the dashboard says "Saved on this PC".
2. Publishes the race-history module once, from the committed build (cloud/spacetime/prebuilt), so the
   race PC needs no Node or npm.
3. Gets a coach identity from the local server once and keeps it in data/spacetime_local.json.
   The first coach to connect owns the database; keep that file with the data folder.
4. Starts the coach with --history, the Nemotron agent (--agent) and spoken coaching (--voice nvidia,
   Windows voice without an NVIDIA_API_KEY), then opens the dashboard. Nemotron needs an endpoint:
   NEMOTRON_BASE_URL (Brev/vLLM), NVIDIA_API_KEY or OPENROUTER_API_KEY; without one the rules coach answers.
Ctrl+C stops the coach and the server it started.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE = ROOT / "cloud" / "spacetime" / "prebuilt" / "history-module.js"
DB = "pitpal"


def find_cli(explicit: str | None) -> str | None:
    """Explicit path, then SPACETIME_CLI, then `spacetime` on PATH, then the installer's folder."""
    for c in (explicit, os.getenv("SPACETIME_CLI"), shutil.which("spacetime"),
              str(Path(os.getenv("LOCALAPPDATA", "~")).expanduser() / "SpacetimeDB" / "spacetime.exe")):
        if c and Path(c).is_file():
            return c
    return None


def lan_ip() -> str:
    """This PC's address on the local network (no packet is sent)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def http_ok(url: str, timeout: float = 1.0) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return r.status == 200
    except (urllib.error.URLError, OSError):
        return False


def coach_identity(server: str, cache: Path) -> str:
    """The coach's writer token for this server: reused from the cache file, else a new identity."""
    if cache.is_file():
        d = json.loads(cache.read_text(encoding="utf-8"))
        if d.get("server") == server and d.get("token"):
            return d["token"]
    req = urllib.request.Request(server + "/v1/identity", method="POST", data=b"")
    with urllib.request.urlopen(req, timeout=10) as r:
        d = json.loads(r.read())
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps({"server": server, "identity": d["identity"], "token": d["token"]}),
                     encoding="utf-8")
    return d["token"]


def coach_command(sim: bool, port: int, host: str, extra: list[str]) -> list[str]:
    """Nemotron agent and spoken coaching on by default. --voice nvidia uses NVIDIA's Magpie TTS when
    NVIDIA_API_KEY is set and falls back to the Windows voice per message otherwise. Flags after --
    come last, so `-- --voice off` or `-- --voice windows` override these."""
    game = ["--telemetry", "sim", "--reset", "sim"] if sim else ["--telemetry", "ac", "--reset", "udp", "--inputs"]
    return [sys.executable, "-m", "coach", *game, "--history", "--agent", "--voice", "nvidia",
            "--host", host, "--port", str(port), *extra]


def start_spacetime(cli: str, port: int, bind: str, data: Path) -> tuple[str, subprocess.Popen | None]:
    """Local server URL, and the process if this call started it (None if one was already running)."""
    server = f"http://127.0.0.1:{port}"
    proc = None
    if not http_ok(server + "/v1/ping"):
        data.mkdir(parents=True, exist_ok=True)
        log = open(data / "server.log", "ab")
        proc = subprocess.Popen([cli, "start", "--listen-addr", f"{bind}:{port}", "--data-dir", str(data),
                                 "--non-interactive"], stdout=log, stderr=subprocess.STDOUT)
        for _ in range(60):
            if http_ok(server + "/v1/ping"):
                break
            if proc.poll() is not None:
                raise SystemExit(f"SpacetimeDB server exited; see {data / 'server.log'}")
            time.sleep(0.5)
        else:
            proc.terminate()
            raise SystemExit(f"SpacetimeDB server did not start on {server}; see {data / 'server.log'}")
    if not http_ok(f"{server}/v1/database/{DB}", timeout=3):
        if not MODULE.is_file():
            raise SystemExit(f"missing {MODULE}: rebuild with `spacetime build --module-path cloud/spacetime`")
        subprocess.run([cli, "publish", DB, "--js-path", str(MODULE), "--server", server, "--anonymous",
                        "--yes"], check=True)
    return server, proc


def stop_tree(proc: subprocess.Popen) -> None:
    """Stop a process and its children (`spacetime start` runs spacetimedb-standalone as a child)."""
    if proc.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(["taskkill", "/T", "/F", "/PID", str(proc.pid)], capture_output=True)
    else:
        proc.terminate()
    try:
        proc.wait(10)
    except subprocess.TimeoutExpired:
        proc.kill()


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    extra = argv[argv.index("--") + 1:] if "--" in argv else []
    argv = argv[:argv.index("--")] if "--" in argv else argv
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--sim", action="store_true", help="simulated car instead of Assetto Corsa")
    ap.add_argument("--lan", action="store_true", help="let phones on this network open the pages")
    ap.add_argument("--port", type=int, default=8020, help="dashboard port")
    ap.add_argument("--spacetime-port", type=int, default=3000)
    ap.add_argument("--spacetime-cli", default=None, help="path to the SpacetimeDB CLI")
    ap.add_argument("--no-spacetime", action="store_true", help="SQLite history only")
    ap.add_argument("--no-browser", action="store_true")
    args = ap.parse_args(argv)

    data = ROOT / "data"
    env = dict(os.environ)
    bind = "0.0.0.0" if args.lan else "127.0.0.1"
    public = lan_ip() if args.lan else "127.0.0.1"
    st_proc = None
    cli = None if args.no_spacetime else find_cli(args.spacetime_cli)
    if cli:
        server, st_proc = start_spacetime(cli, args.spacetime_port, bind, data / "spacetime")
        env.update(SPACETIME_URL=f"http://{public}:{args.spacetime_port}", SPACETIME_DB=DB,
                   SPACETIME_TOKEN=coach_identity(server, data / "spacetime_local.json"))
        print(f"race history: local SpacetimeDB {env['SPACETIME_URL']} database {DB}", flush=True)
    else:
        print("race history: SQLite only (install the SpacetimeDB CLI for live viewers)", flush=True)
    if args.lan:
        env["HISTORY_PUBLIC_URL"] = f"http://{public}:{args.port}/history-viewer/"
    dash = f"http://{public}:{args.port}/"
    coach = subprocess.Popen(coach_command(args.sim, args.port, bind, extra), cwd=ROOT, env=env)
    try:
        for _ in range(40):
            if http_ok(f"http://127.0.0.1:{args.port}/state") or coach.poll() is not None:
                break
            time.sleep(0.5)
        if coach.poll() is None:
            print(f"dashboard: {dash}   viewer: {dash}history-viewer/", flush=True)
            if not args.no_browser:
                webbrowser.open(dash)
        return coach.wait()
    except KeyboardInterrupt:
        return 0
    finally:
        stop_tree(coach)
        if st_proc is not None:
            stop_tree(st_proc)


if __name__ == "__main__":
    raise SystemExit(main())
