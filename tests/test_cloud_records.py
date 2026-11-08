import json

import pytest

from coach.cloud_records import RecordProjector


def run(aid="a-0001", **extra):
    return {"type": "run", "role": "baseline", "trace": [[1, 2]], "inputs": {"token": "secret"},
            "attempt": {"attempt_id": aid, "valid": True, "invalid_reason": None,
                        "entry_kmh": 100, "section_s": 3.2, "reasoning": "private", **extra}}


def test_projects_only_results_and_never_traces_or_secrets():
    p = RecordProjector("sim", "lap", "Monza", clock=lambda: 100.0)
    start = p.session_record()
    record = p.capture(run())[0]
    assert start["kind"] == "session"
    assert record["kind"] == "attempt"
    assert record["record"]["payload"]["attempt_id"] == "a-0001"
    assert record["record"]["payload"]["entry_kmh"] == 100
    assert record["record"]["sequence"] > start["record"]["sequence"]
    assert not any(x in json.dumps(record) for x in ("secret", "reasoning", "trace", "inputs"))
    for kind in ("telemetry", "health", "corner_event", "retry_judged", "thinking", "voice"):
        assert p.capture({"type": kind, "text": "secret"}) == []


def test_lap_validity_and_decision_projection():
    p = RecordProjector("ac", "lap", "Monza")
    lap = p.capture({"type": "track_lap", "lap": 3, "valid": False, "lap_time_s": None,
                     "invalid_reason": "reset", "delta_s": 0.0, "corners": []})[0]
    assert lap["record"]["payload"]["lap_time_s"] is None
    p.capture(run())
    decision = p.capture({"type": "decision", "attempt_id": "a-0001", "decision_id": "d-1",
                          "action": "offer_drill", "cue": "Brake earlier.", "mode": "rules",
                          "reasoning": "secret", "rungs": [{"token": "private"}],
                          "target": {"marker_m": 100, "api_key": "secret"}})[0]
    assert decision["record"]["payload"]["target"] == {"marker_m": 100}
    assert "secret" not in json.dumps(decision)


def test_rotation_and_explicit_late_decision_keep_original_session():
    p = RecordProjector("sim", "drill", "Monza")
    old = p.session_id
    p.capture(run())
    rotated = p.capture({"type": "session"})
    assert [r["kind"] for r in rotated] == ["session", "session"]
    assert p.session_id != old
    p.capture(run())
    late = p.capture({"type": "decision", "attempt_id": "a-0001", "decision_id": "d-old",
                      "action": "end_drill", "_history_session_id": old})[0]
    assert late["record"]["session_id"] == old
    assert late["record"]["record_id"] != p.capture(run())[0]["record"]["record_id"]


def test_ambiguous_unstamped_decision_is_rejected_instead_of_misattributed():
    p = RecordProjector("sim", "drill", "Monza")
    p.capture(run())
    p.capture({"type": "session"})
    p.capture(run())
    with pytest.raises(ValueError, match="ambiguous"):
        p.capture({"type": "decision", "attempt_id": "a-0001", "decision_id": "d-1", "action": "end_drill"})


def test_nonfinite_or_oversized_records_are_rejected():
    p = RecordProjector("sim", "drill", "Monza")
    with pytest.raises(ValueError):
        p.capture(run(entry_kmh=float("nan")))
    with pytest.raises(ValueError):
        p.capture({"type": "decision", "decision_id": "d-1", "attempt_id": "a-0001",
                   "action": "end_drill", "cue": "x" * 40_000})


def test_metadata_fill_then_confirmed_change_rotate_and_preserve_old_track():
    p = RecordProjector("ac", "lap", "", clock=lambda: 100.0)
    original = p.session_id
    update = p.update_metadata("Monza", "MX5")
    assert len(update) == 1 and p.session_id == original
    assert update[0]["record"]["payload"]["car"] == "MX5"
    changed = p.update_metadata("Spa", "MX5")
    assert len(changed) == 2 and p.session_id != original
    assert changed[0]["record"]["payload"]["track"] == "Monza"
    assert changed[1]["record"]["payload"]["track"] == "Spa"
