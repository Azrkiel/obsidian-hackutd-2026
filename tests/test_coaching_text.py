from types import SimpleNamespace

from coach.coaching_text import CORNER_GUIDE, actionable_cue, corner_guide, primary_kind, ref_board
from engine.models import ToolCall
from engine.tools import validate


def ev(kinds, facts, corner_id="parabolica", corner="Parabolica", ref_brake=None):
    return SimpleNamespace(kinds=kinds, facts=facts, corner=corner, corner_id=corner_id,
                           ref=SimpleNamespace(brake_onset_m=ref_brake))


CFG = SimpleNamespace(board_zero_m=1000.0)


def test_every_cue_names_the_corner_says_what_and_what_to_do():
    cases = {
        ("brake_late", "time_lost"): {"brake_delta_m": 14.6, "time_lost_s": 0.31},
        ("lockup",): {"slip_front": 0.4, "time_lost_s": 0.2},
        ("speed_loss",): {"min_kmh": 92.0, "ref_min_kmh": 104.0, "time_lost_s": 0.25},
        ("wheels_off",): {"wheels_off_s": 0.5, "time_lost_s": 0.6},
        ("wheelspin",): {"slip_rear": 0.5, "time_lost_s": 0.1},
        ("time_lost",): {"time_lost_s": 0.4},
    }
    seen = set()
    for kinds, facts in cases.items():
        cue = actionable_cue(ev(list(kinds), facts, ref_brake=900.0), CFG)
        assert cue.startswith("Parabolica: ") and cue.endswith(".")
        assert len(cue.split(". ")) >= 2            # a "what" sentence and a "do" sentence
        assert len(cue.split()) <= 24
        seen.add(cue)
    assert len(seen) == len(cases)                   # different problems never get the same cue


def test_brake_late_cue_gives_the_number_and_the_board():
    cue = actionable_cue(ev(["brake_late"], {"brake_delta_m": 14.6, "time_lost_s": 0.31}, ref_brake=900.0), CFG)
    assert cue == "Parabolica: you braked 15 m late, 0.3 s lost. Brake at the 100 board."


def test_board_comes_from_the_reference_in_50_m_steps_or_is_left_out():
    assert ref_board(CFG, 900.0) == 100 and ref_board(CFG, 840.0) == 150
    assert ref_board(CFG, None) is None and ref_board(SimpleNamespace(), 900.0) is None
    assert ref_board(CFG, 990.0) is None             # under 50 m: no board to point at
    cue = actionable_cue(ev(["brake_late"], {"brake_delta_m": 10.0}), None)
    assert "board" not in cue and "earlier" in cue


def test_primary_kind_puts_the_cause_first():
    assert primary_kind(["time_lost", "lockup"]) == "lockup"
    assert primary_kind(["brake_late", "spin"]) == "spin"


def test_corner_guide_covers_monza_and_falls_back():
    assert set(CORNER_GUIDE) == {"t1", "roggia", "lesmo1", "lesmo2", "ascari", "parabolica"}
    for g in CORNER_GUIDE.values():
        assert not any(ch.isdigit() for ch in g["tip"] + g["character"])   # numbers come from the event
    assert corner_guide("nowhere", "Somewhere")["name"] == "Somewhere"


def test_repeat_check_flags_the_same_advice_not_shared_words():
    from engine.tools import repeats
    said = ["Brake at the 100 board, ease off as you turn in."]
    assert repeats("Brake at the 100 board and ease off when you turn in.", said)
    assert not repeats("Ease off the brake as you hit the first kerb.", said)
    assert not repeats("Brake at the 150 board.", said)          # too short to call a repeat


def test_rules_fallback_moves_on_when_its_action_was_just_given():
    e = ev(["lockup"], {"slip_front": 0.4}, ref_brake=900.0)
    first = actionable_cue(e, CFG)
    second = actionable_cue(e, CFG, [first.split(". ", 1)[1]])
    assert first != second and second.startswith("Parabolica: the fronts locked.")
    assert CORNER_GUIDE["parabolica"]["tip"].split(",")[0] in second.lower()


def test_repeated_model_cue_is_rejected_for_lap_events(mk_packet):
    p = mk_packet("late_brake")
    p["event"] = {"kinds": ["brake_late"], "facts": {}}
    p["recent_actions"] = ["Brake at the 100 m board and turn in late."]
    same = ToolCall("offer_drill", {"attempt_id": p["attempt_id"], "drill_id": "brake_point",
                                    "target": {"marker_m": 100}, "cue": "Brake at the 100 m board, turn in late."})
    ok, why = validate(same, p)
    assert not ok and "repeats" in why


def test_lap_event_drill_is_allowed_even_when_that_delta_is_inside_tolerance(mk_packet):
    p = mk_packet("clean")                           # every delta inside tolerance
    offer = ToolCall("offer_drill", {"attempt_id": p["attempt_id"], "drill_id": "brake_point",
                                     "target": {"marker_m": 100}, "cue": "Brake at the 100 m board."})
    assert not validate(offer, p)[0]                 # a drill: nothing to fix
    p["event"] = {"kinds": ["lockup"], "facts": {"slip_front": 0.4}}
    assert validate(offer, p) == (True, None)        # a lap event: the detector found a mistake
