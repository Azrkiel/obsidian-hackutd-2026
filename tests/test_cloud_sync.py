import asyncio
import json
from types import SimpleNamespace

import pytest
from aiohttp import web
from aiohttp.test_utils import TestServer

from coach.cloud_client import CloudClient, CloudError
from coach.cloud_sync import CloudSync


def config(url="http://127.0.0.1:3000"):
    return SimpleNamespace(url=url, database="pitpal", identity="writer", device_id="pc-1",
                           token="do-not-expose", label="Game PC", role="writer")


async def until(predicate, seconds=3):
    async with asyncio.timeout(seconds):
        while not predicate():
            await asyncio.sleep(.005)


async def test_client_request_shape_procedure_decoding_and_no_secret_error():
    seen = []
    async def call(req):
        seen.append((req.match_info["name"], await req.json(), req.headers.get("Authorization"), req.query.get("confirmed")))
        if req.match_info["name"] == "bad":
            return web.json_response({"Err": "invalid token do-not-expose"}, status=403)
        return web.json_response(json.dumps({"items": [], "next_cursor": None}))
    app = web.Application()
    app.router.add_post("/v1/database/pitpal/call/{name}", call)
    async with TestServer(app) as server:
        client = CloudClient(config(str(server.make_url("")).rstrip("/")))
        try:
            assert await client.list_sessions() == {"items": [], "next_cursor": None}
            assert seen[0][0] == "list_sessions"
            assert json.loads(seen[0][1][0])["limit"] == 20
            assert seen[0][2] == "Bearer do-not-expose" and seen[0][3] == "true"
            with pytest.raises(CloudError) as caught:
                await client.call("bad", [])
            assert caught.value.kind == "auth" and "do-not-expose" not in str(caught.value)
        finally:
            await client.close()


async def test_client_classifies_wrapped_denial_and_retry_after():
    async def call(req):
        if req.match_info["name"] == "limited":
            return web.Response(status=429, headers={"Retry-After": "42"})
        return web.json_response({"Err": "device is not registered"})
    app = web.Application()
    app.router.add_post("/v1/database/pitpal/call/{name}", call)
    async with TestServer(app) as server:
        client = CloudClient(config(str(server.make_url("")).rstrip("/")))
        try:
            with pytest.raises(CloudError) as denied:
                await client.call("denied", [])
            assert denied.value.kind == "auth"
            with pytest.raises(CloudError) as limited:
                await client.call("limited", [])
            assert limited.value.kind == "retryable" and limited.value.retry_after == 42
        finally:
            await client.close()


async def test_http_500_application_auth_and_validation_are_not_network_retries():
    async def call(req):
        text = "AUTH: device not registered" if req.match_info["name"] == "denied" else "VALIDATION: bad record"
        return web.Response(status=500, text=text)
    app = web.Application()
    app.router.add_post("/v1/database/pitpal/call/{name}", call)
    async with TestServer(app) as server:
        client = CloudClient(config(str(server.make_url("")).rstrip("/")))
        try:
            for name, expected in (("denied", "auth"), ("invalid", "validation")):
                with pytest.raises(CloudError) as error:
                    await client.call(name, [])
                assert error.value.kind == expected
        finally:
            await client.close()


async def test_redirect_is_not_followed_and_large_response_is_bounded():
    foreign_requests = []
    async def foreign(req):
        foreign_requests.append(req.headers.get("Authorization"))
        return web.json_response("{}")
    target = web.Application()
    target.router.add_post("/destination", foreign)
    async with TestServer(target) as other:
        async def call(req):
            if req.match_info["name"] == "redirect":
                raise web.HTTPTemporaryRedirect(str(other.make_url("/destination")))
            return web.Response(body=b"x" * (8 * 1024 * 1024 + 1))
        app = web.Application()
        app.router.add_post("/v1/database/pitpal/call/{name}", call)
        async with TestServer(app) as server:
            client = CloudClient(config(str(server.make_url("")).rstrip("/")))
            try:
                for name in ("redirect", "large"):
                    with pytest.raises(CloudError) as error:
                        await client.call(name, [])
                    assert error.value.kind == "response"
                assert foreign_requests == []
            finally:
                await client.close()


