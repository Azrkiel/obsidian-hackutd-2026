import json

import pytest

from coach.cloud_client import CloudError
from coach.cloud_config import CloudConfig
from scripts.spike_spacetime import probe


class FakeCloud:
    def __init__(self, config, role="writer"):
        self.config, self.role = config, role
        self.writes, self.rows = [], {}
        self.closed = False
    async def device_status(self):
        return {"identity": "a" * 64, "device_id": "pc-a", "label": "A", "role": self.role}
    async def record(self, kind, record):
        self.writes.append((kind, record))
        self.rows[(kind, record["record_id"])] = record
    async def list_sessions(self, **kw):
        return {"items": [], "next_cursor": None}
    async def get_session(self, sid, kind="laps", **kw):
        singular = {"laps": "lap", "attempts": "attempt", "decisions": "decision"}[kind]
        rows = [row for (k, _), row in self.rows.items() if k == singular and row["session_id"] == sid]
        sessions = [row for (k, _), row in self.rows.items() if k == "session" and row["session_id"] == sid]
        return {"session": sessions[-1], "items": rows, "next_cursor": None}
    async def close(self):
        self.closed = True


def cfg():
    return CloudConfig("http://127.0.0.1:3000", "test", "private-token", "a" * 64, "pc-a")


async def test_probe_writes_a_tagged_session_replays_and_reads_each_result():
    client = FakeCloud(cfg())
    result = await probe(cfg(), client_factory=lambda _: client)
    assert result["duplicate_safe"] is True
    assert result["counts"] == {"laps": 1, "attempts": 1, "decisions": 1}
    assert client.closed
    assert len([1 for kind, _ in client.writes if kind == "attempt"]) == 2
    assert all(row["payload"].get("source", "sim") == "sim" for _, row in client.writes)
    assert "private-token" not in json.dumps(result)


async def test_verify_only_does_not_write_and_viewer_cannot_run_write_probe():
    viewer = FakeCloud(cfg(), "viewer")
    result = await probe(cfg(), verify_only=True, client_factory=lambda _: viewer)
    assert result["mode"] == "read-only" and viewer.writes == [] and viewer.closed
    denied = FakeCloud(cfg(), "viewer")
    with pytest.raises(CloudError) as error:
        await probe(cfg(), client_factory=lambda _: denied)
    assert error.value.kind == "auth" and denied.writes == [] and denied.closed


async def test_probe_detects_missing_cloud_data_instead_of_claiming_success():
    class Missing(FakeCloud):
        async def get_session(self, sid, **kw):
            result = await super().get_session(sid, **kw)
            result["items"] = []
            return result
    client = Missing(cfg())
    with pytest.raises(CloudError):
        await probe(cfg(), client_factory=lambda _: client)
    assert client.closed
