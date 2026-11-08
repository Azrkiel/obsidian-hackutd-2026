import asyncio
import json
from dataclasses import replace

import pytest
from aiohttp import web
from aiohttp.test_utils import TestServer

from coach.cloud_config import CloudConfig, CloudConfigError, load_config, save_profile
from scripts.spacetime_device import export_history, setup_device, status_device
from tests.test_cloud_config import IDENTITY, MemoryCredentials


@pytest.fixture
async def identity_server():
    calls = []
    async def create(request):
        calls.append("create")
        return web.json_response({"identity": IDENTITY, "token": "private-token"})
    async def verify(request):
        calls.append("verify")
        assert request.headers["Authorization"] == "Bearer private-token"
        assert request.match_info["identity"] == IDENTITY
        return web.Response(status=204)
    app = web.Application()
    app.router.add_post("/v1/identity", create)
    app.router.add_get("/v1/identity/{identity}/verify", verify)
    server = TestServer(app)
    await server.start_server()
    yield str(server.make_url("/")).rstrip("/"), calls
    await server.close()


async def test_setup_verifies_and_saves_token_outside_profile(tmp_path, identity_server):
    url, calls = identity_server
    store = MemoryCredentials()
    cfg = await setup_device(tmp_path, url, "history", "game-pc", store=store)
    assert cfg.identity == IDENTITY and cfg.role == "unknown"
    assert load_config(tmp_path, environ={}, store=store) == cfg
    assert calls == ["create", "verify"]
    assert "private-token" not in (tmp_path / "cloud" / "config.json").read_text()


async def test_setup_does_not_replace_existing_identity(tmp_path, identity_server):
    url, calls = identity_server
    store = MemoryCredentials()
    first = await setup_device(tmp_path, url, "history", "game-pc", store=store)
    again = await setup_device(tmp_path, url, "history", "changed-label", store=store)
    assert first == again
    assert calls.count("create") == 1
    with pytest.raises(CloudConfigError, match="existing"):
        await setup_device(tmp_path, url, "different-db", "game-pc", store=store)
    assert load_config(tmp_path, environ={}, store=store) == first


async def test_setup_failed_secret_store_does_not_write_profile(tmp_path, identity_server):
    from coach.cloud_credentials import CloudCredentialError
    class Broken(MemoryCredentials):
        def set_token(self, *args):
            raise CloudCredentialError("Unable to store credential.")
    with pytest.raises(CloudCredentialError):
        await setup_device(tmp_path, identity_server[0], "history", "pc", store=Broken())
    assert not (tmp_path / "cloud" / "config.json").exists()


async def test_setup_accepts_identity_response_arriving_in_multiple_chunks(tmp_path):
    async def create(request):
        response = web.StreamResponse(headers={"Content-Type": "application/json"})
        await response.prepare(request)
        body = json.dumps({"identity": IDENTITY, "token": "private-token"}).encode()
        await response.write(body[:8])
        await asyncio.sleep(0.02)
        await response.write(body[8:])
        await response.write_eof()
        return response
    async def verify(request):
        return web.Response(status=204)
    app = web.Application()
    app.router.add_post("/v1/identity", create)
    app.router.add_get("/v1/identity/{identity}/verify", verify)
    server = TestServer(app)
    await server.start_server()
    try:
        config = await setup_device(tmp_path, str(server.make_url("/")).rstrip("/"), "history", "pc", store=MemoryCredentials())
        assert config.identity == IDENTITY
    finally:
        await server.close()


class HistoryClient:
    def __init__(self):
        self.calls = []
    async def device_status(self):
        return {"identity": IDENTITY, "device_id": "device-1", "label": "game-pc", "role": "writer"}
    async def list_sessions(self, *, limit=50, cursor=None, source=None):
        self.calls.append(("sessions", cursor))
        if cursor is None:
            return {"items": [{"session_id": "s1", "payload": {"track": "Monza"}}], "next_cursor": "page-2"}
        return {"items": [{"session_id": "s2", "payload": {"track": "Monza"}}], "next_cursor": None}
    async def get_session(self, session_id, *, kind="laps", limit=100, cursor=None):
        self.calls.append((session_id, kind, cursor))
        return {"session": {"session_id": session_id}, "items": [{"record_id": f"{session_id}-{kind}"}], "next_cursor": None}


async def test_status_persists_verified_role(tmp_path, identity_server):
    cfg = CloudConfig(identity_server[0], "history", "private-token", IDENTITY, "device-1", "game-pc")
    save_profile(tmp_path, cfg)
    result = await status_device(tmp_path, cfg, client=HistoryClient())
    assert result["role"] == "writer"
    assert "private-token" not in json.dumps(result)
    raw = json.loads((tmp_path / "cloud" / "config.json").read_text())
    assert raw["role"] == "writer"


async def test_environment_status_discovers_identity_without_creating_profile(tmp_path, identity_server):
    cfg = CloudConfig(identity_server[0], "history", "private-token")
    result = await status_device(tmp_path, cfg, client=HistoryClient())
    assert result["identity"] == IDENTITY and result["role"] == "writer"
    assert not (tmp_path / "cloud" / "config.json").exists()


async def test_status_rejects_registration_for_another_device(tmp_path, identity_server):
    cfg = CloudConfig(identity_server[0], "history", "private-token", IDENTITY, "another-device", "pc")
    with pytest.raises(CloudConfigError, match="registration"):
        await status_device(tmp_path, cfg, client=HistoryClient())


async def test_setup_explicit_replace_preserves_old_public_profile(tmp_path, identity_server):
    url, _ = identity_server
    store = MemoryCredentials()
    first = await setup_device(tmp_path, url, "history", "first-pc", store=store)
    replacement = await setup_device(tmp_path, url, "history", "new-pc", store=store, replace_identity=True)
    assert replacement.device_id != first.device_id
    archive = list((tmp_path / "cloud").glob("config.previous.*.json"))
    assert len(archive) == 1
    old = json.loads(archive[0].read_text())
    assert old["device_id"] == first.device_id
    assert "private-token" not in archive[0].read_text()


async def test_export_fetches_all_sessions_and_child_kinds_atomically(tmp_path):
    destination = tmp_path / "history.json"
    client = HistoryClient()
    await export_history(client, destination)
    body = json.loads(destination.read_text())
    assert body["schema_version"] == 1
    assert [s["session"]["session_id"] for s in body["sessions"]] == ["s1", "s2"]
    assert len(body["sessions"][0]["laps"]) == 1
    assert len(body["sessions"][0]["attempts"]) == 1
    assert len(body["sessions"][0]["decisions"]) == 1
    assert ("sessions", "page-2") in client.calls
    assert not list(tmp_path.glob("*.tmp"))


async def test_export_preserves_previous_backup_on_network_failure(tmp_path):
    destination = tmp_path / "history.json"
    destination.write_text("previous backup")
    class Broken(HistoryClient):
        async def get_session(self, *args, **kwargs):
            raise RuntimeError("network failed")
    with pytest.raises(RuntimeError):
        await export_history(Broken(), destination)
    assert destination.read_text() == "previous backup"
    assert not list(tmp_path.glob("*.tmp"))


async def test_export_rejects_repeated_pagination_cursor(tmp_path):
    class Repeated(HistoryClient):
        async def list_sessions(self, **kwargs):
            return {"items": [], "next_cursor": "same"}
    with pytest.raises(CloudConfigError, match="pagination"):
        await export_history(Repeated(), tmp_path / "history.json")
