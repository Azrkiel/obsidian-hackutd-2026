import asyncio
import threading
from dataclasses import asdict
from uuid import UUID

from aiohttp.test_utils import TestClient, TestServer

from coach.app import CoachApp
from coach.dashboard import make_web_app
from coach.history import HistoryRecorder
from coach.telemetry import SimSource


def metadata():
    return dict(
        name="Kevin",
        source="dashboard",
        track="monza",
        car="787b",
        corner="T1",
        mode="drill",
        agent=True,
        model="nemotron",
        recording=None,
    )


def run_event(ref, role="baseline"):
    a = asdict(ref)
    a["attempt_id"] = "a-0001"
    a["brake_board_m"] = 100
    return dict(
        type="run",
        ts=100.0,
        role=role,
        attempt=a,
        trace=[dict(pos_m=100, brake=0.5, gas=0, speed_kmh=200, t=1)],
        inputs=None,
    )


def test_restart_ids_links_reference_and_light_lists(tmp_path, ref):
    path = tmp_path / "history.sqlite3"
    for _ in range(2):
        h = HistoryRecorder(path)
        h.start(metadata())
        h.submit(run_event(ref))
        h.submit(
            dict(
                type="decision",
                ts=101.0,
                attempt_id="a-0001",
                decision_id="d-0001",
                action="offer_drill",
                drill_id="brake_point",
                target={"marker_m": 100},
                cue="Brake at 100 m.",
                mode="rules",
                latency_ms=3,
            )
        )
        h.submit(dict(type="plan", attempt_id="a-0001", plan={"goals": []}))
        h.submit(dict(type="reference", attempt=run_event(ref)["attempt"]))
        h.close()
    data = h.read()
    assert len(data["sessions"]) == len(data["laps"]) == len(data["decisions"]) == 2
    assert len(data["drivers"]) == 1
    assert len({r["lap_id"] for r in data["laps"]}) == 2
    for lap in data["laps"]:
        UUID(lap["lap_id"])
        assert lap["role"] == "reference" and "rows" not in lap
        assert h.trace(lap["lap_id"])[0]["brake"] == 0.5
    assert all(s["ended_at"] and s["plan"] == {"goals": []} for s in data["sessions"])
    assert {d["lap_id"] for d in data["decisions"]} == {
        l["lap_id"] for l in data["laps"]
    }


def test_subscriber_never_waits_for_disk_and_flush_drains(tmp_path, ref):
    h = HistoryRecorder(tmp_path / "h.db")
    h.start(metadata())
    entered, release = threading.Event(), threading.Event()
    original = h._write_event

    def slow(*args):
        entered.set()
        assert release.wait(3)
        return original(*args)

    h._write_event = slow
    h.submit(run_event(ref))
    assert entered.wait(2)
    # The caller returns even while the only disk writer is blocked.
    h.submit(dict(type="session"))
    release.set()
    h.close()
    assert len(h.read()["sessions"]) == 2


def test_bad_event_does_not_disable_future_laps_or_hide_existing_history(tmp_path, ref):
    h = HistoryRecorder(tmp_path / "h.db")
    h.start(metadata())
    h.submit(run_event(ref))
    h.submit({"type": "run", "attempt": {}})
    h.flush()
    h.submit(run_event(ref))
    h.close()
    assert len(h.read()["laps"]) == 2


def test_explicit_driver_uuid_survives_a_name_change(tmp_path):
    path = tmp_path / "h.db"
    for name in ("Kevin", "Kevin Racer"):
        h = HistoryRecorder(path)
        h.start(
            {
                **metadata(),
                "name": name,
                "driver_id": "7ff79c73-e971-45d1-bbf5-c22d7e409a90",
            }
        )
        h.close()
    assert len(h.read()["drivers"]) == 1
    assert h.read()["drivers"][0]["name"] == "Kevin Racer"


async def test_app_lifecycle_rotates_all_resets_and_history_endpoint(
    tmp_path, corner, ref
):
    app = CoachApp(
        corner,
        ref,
        SimSource(corner, realtime=False),
        [],
        reset_mode="sim",
        data_dir=tmp_path,
        trace_dir=tmp_path / "traces",
        history=True,
        driver_name="Kevin",
    )
    client = TestClient(TestServer(make_web_app(app)))
    await client.start_server()
    await app.start()
    try:
        await app.wait_for(lambda: app.last_decision is not None)
        await asyncio.to_thread(app.history.flush)
        response = await client.get("/history")
        data = await response.json()
        assert response.status == 200 and data["enabled"] and len(data["laps"]) == 1
        lap = data["laps"][0]
        assert data["decisions"][0]["lap_id"] == lap["lap_id"]
        assert (await (await client.get(f"/history/trace/{lap['lap_id']}")).json())[
            "rows"
        ]
        assert (await client.get("/history?limit=nope")).status == 400
        await app.handle_command({"type": "new_session"})
        await asyncio.to_thread(app.history.flush)
        assert len(app.history.read()["sessions"]) == 2
        assert (
            app.history.driver_history()["sessions"][0]["laps"][0]["section_s"]
            == lap["section_s"]
        )
    finally:
        await app.stop()
        await client.close()
    assert all(s["ended_at"] for s in app.history.read()["sessions"])


async def test_history_off_and_failed_storage_do_not_break_coach(tmp_path, corner, ref):
    app = CoachApp(
        corner,
        ref,
        SimSource(corner, realtime=False),
        [],
        data_dir=tmp_path,
        trace_dir=tmp_path / "t",
    )
    assert app.history is None
    # A file in place of the directory makes opening SQLite fail.
    bad = tmp_path / "bad"
    bad.write_text("blocked")
    app = CoachApp(
        corner,
        ref,
        SimSource(corner, realtime=False),
        [],
        history=True,
        data_dir=bad,
        trace_dir=tmp_path / "t",
        persist_checkpoint=False,
    )
    await app.start()
    try:
        await app.wait_for(lambda: app.last_decision is not None)
        assert app.history.error
    finally:
        await app.stop()


async def test_public_config_has_no_writer_token(tmp_path, corner, ref, monkeypatch):
    monkeypatch.setenv("SPACETIME_TOKEN", "must-not-leak")
    monkeypatch.setenv("SPACETIME_URL", "https://maincloud.spacetimedb.com")
    monkeypatch.setenv("SPACETIME_DB", "public-history")
    app = CoachApp(corner, ref, SimSource(corner), [], data_dir=tmp_path)
    client = TestClient(TestServer(make_web_app(app)))
    await client.start_server()
    try:
        text = await (await client.get("/history/config")).text()
        assert "must-not-leak" not in text and "public-history" in text
        assert (await client.get("/history-viewer/")).status == 200
    finally:
        await client.close()
