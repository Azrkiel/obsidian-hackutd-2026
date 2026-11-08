"""Dashboard live telemetry: rpm from AC shared memory and the ~10 Hz "live" message."""
import json

import pytest
from aiohttp.test_utils import TestClient, TestServer

from coach.app import CoachApp, live_event
from coach.dashboard import make_web_app
from coach.telemetry import Sample, SimSource, SPageFileGraphic, SPageFilePhysics, parse_sample


def _sample(pos_m, **kw):
    base = dict(t=1.0, packet_id=1, status="live", pos_norm=pos_m / 5793, pos_m=pos_m, speed_kmh=212.34,
                gas=0.0, brake=0.8123, steer=-0.25, x=0.0, y=0.0, z=0.0, gear=3, rpm=7400)
    return Sample(**{**base, **kw})


def test_parse_sample_reads_rpm():
    phys, gfx = SPageFilePhysics(), SPageFileGraphic()
    phys.rpms, phys.gear, gfx.status = 8123, 4, 2
    s = parse_sample(phys, gfx, 1000.0)
    assert s.rpm == 8123 and s.gear == 3


def test_old_recordings_have_no_rpm():
    old = {k: v for k, v in vars(_sample(10.0)).items() if k != "rpm"}
    assert Sample(**json.loads(json.dumps(old))).rpm is None


def test_live_event_fields_and_corner(corner):
    inside = (corner.start_gate_m + corner.exit_gate_m) / 2
    e = live_event(_sample(inside), max_rpm=9000, corners=[corner], track="monza", car="ks_mazda_787b")
    assert e["type"] == "live" and e["corner"] == corner.name
    assert (e["speed_kmh"], e["brake"], e["gear"], e["rpm"], e["max_rpm"]) == (212.3, 0.812, 3, 7400, 9000)
    assert (e["track"], e["car"], e["lap"], e["source"]) == ("monza", "ks_mazda_787b", None, "sim")
    assert live_event(_sample(corner.exit_gate_m + 50), max_rpm=0, corners=[corner])["corner"] is None
    assert live_event(_sample(inside, rpm=None), max_rpm=0, corners=[corner])["max_rpm"] is None


async def test_live_messages_reach_dashboard_but_not_event_log(corner, ref, tmp_path):
    app = CoachApp(corner, ref, SimSource(corner, realtime=False), [], reset_mode="sim",
                   data_dir=tmp_path / "d", trace_dir=tmp_path / "t", sound=False, countdown=0,
                   persist_checkpoint=False)
    client = TestClient(TestServer(make_web_app(app)))
    await client.start_server()
    await app.start()
    try:
        ws = await client.ws_connect("/ws")
        assert json.loads((await ws.receive()).data)["type"] == "snapshot"
        live = None
        for _ in range(200):
            msg = json.loads((await ws.receive(timeout=5)).data)
            if msg["type"] == "live":
                live = msg
                break
        assert live is not None and live["rpm"] is None and "speed_kmh" in live  # the simulator has no rpm
        assert not any(e["type"] == "live" for e in app.events)
        for path in ("/pitpal/fonts/PitPalBubble.woff2", "/pitpal/stealth-racer.png", "/pitpal/pattern-checker.svg"):
            assert (await client.get(path)).status == 200, path
        await ws.close()
    finally:
        await app.stop()
        await client.close()
