import json

from aiohttp.test_utils import TestClient, TestServer

from coach.app import CoachApp
from coach.dashboard import make_web_app
from coach.telemetry import SimSource


async def make(corner, ref, tmp_path):
    app = CoachApp(corner, ref, SimSource(corner, realtime=False), [], reset_mode="sim",
                   data_dir=tmp_path / "d", trace_dir=tmp_path / "t", sound=False, countdown=0,
                   persist_checkpoint=False)
    client = TestClient(TestServer(make_web_app(app)))
    await client.start_server()
    return app, client


async def test_index_and_state(corner, ref, tmp_path):
    app, client = await make(corner, ref, tmp_path)
    try:
        r = await client.get("/")
        text = await r.text()
        assert r.status == 200 and "text/html" in r.headers["Content-Type"] and "Pit Pal" in text
        assert "http://" not in text and "https://" not in text.replace('"https:"', "")  # no CDN
        snap = await (await client.get("/state")).json()
        assert snap["type"] == "snapshot" and snap["state"] == "IDLE"
        assert snap["reference"]["attempt"]["attempt_id"] == "ref"
    finally:
        await client.close()


async def test_ws_snapshot_and_accept_reaches_app(corner, ref, tmp_path):
    app, client = await make(corner, ref, tmp_path)
    await app.start()
    try:
        ws = await client.ws_connect("/ws")
        first = json.loads((await ws.receive()).data)
        assert first["type"] == "snapshot" and first["corner"]["name"].startswith("Monza")
        await app.wait_for(lambda: app.coach.state == "OFFERED", 20)
        did = app.coach.offer.decision_id
        await ws.send_str(json.dumps({"type": "accept", "decision_id": did}))
        seen = set()
        while "reset_confirmed" not in seen:
            msg = await ws.receive(timeout=10)
            seen.add(json.loads(msg.data)["type"])
        assert {"decision", "reset_request"} <= seen or "reset_request" in seen
        await ws.send_str("not json")           # must not kill the socket
        await ws.send_str(json.dumps({"type": "toggle_cue_next"}))
        await app.wait_for(lambda: app.cue_next_off, 5)
        await ws.close()
    finally:
        await app.stop()
        await client.close()


async def test_settings_api(tmp_path):
    from coach.lap_sim import LapSim
    from coach.reference import References
    from coach.track import Track
    from engine.config import load_corner
    track = Track.load()
    refs = References(track, tmp_path / "pb.json")
    base = load_corner("fixtures/corner_monza_t1.json")
    app = CoachApp(base, refs.get("t1").as_attempt(), LapSim(track), [], reset_mode="sim",
                   data_dir=tmp_path / "d", trace_dir=tmp_path / "t", sound=False, countdown=0,
                   persist_checkpoint=False, track_model=track, references=refs, whole_lap=True)
    client = TestClient(TestServer(make_web_app(app)))
    await client.start_server()
    try:
        got = await (await client.get("/settings")).json()
        assert got["settings"]["countdown_s"] == 5.0 and got["limits"]["countdown_s"] == [3.0, 10.0]
        r = await client.post("/settings", json={"countdown_s": 6, "voice": False})
        assert r.status == 200 and (await r.json())["changed"] == ["countdown_s", "voice"]
        assert app.lap_coach.offers.countdown_s == 6
        r = await client.post("/settings", json={"countdown_s": 60})
        assert r.status == 400 and "between" in (await r.json())["error"]
        r = await client.post("/settings", data="not json")
        assert r.status == 400
        r = await client.post("/personal_best/reset")
        assert r.status == 200 and (await r.json())["personal_bests"] == {}
    finally:
        await client.close()


async def test_settings_need_whole_lap(corner, ref, tmp_path):
    app, client = await make(corner, ref, tmp_path)
    try:
        assert (await client.get("/settings")).status == 404
        assert (await client.post("/personal_best/reset")).status == 404
    finally:
        await client.close()


async def test_pitpal_static_route(corner, ref, tmp_path):
    app, client = await make(corner, ref, tmp_path)
    try:
        r = await client.get("/pitpal/icon-32.png")
        assert r.status == 200 and r.headers["Content-Type"] == "image/png"
        assert (await client.get("/pitpal/fonts/barlow-400-normal.woff2")).status == 200
        assert (await client.get("/pitpal/nope.png")).status == 404
    finally:
        await client.close()


async def test_live_event_shape_and_ws(corner, ref, tmp_path):
    from coach.app import live_event
    from coach.telemetry import Sample
    s = Sample(t=1.0, packet_id=1, status="live", pos_norm=0.1, pos_m=corner.start_gate_m + 1,
               speed_kmh=123.456, gas=0.5, brake=0.0, steer=0.1, x=0, y=0, z=0, gear=3, rpm=7000)
    ev = live_event(s, max_rpm=9000, corners=[corner])
    assert ev["type"] == "live" and ev["speed_kmh"] == 123.5 and ev["gear"] == 3
    assert ev["rpm"] == 7000 and ev["max_rpm"] == 9000 and ev["corner"] == corner.name
    quiet = live_event(Sample(t=1.0, packet_id=1, status="live", pos_norm=0, pos_m=0, speed_kmh=0,
                              gas=0, brake=0, steer=0, x=0, y=0, z=0), max_rpm=0, corners=[corner])
    assert quiet["rpm"] is None and quiet["max_rpm"] is None and quiet["gear"] is None

    app, client = await make(corner, ref, tmp_path)
    await app.start()
    try:
        ws = await client.ws_connect("/ws")
        live = None
        for _ in range(200):
            msg = json.loads((await ws.receive(timeout=10)).data)
            if msg["type"] == "live":
                live = msg
                break
        assert live is not None and live["source"] == "sim" and "pos_m" in live
        assert not any(e["type"] == "live" for e in app.events)   # display only, never in history
        await ws.close()
    finally:
        await app.stop()
        await client.close()


async def test_cross_origin_and_rebinding_requests_are_refused(corner, ref, tmp_path):
    """A web page you visit must not be able to drive or read the local dashboard."""
    app, client = await make(corner, ref, tmp_path)
    try:
        assert (await client.get("/state")).status == 200                            # same origin / no Origin: fine
        same = f"http://{client.host}:{client.port}"
        assert (await client.get("/state", headers={"Origin": same})).status == 200
        evil = await client.get("/state", headers={"Origin": "https://evil.example"})
        assert evil.status == 403
        r = await client.post("/settings", json={}, headers={"Origin": "https://evil.example"})
        assert r.status == 403
        with __import__("pytest").raises(Exception):                                   # a cross-site WebSocket is refused
            await client.ws_connect("/ws", headers={"Origin": "https://evil.example"})
        rebound = await client.get("/state", headers={"Host": "evil.example"})         # DNS rebinding
        assert rebound.status == 403
        ok = await client.get("/", headers={"Host": f"localhost:{client.port}"})
        assert ok.status == 200 and ok.headers["X-Content-Type-Options"] == "nosniff"
    finally:
        await client.close()
