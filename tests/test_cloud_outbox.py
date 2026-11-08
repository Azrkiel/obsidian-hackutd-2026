import json

import pytest

from coach.cloud_outbox import CloudOutbox, OutboxFull


TARGET = {"url": "http://127.0.0.1:3000", "database": "pitpal", "identity": "writer-a"}


def entry(rid="r-1", sequence=0, session="s-1", kind="session"):
    return {"kind": kind, "record": {"schema_version": 1, "record_id": rid,
            "session_id": session, "sequence": sequence, "captured_at": 1.0, "payload": {}}}


async def test_recovery_target_isolation_order_and_ack(tmp_path):
    out = CloudOutbox(tmp_path, TARGET)
    await out.initialize()
    await out.put(entry("child", 2, kind="attempt"))
    await out.put(entry("start", 0))
    reopened = CloudOutbox(tmp_path, TARGET)
    await reopened.initialize()
    assert [e["record"]["record_id"] for e in await reopened.pending()] == ["start", "child"]
    other = CloudOutbox(tmp_path, {**TARGET, "identity": "writer-b"})
    await other.initialize()
    assert await other.pending() == []
    await reopened.ack("start")
    assert reopened.count == 1
    assert [e["record"]["record_id"] for e in await reopened.pending()] == ["child"]


async def test_identical_retry_and_conflicting_record_id(tmp_path):
    out = CloudOutbox(tmp_path, TARGET)
    await out.initialize()
    await out.put(entry())
    await out.put(entry())
    assert out.count == 1
    with pytest.raises(ValueError):
        await out.put(entry(sequence=2))


async def test_budget_never_evicts_unacknowledged_records(tmp_path):
    out = CloudOutbox(tmp_path, TARGET, max_bytes=350)
    await out.initialize()
    await out.put(entry())
    with pytest.raises(OutboxFull):
        await out.put(entry("r-2"))
    assert out.count == 1


async def test_quarantine_and_corrupt_files_do_not_stop_recovery(tmp_path):
    out = CloudOutbox(tmp_path, TARGET)
    await out.initialize()
    await out.put(entry())
    await out.quarantine("r-1", "validation")
    assert out.count == 0 and out.rejected_count == 1
    (out.directory / "broken.json").write_text("not json")
    await out.initialize()
    assert out.count == 0 and out.rejected_count == 2
    assert "token" not in json.dumps([json.loads(p.read_text()) for p in out.rejected.glob("*.json")])


async def test_record_id_cannot_escape_outbox(tmp_path):
    out = CloudOutbox(tmp_path, TARGET)
    await out.initialize()
    with pytest.raises(ValueError):
        await out.put(entry("../../escape"))


async def test_corrupt_envelope_is_quarantined_not_sorted_as_valid(tmp_path):
    out = CloudOutbox(tmp_path, TARGET)
    await out.initialize()
    (out.directory / "bad.json").write_text(json.dumps({"target": TARGET, "kind": "lap",
                                                       "record": {"record_id": "bad"}}))
    await out.initialize()
    assert await out.pending() == []
    assert out.rejected_count == 1
