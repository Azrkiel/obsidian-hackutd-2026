import pytest

from engine.rules import rule_decide
from engine.tools import validate
from engine.models import ToolCall
from conftest import attempt


@pytest.mark.parametrize("name,action,key,val", [
    ("clean", "end_drill", "end_reason", "no_coaching_needed"),
    ("late_brake", "offer_drill", "drill_id", "brake_point"),
    ("early_throttle", "offer_drill", "drill_id", "throttle_pickup"),
    ("not_comparable", "end_drill", "end_reason", "not_comparable"),
    ("invalid", "end_drill", "end_reason", "invalid_run"),
])
def test_baselines(mk_packet, name, action, key, val):
    p = mk_packet(name)
    d = rule_decide(p)
    assert d.mode == "rules" and d.action == action and getattr(d, key) == val
    assert d.attempt_id == p["attempt_id"]
    if action == "offer_drill":
        assert validate(as_call(p, d), p) == (True, None), d.cue
        assert "peak_brake" not in d.target


def as_call(p, d):
    return ToolCall(d.action, {"attempt_id": p["attempt_id"], "drill_id": d.drill_id,
                               "target": d.target, "cue": d.cue, "verdict": d.verdict})


def test_late_brake_details(mk_packet):
    d = rule_decide(mk_packet("late_brake"))
    assert d.target == {"marker_m": 100}
    assert d.cue == "Brake at the 100 m board; you braked 14 m later than reference."


def test_retry_complete(mk_packet):
    d = rule_decide(mk_packet("retry_hit", retry_of="late_brake"))
    assert d.action == "end_drill" and d.end_reason == "drill_complete"


def test_retry_repeat(mk_packet):
    p = mk_packet("retry_close", retry_of="late_brake")
    d = rule_decide(p)
    assert d.action == "offer_drill" and d.verdict == "repeat" and d.target == {"marker_m": 100}
    assert validate(as_call(p, d), p) == (True, None), d.cue


def test_retry_adjust(mk_packet):
    p = mk_packet("retry_early", retry_of="late_brake")
    assert p["target_gap"]["brake_onset_m"] == -12.0
    d = rule_decide(p)
    assert d.verdict == "adjust" and d.target == {"marker_m": 110}
    assert validate(as_call(p, d), p) == (True, None), d.cue


def test_retry_no_progress_tries(mk_packet):
    d = rule_decide(mk_packet("retry_close", retry_of="late_brake", tries=3))
    assert d.end_reason == "no_progress"


def test_retry_no_progress_stalled(mk_packet):
    p = mk_packet("retry_close", retry_of="late_brake", tries=2, previous=attempt("retry_close"))
    assert p["vs_previous"]["brake_onset_m"] == 0.0
    assert rule_decide(p).end_reason == "no_progress"


def test_retry_progressing_on_try2_repeats(mk_packet):
    p = mk_packet("retry_close", retry_of="late_brake", tries=2)  # previous = baseline 354.2
    assert rule_decide(p).verdict == "repeat"


def test_retry_invalid(mk_packet):
    p = mk_packet("retry_invalid", retry_of="late_brake")
    d = rule_decide(p)
    assert d.verdict == "repeat" and d.target == {"marker_m": 100} and "invalid" in d.cue
    assert validate(as_call(p, d), p) == (True, None)
