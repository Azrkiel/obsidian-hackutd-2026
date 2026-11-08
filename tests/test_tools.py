import copy

from engine.models import ToolCall
from engine.tools import TOOLS, validate
from conftest import good_end, good_offer


def test_schemas():
    names = [t["function"]["name"] for t in TOOLS]
    assert names == ["get_attempt_evidence", "offer_drill", "end_drill"]


def test_valid_offer(mk_packet):
    p = mk_packet("late_brake")
    assert validate(good_offer(p), p) == (True, None)


def test_valid_end(mk_packet):
    p = mk_packet("clean")
    assert validate(good_end(p), p)[0]


def bad(p, **over):
    c = good_offer(p)
    a = copy.deepcopy(c.arguments)
    a.update(over)
    return ToolCall("offer_drill", a)


def test_rejections(mk_packet):
    p = mk_packet("late_brake")
    assert not validate(bad(p, attempt_id="zzz"), p)[0]
    assert not validate(ToolCall("fly", {"attempt_id": p["attempt_id"]}), p)[0]
    assert not validate(bad(p, drill_id="turn_in"), p)[0]
    assert not validate(bad(p, target={"marker_m": 100, "bogus": 1}), p)[0]
    assert not validate(bad(p, target={"marker_m": 500}), p)[0]
    assert not validate(bad(p, target={"peak_brake": 0.9}), p)[0]
    assert not validate(bad(p, target={"marker_m": 100, "peak_brake": 1.5}), p)[0]
    assert not validate(bad(p, cue=""), p)[0]
    assert not validate(bad(p, cue=" ".join(["go"] * 21)), p)[0]
    v = bad(p, verdict="repeat")  # stray verdict on a baseline is dropped, the offer kept
    assert validate(v, p) == (True, None) and "verdict" not in v.arguments
    assert not validate(good_end(p, "bogus"), p)[0]
    assert not validate(good_end(p, "no_coaching_needed"), p)[0]  # 14 m late is not "fine"


def test_baseline_offer_must_match_delta(mk_packet):
    clean = mk_packet("clean")
    assert not validate(good_offer(clean, cue="Brake at the 100 m board."), clean)[0]
    assert validate(good_end(clean, "no_coaching_needed"), clean)[0]
    p = mk_packet("early_throttle")
    t = ToolCall("offer_drill", {"attempt_id": p["attempt_id"], "drill_id": "throttle_pickup",
                                 "target": {"marker_m": 20, "peak_brake": 0.9},
                                 "cue": "Pick up throttle 20 m past the apex."})
    assert validate(t, p) == (True, None) and t.arguments["target"] == {"marker_m": 20}
    assert not validate(None, p)[0]


def test_cue_numbers(mk_packet):
    p = mk_packet("late_brake")

    def ok(cue):
        return validate(bad(p, cue=cue), p)[0]

    assert ok("Brake at the 100 m board.")
    assert ok("You braked 14.2 m later.")  # raw
    assert ok("You braked 14 m later.")  # rounded
    assert ok("Section was 0.41 s slower, peak brake 0.08 lower.")  # abs of negative
    assert ok("Apex speed 4.1 km/h lower.")
    assert not ok("Brake at the 95 m board.")
    assert not ok("You lost 3.7 s.")
    assert not ok("Brake at the 100.5 m board.")


def test_not_comparable_and_invalid(mk_packet):
    for name in ("not_comparable", "invalid"):
        p = mk_packet(name)
        c = good_offer(p, cue="Brake at the 100 m board.")
        assert not validate(c, p)[0]
        assert validate(good_end(p, "not_comparable"), p)[0]


def test_retry_invalid_may_repeat_same(mk_packet):
    p = mk_packet("retry_invalid", retry_of="late_brake")
    same = ToolCall("offer_drill", {"attempt_id": p["attempt_id"], "drill_id": "brake_point",
                                    "target": {"marker_m": 100},
                                    "cue": "Run invalid. Brake at the 100 m board.",
                                    "verdict": "repeat"})
    assert validate(same, p) == (True, None)
    other = ToolCall("offer_drill", {**same.arguments, "target": {"marker_m": 110},
                                     "cue": "Brake at the 110 m board."})
    assert not validate(other, p)[0]


def test_verdict_on_retry_and_end_no_coaching(mk_packet):
    p = mk_packet("retry_close", retry_of="late_brake")
    c = ToolCall("offer_drill", {"attempt_id": p["attempt_id"], "drill_id": "brake_point",
                                 "target": {"marker_m": 100},
                                 "cue": "Closer. Brake at the 100 m board.", "verdict": "repeat"})
    assert validate(c, p)[0]
    assert validate(good_end(p, "no_coaching_needed"), p)[0]