class FakeClient:
    def __init__(self):
        self.entries = []
        self.error = None
        self.closed = False
    async def device_status(self):
        return {"identity": "writer", "device_id": "pc-1", "role": "writer"}
    async def record(self, kind, record):
        if self.error:
            raise self.error
        self.entries.append((kind, record))
    async def close(self):
        self.closed = True


async def test_sync_projects_uploads_and_closes_session(tmp_path):
    client = FakeClient()
    sync = CloudSync(config(), tmp_path, "sim", "lap", "Monza", client=client)
    await sync.start()
    sid = sync.session_id
    sync.capture({"type": "run", "role": "baseline", "attempt": {
        "attempt_id": "a-1", "valid": True, "invalid_reason": None, "entry_kmh": 100}})
    sync.capture({"type": "telemetry", "token": "secret"})
    await until(lambda: any(k == "attempt" for k, _ in client.entries))
    await sync.stop()
    assert client.entries[0][0] == "session"
    assert any(k == "session" and r["payload"]["status"] == "closed" for k, r in client.entries)
    assert all(r["session_id"] == sid for _, r in client.entries)
    assert client.closed
    assert "do-not-expose" not in json.dumps(sync.status())


async def test_offline_records_survive_restart_and_upload_once_recovered(tmp_path):
    client = FakeClient()
    client.error = CloudError("retryable", "offline")
    sync = CloudSync(config(), tmp_path, "ac", "lap", "Monza", client=client, retry_base=.01)
    await sync.start()
    sync.capture({"type": "track_lap", "lap": 1, "valid": False, "lap_time_s": None,
                  "invalid_reason": "reset", "delta_s": 0, "corners": []})
    await until(lambda: sync.outbox.count >= 2)
    await sync.stop()
    recovered = FakeClient()
    second = CloudSync(config(), tmp_path, "ac", "lap", "Monza", client=recovered, retry_base=.01)
    await second.start()
    await until(lambda: any(k == "lap" for k, _ in recovered.entries))
    await second.stop()
    lap_rows = [r for k, r in recovered.entries if k == "lap"]
    assert len(lap_rows) == 1 and lap_rows[0]["payload"]["lap_time_s"] is None


async def test_auth_failure_pauses_upload_and_retains_pending_records(tmp_path):
    client = FakeClient()
    client.error = CloudError("auth", "denied")
    sync = CloudSync(config(), tmp_path, "sim", "lap", "Monza", client=client, retry_base=.01)
    await sync.start()
    await until(lambda: sync.status()["state"] == "auth-error")
    assert sync.outbox.count >= 1
    await sync.stop()


async def test_bounded_buffer_reports_incomplete_capture(tmp_path):
    sync = CloudSync(config(), tmp_path, "sim", "lap", "Monza", client=FakeClient(), buffer_size=1)
    await sync.start()
    for n in range(20):
        sync.capture({"type": "track_lap", "lap": n, "valid": True, "lap_time_s": 90,
                      "invalid_reason": None, "delta_s": 0, "corners": []})
    assert sync.status()["capture_complete"] is False
    assert sync.status()["dropped"] > 0
    await sync.stop()


async def test_remote_validation_quarantines_parent_and_children(tmp_path):
    client = FakeClient()
    client.error = CloudError("validation")
    sync = CloudSync(config(), tmp_path, "sim", "lap", "Monza", client=client, retry_base=.01)
    await sync.start()
    sync.capture({"type": "track_lap", "lap": 1, "valid": True, "lap_time_s": 90,
                  "invalid_reason": None, "delta_s": 0, "corners": []})
    await until(lambda: sync.status()["rejected"] >= 1)
    assert sync.status()["capture_complete"] is False
    await sync.stop()


async def test_membership_failure_never_crashes_background_task(tmp_path):
    class BadMembership(FakeClient):
        async def device_status(self):
            raise CloudError("validation")
    sync = CloudSync(config(), tmp_path, "sim", "lap", "Monza", client=BadMembership(), retry_base=.01)
    await sync.start()
    await until(lambda: sync.status()["state"] == "offline")
    assert not sync._uploader.done()
    await sync.stop()
