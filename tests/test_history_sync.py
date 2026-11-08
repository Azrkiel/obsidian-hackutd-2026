import json

from aiohttp import web
from aiohttp.test_utils import TestServer

from coach.history import HistoryRecorder
from coach.history_sync import HistorySync, SyncConfig
from tests.test_history import metadata, run_event


async def test_http_outage_replay_dependencies_and_revision_race(tmp_path, ref):
    h = HistoryRecorder(tmp_path / "h.db")
    h.start(metadata())
    h.submit(run_event(ref))
    h.flush()
    calls = []
    offline = True
    race = False

    async def receive(request):
        nonlocal race
        assert request.headers["Authorization"] == "Bearer test-token"
        args = await request.json()
        reducer = request.match_info["reducer"]
        calls.append((reducer, args))
        if offline:
            return web.Response(status=503, text="offline")
        if reducer == "record_lap" and not race:
            race = True
            h.submit({"type": "reference", "attempt": {"attempt_id": "a-0001"}})
            h.flush()
        return web.Response(status=200)

    server_app = web.Application()
    server_app.router.add_post("/v1/database/demo/call/{reducer}", receive)
    async with TestServer(server_app) as server:
        sync = HistorySync(
            h, SyncConfig(str(server.make_url("")).rstrip("/"), "demo", "test-token")
        )
        assert not await sync.sync_once()
        assert sync.pending_count() == 4
        offline = False
        assert await sync.sync_once()
        # Reference change arrived during HTTP. Its newer revision remains pending.
        assert sync.pending_count() == 1
        assert await sync.sync_once()
        assert sync.pending_count() == 0
        assert [r for r, _ in calls][1:5] == [
            "register_coach",
            "upsert_driver",
            "start_session",
            "record_lap",
        ]
        payload = json.loads([a for r, a in calls if r == "record_lap"][-1][0])
        assert payload["lap"]["role"] == "reference" and payload["trace"]["rows"]
        await sync.close()
    h.close()


def test_env_optional_and_partial_config(monkeypatch):
    for key in ("SPACETIME_URL", "SPACETIME_DB", "SPACETIME_TOKEN"):
        monkeypatch.delenv(key, raising=False)
    assert SyncConfig.from_env() is None
    monkeypatch.setenv("SPACETIME_URL", "https://maincloud.spacetimedb.com")
    assert SyncConfig.from_env() is None
    monkeypatch.setenv("SPACETIME_DB", "demo")
    monkeypatch.setenv("SPACETIME_TOKEN", "secret")
    assert SyncConfig.from_env().database == "demo"
    assert "secret" not in repr(SyncConfig.from_env())
