import asyncio
from types import SimpleNamespace

import pytest
from aiohttp.test_utils import TestClient, TestServer

from coach.cloud_history import HistoryService
from coach.history_routes import make_history_app


def config(identity="writer-a"):
    return SimpleNamespace(url="http://127.0.0.1:3000", database="pitpal-test", token="private-test-token",
                           identity=identity, device_id="device-a", label="Game PC", enabled=True)


class FakeClient:
    def __init__(self):
        self.failure = None
        self.closed = False
        self.gate = None

    async def device_status(self):
        if self.failure:
            raise self.failure
        return {"identity": "writer-a", "device_id": "device-a", "label": "Game PC", "role": "viewer"}

    async def list_sessions(self, **query):
        if self.gate:
            await self.gate.wait()
        return {"items": [{"session_id": "session-a", "payload": {"track": "Monza", "car": "MX-5"}}],
                "next_cursor": "next-page"}

    async def get_session(self, session_id, **query):
        return {"session": {"session_id": session_id, "payload": {"track": "Monza"}},
                "items": [{"payload": {"cue": "<script>alert('x')</script>"}}], "next_cursor": None}

    async def close(self):
        self.closed = True


async def idle(service):
    async def poll():
        while service.status()["refreshing"]:
            await asyncio.sleep(0.001)
    await asyncio.wait_for(poll(), 2)


async def test_unconfigured_history_is_usable_and_reports_setup_required(tmp_path):
    service = HistoryService(data_dir=tmp_path)
    await service.start()
    try:
        assert service.page()["items"] == []
        assert service.status()["state"] == "disabled"
        assert service.refresh() is False
    finally:
        await service.close()


async def test_refresh_is_background_work_and_cache_survives_restart(tmp_path):
    client = FakeClient()
    client.gate = asyncio.Event()
    service = HistoryService(config(), tmp_path, client=client)
    await service.start()
    try:
        assert service.refresh()
        await asyncio.sleep(0)
        assert service.status()["refreshing"]
        assert service.page()["items"] == []
        assert not service.refresh()
        client.gate.set()
        await idle(service)
        page = service.page()
        assert page["items"][0]["session_id"] == "session-a"
        assert page["next_cursor"] == "next-page"
        assert page["cache"]["state"] == "fresh"
        assert "private-test-token" not in str(page) + str(service.status())
    finally:
        await service.close()
    cached = HistoryService(config(), tmp_path, client=FakeClient())
    await cached.start()
    try:
        assert cached.page()["items"][0]["session_id"] == "session-a"
        assert cached.page()["cache"]["state"] == "stale"
    finally:
        await cached.close()


async def test_identity_changes_do_not_read_another_cache(tmp_path):
    first = HistoryService(config(), tmp_path, client=FakeClient())
    await first.start()
    first.refresh()
    await idle(first)
    await first.close()
    second = HistoryService(config("writer-b"), tmp_path, client=FakeClient())
    await second.start()
    try:
        assert second.page()["items"] == []
    finally:
        await second.close()


async def test_temporary_error_preserves_cached_results(tmp_path):
    service = HistoryService(config(), tmp_path, client=FakeClient())
    await service.start()
    try:
        service.refresh()
        await idle(service)
        service.client.failure = OSError("private-test-token should not be returned")
        service.refresh()
        await idle(service)
        assert service.status()["state"] == "offline"
        assert service.page()["items"]
        assert service.page()["cache"]["state"] == "stale"
        assert "private-test-token" not in str(service.status())
    finally:
        await service.close()


async def test_profile_identity_mismatch_clears_served_history(tmp_path):
    client = FakeClient()
    service = HistoryService(config("different-identity"), tmp_path, client=client)
    await service.start()
    try:
        service.refresh()
        await idle(service)
        assert service.status()["state"] == "auth_error"
        assert service.page()["items"] == []
    finally:
        await service.close()


async def test_local_routes_are_cached_validate_queries_and_reject_cross_origin_posts(tmp_path):
    service = HistoryService(config(), tmp_path, client=FakeClient())
    client = TestClient(TestServer(make_history_app(service)))
    await client.start_server()
    try:
        response = await client.post("/history/refresh", json={})
        assert response.status == 202
        await idle(service)
        assert (await (await client.get("/history")).json())["items"]
        assert (await client.get("/history/status")).status == 200
        assert (await client.get("/history?limit=10000")).status == 400
        assert (await client.get("/history/session-a?kind=secrets")).status == 400
        assert (await client.post("/history/refresh", json={}, headers={"Origin": "https://evil.example"})).status == 403
        assert (await client.post("/history/refresh", data="invalid json")).status == 400
        html = await (await client.get("/")).text()
        assert "Session history" in html
        assert "private-test-token" not in html
        script = await (await client.get("/history.js")).text()
        assert "innerHTML" not in script
    finally:
        await client.close()
    assert service.client.closed


async def test_detail_results_are_paginated_and_not_implicitly_labeled_as_lap_data(tmp_path):
    service = HistoryService(config(), tmp_path, client=FakeClient())
    await service.start()
    try:
        service.refresh(session_id="session-a", kind="decisions", limit=25)
        await idle(service)
        page = service.page(session_id="session-a", kind="decisions", limit=25)
        assert page["session"]["session_id"] == "session-a"
        assert page["items"][0]["payload"]["cue"].startswith("<script>")
        assert service.page(session_id="session-a", kind="laps", limit=25)["items"] == []
    finally:
        await service.close()


async def test_history_viewer_needs_no_game_or_model_initialization(tmp_path, monkeypatch):
    from coach.history import build_app
    import sys
    monkeypatch.setitem(sys.modules, "coach.app", None)
    monkeypatch.setitem(sys.modules, "engine.nemotron", None)
    app = build_app(tmp_path, environ={})
    client = TestClient(TestServer(app))
    await client.start_server()
    try:
        assert (await client.get("/")).status == 200
        assert (await (await client.get("/history/status")).json())["state"] == "disabled"
    finally:
        await client.close()


async def test_full_coach_mounts_history_and_keeps_it_out_of_game_commands(corner, ref, tmp_path):
    from coach.app import CoachApp
    from coach.dashboard import make_web_app
    from coach.telemetry import SimSource
    app = CoachApp(corner, ref, SimSource(corner, realtime=False), [], reset_mode="sim",
                   data_dir=tmp_path, persist_checkpoint=False, sound=False, countdown=0)
    app.cloud_history = HistoryService(data_dir=tmp_path)
    client = TestClient(TestServer(make_web_app(app)))
    await client.start_server()
    try:
        assert (await client.get("/history-view")).status == 200
        assert (await (await client.get("/history")).json())["status"]["state"] == "disabled"
        html = await (await client.get("/")).text()
        assert 'href="/history-view"' in html
        assert (await client.post("/history/refresh", json={"command": "accept"})).status == 400
    finally:
        await client.close()
