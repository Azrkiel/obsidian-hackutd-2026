"""Write a whole-lap reference from the track simulator driving every corner at its ideal knobs.

Placeholder for sim demos and tests only. For the real game use
  python scripts/ac_track_extract.py <track folder> --track-ref-out data/track_reference.json
or press Set reference after a clean lap in the coach.

  uv run python scripts/track_sim_reference.py [--track fixtures/track_monza.json] [--out PATH]
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from dataclasses import asdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from coach.scorer import TrackScorer  # noqa: E402
from coach.telemetry import TrackSimSource  # noqa: E402
from engine.config import load_track  # noqa: E402


async def sim_lap(track, corners: dict | None = None) -> tuple[dict, float | None]:
    """Drive until one full lap is scored; return ({id: (attempt, trace)}, lap_time_s)."""
    src = TrackSimSource(track, realtime=False, corners=corners)
    out: dict = {}
    laps: list[dict] = []
    sc = TrackScorer(track, on_run=lambda cid, a, tr: None,
                     on_corners=lambda n, runs: out.update({n: runs}),
                     on_track_lap=laps.append)
    async for s in src.samples():
        sc.add(s)
        if 1 in out and laps and laps[-1]["lap"] == 1:
            src.stop()
    return out[1], laps[-1]["lap_time_s"]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--track", default=str(ROOT / "fixtures" / "track_monza.json"))
    ap.add_argument("--out", default=str(ROOT / "fixtures" / "track_monza_reference.json"))
    args = ap.parse_args(argv)
    track = load_track(args.track)
    runs, lap_time = asyncio.run(sim_lap(track))
    bad = [cid for cid, (a, _) in runs.items() if not a.valid]
    if bad or set(runs) != set(track.ids):
        print(f"error: corners missing or invalid: {bad or sorted(set(track.ids) - set(runs))}", file=sys.stderr)
        return 1
    corners = {}
    for cid, (a, trace) in runs.items():
        a.attempt_id = f"ref-{cid}"
        corners[cid] = {"attempt": asdict(a), "trace": trace}
    doc = {"source": "TrackSimSource ideal knobs (placeholder, not the real game)",
           "lap_time_s": lap_time, "corners": corners}
    Path(args.out).write_text(json.dumps(doc, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {args.out}: lap {lap_time} s, " + ", ".join(
        f"{cid} {runs[cid][0].section_s:.2f}s" for cid in track.ids))
    return 0


if __name__ == "__main__":
    sys.exit(main())
