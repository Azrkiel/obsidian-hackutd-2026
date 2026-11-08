"""Stop the Brev GPU instance when the vLLM server has been idle.

Runs on your own machine (not the GPU box). Every --poll-s seconds it reads vLLM's
Prometheus /metrics; any running or queued request, or any change in the request/token
counters, counts as activity. After --idle-min minutes with no activity it runs
`brev stop <instance>` and exits. Use only on a stoppable offer (e.g. Nebius); Brev's
"No stop/start" offers can only be deleted, which this script never does.

While the instance is stopped the engine falls back to build.nvidia.com on its own.
Bring it back with `brev start <instance>`, then restart the watchdog.

Holds (never stop): before --hold-until, or while the --hold-file exists
(`touch .brev-hold` before judging, delete it after).

Usage:
  NEMOTRON_BASE_URL=http://<brev-host>:8000/v1 \\
    uv run python scripts/brev_idle_stop.py --instance nomadsim-h100 [--idle-min 30]
Needs the brev CLI logged in (`brev login`, or BREV_API_KEY with write access).
"""
from __future__ import annotations

import argparse
import datetime as dt
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

GAUGES = ("vllm:num_requests_running", "vllm:num_requests_waiting")
COUNTERS = ("vllm:request_success_total", "vllm:prompt_tokens_total",
            "vllm:generation_tokens_total")
_LINE = re.compile(r"^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+(\S+)")


def parse_metrics(text: str) -> dict[str, float]:
    """Sum each watched metric over all its label sets. Missing metrics are absent."""
    out: dict[str, float] = {}
    for line in text.splitlines():
        if not line or line.startswith("#"):
            continue
        m = _LINE.match(line)
        if not m or m.group(1) not in GAUGES + COUNTERS:
            continue
        try:
            out[m.group(1)] = out.get(m.group(1), 0.0) + float(m.group(3))
        except ValueError:
            continue
    return out


@dataclass
class IdleTracker:
    """Tracks seconds since the last observed activity."""
    last_active: float
    last_counters: dict[str, float] | None = None
    reachable: bool = False
    notes: list[str] = field(default_factory=list)

    def observe(self, snap: dict[str, float] | None, now: float) -> float:
        """snap=None means /metrics was unreachable (no activity seen). Returns idle seconds."""
        self.reachable = snap is not None
        if snap is not None:
            busy = any(snap.get(g, 0.0) > 0 for g in GAUGES)
            counters = {c: snap[c] for c in COUNTERS if c in snap}
            changed = self.last_counters is not None and counters != self.last_counters
            if busy or changed:
                self.last_active = now
            self.last_counters = counters
        return now - self.last_active


def parse_hold_until(s: str | None, now: dt.datetime) -> dt.datetime | None:
    """'HH:MM' (today, local; tomorrow if already past) or an ISO datetime."""
    if not s:
        return None
    if re.fullmatch(r"\d{1,2}:\d{2}", s):
        h, m = map(int, s.split(":"))
        t = now.replace(hour=h, minute=m, second=0, microsecond=0)
        return t if t > now else t + dt.timedelta(days=1)
    return dt.datetime.fromisoformat(s)


def hold_reason(now: dt.datetime, hold_until: dt.datetime | None, hold_file: Path) -> str | None:
    if hold_file.exists():
        return f"hold file {hold_file} exists"
    if hold_until is not None and now < hold_until:
        return f"held until {hold_until:%Y-%m-%d %H:%M}"
    return None


def metrics_url(base_url: str) -> str:
    """http://host:8000/v1 -> http://host:8000/metrics"""
    u = base_url.rstrip("/")
    if u.endswith("/v1"):
        u = u[:-3]
    return u + "/metrics"


def fetch_metrics(url: str, api_key: str | None, timeout: float = 10.0) -> dict[str, float] | None:
    req = urllib.request.Request(url)
    if api_key:  # vLLM only guards /v1 with --api-key; harmless here
        req.add_header("Authorization", f"Bearer {api_key}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return parse_metrics(r.read().decode("utf-8", "replace"))
    except (urllib.error.URLError, OSError, ValueError):
        return None


def brev_stop(brev_bin: str, instance: str, dry_run: bool) -> bool:
    cmd = [brev_bin, "stop", instance]
    if dry_run:
        log(f"[dry-run] would run: {' '.join(cmd)}")
        return True
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    except (OSError, subprocess.TimeoutExpired) as e:
        log(f"brev stop failed: {e!r}")
        return False
    log((p.stdout + p.stderr).strip() or f"brev stop exited {p.returncode}")
    return p.returncode == 0


def log(msg: str) -> None:
    print(f"{dt.datetime.now():%H:%M:%S} {msg}", flush=True)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--instance", required=True, help="Brev instance name (see `brev ls`)")
    ap.add_argument("--base-url", default=os.environ.get("NEMOTRON_BASE_URL"),
                    help="vLLM base URL, default $NEMOTRON_BASE_URL")
    ap.add_argument("--idle-min", type=float, default=30.0, help="minutes idle before stopping (30)")
    ap.add_argument("--poll-s", type=float, default=60.0, help="seconds between checks (60)")
    ap.add_argument("--hold-until", help="never stop before this time: HH:MM local, or ISO datetime")
    ap.add_argument("--hold-file", default=str(ROOT / ".brev-hold"),
                    help="never stop while this file exists (default .brev-hold in the repo)")
    ap.add_argument("--brev-bin", default="brev", help="brev CLI command (e.g. a WSL wrapper)")
    ap.add_argument("--dry-run", action="store_true", help="log instead of running brev stop")
    args = ap.parse_args(argv)

    if not args.base_url:
        ap.error("set --base-url or NEMOTRON_BASE_URL")
    if not args.dry_run and shutil.which(args.brev_bin) is None:
        ap.error(f"brev CLI not found ({args.brev_bin}); install it or pass --brev-bin")
    try:
        import truststore  # TLS interception on some machines; only matters for https URLs
        truststore.inject_into_ssl()
    except ImportError:
        pass

    url = metrics_url(args.base_url)
    hold_until = parse_hold_until(args.hold_until, dt.datetime.now())
    hold_file = Path(args.hold_file)
    limit_s = args.idle_min * 60
    tracker = IdleTracker(last_active=time.monotonic())
    log(f"watching {url}; stop {args.instance} after {args.idle_min:g} min idle"
        + (f"; held until {hold_until:%Y-%m-%d %H:%M}" if hold_until else ""))

    while True:
        snap = fetch_metrics(url, os.environ.get("NEMOTRON_API_KEY"))
        idle_s = tracker.observe(snap, time.monotonic())
        held = hold_reason(dt.datetime.now(), hold_until, hold_file)
        state = "reachable" if snap is not None else "UNREACHABLE"
        log(f"{state}, idle {idle_s / 60:.1f}/{args.idle_min:g} min" + (f" ({held})" if held else ""))
        if idle_s >= limit_s and not held:
            log(f"idle limit reached: stopping {args.instance}")
            if brev_stop(args.brev_bin, args.instance, args.dry_run):
                log(f"stopped. Restart with: brev start {args.instance}")
                return 0
            log("stop failed; retrying next poll")
        time.sleep(args.poll_s)


if __name__ == "__main__":
    sys.exit(main())
