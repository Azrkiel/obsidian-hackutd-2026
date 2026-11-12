"""Per-session telemetry CSV: speed, throttle and brake per lap, local only."""
from types import SimpleNamespace

from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

from coach import telemetry_log
from coach.history_routes import add_telemetry_routes
from coach.telemetry_log import TelemetryLog


def smp(t, pos, kmh=120.0, gas=0.8, brake=0.0, status="live"):
    return SimpleNamespace(t=t, status=status, pos_norm=pos, pos_m=pos * 5793, speed_kmh=kmh, gas=gas,
                           brake=brake, steer=0.0, gear=3)


def test_laps_are_counted_by_the_line_crossing(tmp_path):
    log = TelemetryLog(tmp_path, lambda: "sess-1")
    for i in range(30):
        log.add(smp(i * 0.1, (i * 0.04) % 1.0))        # crosses the line about every 25 samples
    log.close()
    rows = telemetry_log.read_session(tmp_path, "sess-1")
    assert {int(r["lap"]) for r in rows} == {1, 2}
    assert len(telemetry_log.read_session(tmp_path, "sess-1", lap=2)) < len(rows)


def test_rate_is_limited_and_only_live_samples_are_kept(tmp_path):
    log = TelemetryLog(tmp_path, lambda: "sess-2")
    for i in range(100):
        log.add(smp(i * 0.01, 0.1))                    # 100 Hz in, one second
    log.add(smp(5.0, 0.2, status="pause"))
    log.close()
    assert 9 <= len(telemetry_log.read_session(tmp_path, "sess-2")) <= 11


def test_a_new_session_id_starts_a_new_file_and_lap_one(tmp_path):
    current = {"id": "a1"}
    log = TelemetryLog(tmp_path, lambda: current["id"])
    log.add(smp(0.0, 0.9)); log.add(smp(0.2, 0.05))     # lap 2 in the first session
    current["id"] = "b2"
    log.add(smp(0.4, 0.1)); log.close()
    assert {int(r["lap"]) for r in telemetry_log.read_session(tmp_path, "a1")} == {1, 2}
    assert {int(r["lap"]) for r in telemetry_log.read_session(tmp_path, "b2")} == {1}
    assert {s["session_id"] for s in telemetry_log.list_sessions(tmp_path)} == {"a1", "b2"}


def test_without_cloud_the_file_uses_a_local_id_and_unsafe_ids_are_refused(tmp_path):
    log = TelemetryLog(tmp_path, lambda: "../evil")
    log.add(smp(0.0, 0.1)); log.close()
    names = [p.name for p in tmp_path.glob("*.csv")]
    assert len(names) == 1 and names[0].startswith("local-")
    assert telemetry_log.read_session(tmp_path, "../evil") is None


async def test_routes_serve_json_and_csv(tmp_path):
    log = TelemetryLog(tmp_path, lambda: "sess-3")
    for i in range(30):
        log.add(smp(i * 0.1, (i * 0.04) % 1.0, kmh=100 + i))
    log.close()
    app = web.Application()
    add_telemetry_routes(app, tmp_path)
    async with TestClient(TestServer(app)) as c:
        idx = await (await c.get("/telemetry")).json()
        assert idx["sessions"][0]["session_id"] == "sess-3" and idx["sessions"][0]["laps"] == [1, 2]
        j = await (await c.get("/telemetry/sess-3.json?lap=2")).json()
        assert j["lap"] == 2 and len(j["t"]) == len(j["speed"]) == len(j["gas"]) == len(j["brake"]) > 0
        r = await c.get("/telemetry/sess-3.csv?lap=1")
        text = await r.text()
        assert text.splitlines()[0] == "lap,t_s,pos_m,speed_kmh,gas,brake,steer,gear"
        assert "attachment" in r.headers["Content-Disposition"] and "lap1" in r.headers["Content-Disposition"]
        assert (await c.get("/telemetry/nope.csv")).status == 404
        assert (await c.get("/telemetry/sess-3.csv?lap=x")).status == 400
