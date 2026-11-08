"""Provider-free dashboard for browser integration tests."""

import asyncio
import tempfile
from pathlib import Path

from coach.app import CoachApp
from coach.dashboard import Dashboard
from coach.telemetry import SimSource
from engine.config import load_attempt, load_corner


async def main():
    root = Path(__file__).resolve().parent.parent
    data = Path(tempfile.mkdtemp(prefix="nomadsim-history-ui-"))
    corner = load_corner(root / "fixtures/corner_monza_t1.json")
    app = CoachApp(
        corner,
        load_attempt(root / "fixtures/reference.json"),
        SimSource(corner, realtime=False),
        [],
        history=True,
        data_dir=data,
        trace_dir=data / "traces",
        persist_checkpoint=False,
    )
    dash = Dashboard(app, "127.0.0.1", 8097)
    await dash.start()
    await app.start()
    try:
        await asyncio.Event().wait()
    finally:
        await app.stop()
        await dash.stop()


if __name__ == "__main__":
    asyncio.run(main())
