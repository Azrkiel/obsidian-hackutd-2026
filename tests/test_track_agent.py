"""Whole-lap evidence (lap_summary, worst_metric, focus_corner) and TrackAgentSession / TrackAgentTurn."""
import asyncio
import json
from pathlib import Path

import pytest

from coach.scorer import TrackScorer
from coach.telemetry import DEFAULT_BOARD_M, TrackSimSource
from engine.config import load_track, load_track_reference
from engine.evidence import build_packet, focus_corner, lap_summary, worst_metric
from engine.models import ToolCall
from engine.plan import Goal, Plan
from engine.tools import numeric_leaves
from engine.track_agent import TrackAgentSession, TrackAgentTurn

FIX = Path(__file__).resolve().parent.parent / "fixtures"
TRACK = load_track(FIX / "track_monza.json")
REFS = load_track_reference(FIX / "track_monza_reference.json")
IDS = TRACK.ids
NAMES = {c.id: c.name for c in TRACK.corners}
REF_ATTEMPTS = {cid: r[0] for cid, r in REFS.items()}
VOICE = {"max_cue_words": 14, "max_reminder_words": 4}
BAD = {"ascari": {"board_m": DEFAULT_BOARD_M["ascari"] + 35}, "roggia": {"board_m": DEFAULT_BOARD_M["roggia"] + 25}}
VERY_BAD = {cid: {"board_m": DEFAULT_BOARD_M[cid] + 35} for cid in ("roggia", "lesmo1", "lesmo2", "ascari")}


def _sim_laps(knobs, laps=3.2):
    """{lap: {corner_id: (Attempt, trace)}} for the full laps the scorer decided on (lap >= 1)."""
    out: dict = {}

    async def go():
        src = TrackSimSource(TRACK, realtime=False, corners=knobs)
        sc = TrackScorer(TRACK, lambda *a: None, lambda n, r: out.update({n: dict(r)}), lambda e: None)
        dist, last = 0.0, src.pos
        async for s in src.samples():
            dist += (s.pos_m - last) % TRACK.length_m if s.pos_m != last else 0.0
            last = s.pos_m
            if dist >= laps * TRACK.length_m:
                src.stop()
                break
            sc.add(s)
    asyncio.run(go())
    return {n: r for n, r in out.items() if n >= 1}


def _packets(runs, previous=None):
    return {cid: build_packet(a, REF_ATTEMPTS[cid], a, TRACK.corner(cid), None,
                              (previous or {}).get(cid), voice=VOICE)
            for cid, (a, _) in runs.items()}


def _summary(lap, runs, packets, lap_time=84.3, top=3):
    att = {cid: a for cid, (a, _) in runs.items()}
    return lap_summary(lap, att, REF_ATTEMPTS, packets, NAMES, lap_time, top=top), att


@pytest.fixture(scope="module")
def laps():
    return _sim_laps(BAD)


@pytest.fixture(scope="module")
def very_bad():
    return _sim_laps(VERY_BAD, laps=2.2)[1]


@pytest.fixture
def lap1(laps):
    runs = laps[1]
    pk = _packets(runs)
    summary, att = _summary(1, runs, pk)
    return runs, pk, summary, att


# ---------------------------------------------------------------- worst_metric / lap_summary / focus_corner
def test_worst_metric_only_over_tolerance(lap1):
    runs, pk, summary, att = lap1
    assert worst_metric(pk["t1"]) is None  # ideal corner
    w = worst_metric(pk["ascari"])
    assert w["metric"] == "brake_onset_m" and w["tolerance"] == 5 and abs(w["delta"]) > 30


def test_worst_metric_none_when_invalid_or_not_comparable(lap1):
    _, pk, _, _ = lap1
    assert worst_metric({**pk["ascari"], "valid": False}) is None
    assert worst_metric({**pk["ascari"], "comparable": False}) is None


def test_worst_metric_picks_biggest_multiple_of_tolerance():
    p = {"valid": True, "comparable": True,
         "delta": {"brake_onset_m": -6.0, "release_s": 0.45, "throttle_pickup_m": 4.0},
         "tolerance": {"brake_onset_m": 5, "release_s": 0.15, "throttle_pickup_m": 5}}
    assert worst_metric(p)["metric"] == "release_s"  # 3x tolerance beats 1.2x


def test_lap_summary_top_sorted_by_time_lost_and_only_over_tolerance(lap1):
    runs, pk, summary, att = lap1
    top = summary["top"]
    assert {t["corner_id"] for t in top} == {"roggia", "ascari"}
    assert [t["time_lost_s"] for t in top] == sorted((t["time_lost_s"] for t in top), reverse=True)
    for t in top:
        assert t["worst"] is not None and t["name"] == NAMES[t["corner_id"]]
        assert t["attempt_id"] == f"L01-{t['corner_id']}"
        assert set(t["suggested"]) <= {"brake_point", "brake_release", "throttle_pickup"}
    assert summary["corners_scored"] == 6 and summary["invalid"] == []
    assert summary["lap"] == 1 and summary["last_lap_time_s"] == 84.3
    assert summary["delta_s"] > 0.1


def test_lap_summary_caps_top_at_three(very_bad):
    pk = _packets(very_bad)
    over = [cid for cid, p in pk.items() if worst_metric(p)]
    assert len(over) == 4
    summary, _ = _summary(1, very_bad, pk)
    assert len(summary["top"]) == 3
    lost = [t["time_lost_s"] for t in summary["top"]]
    assert lost == sorted(lost, reverse=True)
    # the dropped corner is the one losing the least of the four
    dropped = (set(over) - {t["corner_id"] for t in summary["top"]}).pop()
    assert min(lost) >= round(very_bad[dropped][0].section_s - REF_ATTEMPTS[dropped].section_s, 2)


def test_lap_summary_skips_invalid_runs(lap1):
    runs, pk, _, att = lap1
    att = dict(att)
    bad = att["ascari"]
    from dataclasses import replace
    att["ascari"] = replace(bad, valid=False, invalid_reason="pedal_dropout")
    pk = {**pk, "ascari": {**pk["ascari"], "valid": False}}
    s = lap_summary(1, att, REF_ATTEMPTS, pk, NAMES)
    assert [t["corner_id"] for t in s["top"]] == ["roggia"]
    assert s["invalid"] == [{"corner_id": "ascari", "reason": "pedal_dropout"}]


def test_focus_corner_is_top_zero(lap1):
    _, _, summary, att = lap1
    assert focus_corner(summary, att) == summary["top"][0]["corner_id"]


def test_focus_corner_without_top_is_first_valid(laps):
    clean = _sim_laps({}, laps=2.2)[1]
    pk = _packets(clean)
    summary, att = _summary(1, clean, pk)
    assert summary["top"] == []
    assert focus_corner(summary, att) == IDS[0]
    from dataclasses import replace
    att2 = {**att, IDS[0]: replace(att[IDS[0]], valid=False)}
    assert focus_corner(summary, att2) == IDS[1]


def test_summary_json_small(lap1, very_bad):
    _, _, summary, _ = lap1
    assert len(json.dumps(summary)) < 2048
    s2, _ = _summary(1, very_bad, _packets(very_bad))
    assert len(json.dumps(s2, separators=(",", ":"))) < 2048


# ---------------------------------------------------------------- TrackAgentSession
def make_session(laps, focus="roggia", upto=2):
    s = TrackAgentSession(TRACK, REFS)
    prev = None
    for n in range(1, upto + 1):
        runs = laps[n]
        pk = _packets(runs, prev)
        summary, att = _summary(n, runs, pk, lap_time=84.0 + n)
        s.add_lap(n, runs, pk, summary)
        s.note_lap_time(n, 84.0 + n)
        prev = att
    s.focus(focus)
    return s


def plan_packet(session, laps, cid="roggia", n=2):
    runs = laps[n]
    p = dict(session.corner_packets[cid])
    p.update({"corner_id": cid, "lap": session.laps[n]["summary"], "turn": "plan"})
    return p


def test_run_tool_driving_profile_default_and_explicit_corner(laps):
    s = make_session(laps)
    p = plan_packet(s, laps)
    aid = p["attempt_id"]
    assert aid == "L02-roggia"
    r = s.run_tool("get_driving_profile", {}, aid, p)
    assert r["corner_id"] == "roggia" and r["attempt_id"] == aid and r["profile"]["brake_board_m"] > DEFAULT_BOARD_M["roggia"]
    r = s.run_tool("get_driving_profile", {"attempt_id": aid}, aid, p)
    assert r["corner_id"] == "roggia"
    r = s.run_tool("get_driving_profile", {"corner_id": "ascari"}, aid, p)
    assert r["corner_id"] == "ascari" and r["attempt_id"] == "L02-ascari"
    assert r["profile"]["brake_board_m"] > DEFAULT_BOARD_M["ascari"] + 30 and r["reference"]["brake_board_m"] < DEFAULT_BOARD_M["ascari"] + 5


def test_run_tool_unknown_corner_is_an_error(laps):
    s = make_session(laps)
    p = plan_packet(s, laps)
    r = s.run_tool("get_driving_profile", {"corner_id": "nowhere"}, p["attempt_id"], p)
    assert "error" in r and "nowhere" in r["error"]
    # a bad corner does not mutate the caller's args or crash other tools
    assert "error" in s.run_tool("get_corner_info", {"corner_id": "nowhere"}, p["attempt_id"], p)
    assert s.run_tool("get_corner_info", {"corner_id": "ascari"}, p["attempt_id"], p)["name"] == "Ascari"


def test_get_lap_summary_current_previous_number(laps):
    s = make_session(laps)
    p = plan_packet(s, laps)
    aid = p["attempt_id"]
    cur = s.run_tool("get_lap_summary", {}, aid, p)
    assert cur["lap"] == 2 and cur["lap_time_s"] == 86.0
    assert s.run_tool("get_lap_summary", {"lap": "current"}, aid, p)["lap"] == 2
    prev = s.run_tool("get_lap_summary", {"lap": "previous"}, aid, p)
    assert prev["lap"] == 1 and prev["lap_time_s"] == 85.0
    assert s.run_tool("get_lap_summary", {"lap": "1"}, aid, p)["lap"] == 1
    assert s.run_tool("get_lap_summary", {"lap": 2}, aid, p)["lap"] == 2
    assert [c["corner_id"] for c in cur["corners"]] == IDS
    asc = next(c for c in cur["corners"] if c["corner_id"] == "ascari")
    assert asc["time_lost_s"] > 0.05 and asc["attempt_id"] == "L02-ascari"
    assert "error" in s.run_tool("get_lap_summary", {"lap": "9"}, aid, p)


def test_get_lap_summary_previous_on_first_lap_is_error(laps):
    s = make_session(laps, upto=1)
    p = plan_packet(s, laps, n=1)
    assert "error" in s.run_tool("get_lap_summary", {"lap": "previous"}, p["attempt_id"], p)


def test_get_session_history_has_lap_times_and_plan(laps):
    s = make_session(laps)
    p = plan_packet(s, laps)
    h = s.run_tool("get_session_history", {}, p["attempt_id"], p)
    assert [(x["lap"], x["lap_time_s"]) for x in h["lap_times"]] == [(1, 85.0), (2, 86.0)]
    assert h["plan"] is None and h["laps"] == []
    s.note({"action": "set_plan"})
    s.plan = Plan.from_goals([{"drill_id": "brake_point", "target": {"marker_m": 100}, "cue": "Brake.",
                               "corner_id": "ascari"}])
    s.plan.tolerances = {c.id: c.tolerance for c in TRACK.corners}
    h = s.run_tool("get_session_history", {}, p["attempt_id"], p)
    assert h["plan"]["goals"][0]["corner_id"] == "ascari"
    assert h["plan"]["goals"][0]["done_when"].endswith("within 5 m")
    assert h["laps"][0]["corner_id"] == "roggia" and h["laps"][0]["lap"] == 2


# ---------------------------------------------------------------- TrackAgentTurn
def call(p, goals, name="set_plan"):
    return ToolCall(name, {"attempt_id": p["attempt_id"], "goals": goals})


def default_marker(cid):
    """The brake_point marker the packet suggests at the reference board (reference rounded to 10 m)."""
    return int(round(DEFAULT_BOARD_M[cid], -1))


def goal(cid, drill="brake_point", cue=None, marker=None):
    marker = default_marker(cid) if marker is None else marker
    return {"corner_id": cid, "drill_id": drill, "target": {"marker_m": marker},
            "cue": cue or f"{NAMES[cid]}: brake at the {marker} m board."}


@pytest.fixture
def turn(laps):
    s = make_session(laps)
    p = plan_packet(s, laps)
    return s.turn(p, "plan"), p, s


def test_validate_same_drill_at_two_corners_is_valid(turn):
    t, p, _ = turn
    assert isinstance(t, TrackAgentTurn)
    ok, why = t.validate(call(p, [goal("roggia"), goal("ascari")]), p)
    assert ok, why


def test_validate_same_corner_and_drill_twice_rejected(turn):
    t, p, _ = turn
    ok, why = t.validate(call(p, [goal("ascari"), goal("ascari")]), p)
    assert not ok and "twice" in why and "ascari" in why


def test_validate_same_corner_two_different_drills_is_not_a_duplicate(turn):
    t, p, _ = turn
    g2 = {"corner_id": "ascari", "drill_id": "throttle_pickup", "target": {"marker_m": 20},
          "cue": "Ascari: throttle 20 m past the apex."}
    ok, why = t.validate(call(p, [goal("ascari"), g2]), p)
    # throttle_pickup delta at ascari is inside tolerance -> rejected for that reason, not as a duplicate
    assert not ok and "twice" not in why and "inside tolerance" in why


def test_validate_unknown_corner_rejected(turn):
    t, p, _ = turn
    ok, why = t.validate(call(p, [goal("roggia"), {**goal("roggia"), "corner_id": "nowhere"}]), p)
    assert not ok and "goal 2" in why and "unknown corner_id" in why


def test_validate_goal_inside_tolerance_rejected(turn):
    t, p, _ = turn
    ok, why = t.validate(call(p, [goal("t1")]), p)  # t1 is an ideal corner with a packet this lap
    assert not ok and "inside tolerance" in why


def test_validate_goal_defaults_to_packet_corner(turn):
    t, p, _ = turn
    g = goal("roggia")
    del g["corner_id"]
    c = call(p, [g])
    ok, why = t.validate(c, p)
    assert ok, why
    assert c.arguments["goals"][0]["corner_id"] == "roggia"


def test_validate_cue_number_from_other_corner_packet(turn, laps):
    t, p, s = turn
    asc = s.corner_packets["ascari"]
    known = numeric_leaves({**p, "tool_results": []})
    # a number that appears only in ascari's packet, not in roggia's packet or the lap summary
    num = next(v for k, v in asc["attempt"].items() if k in ("apex_kmh", "exit_kmh", "min_pos_m", "min_kmh")
               and float(v) not in known)
    cue = f"Ascari: entry was {num} km/h, brake at the {default_marker('ascari')} m board."
    ok, why = t.validate(call(p, [goal("ascari", cue=cue)]), p)
    assert ok, why
    # the same number quoted at roggia (the packet corner) is not in that goal's evidence
    ok, why = t.validate(call(p, [goal("roggia", cue=cue.replace("Ascari", "Roggia"))]), p)
    assert not ok and "not in evidence" in why


def test_validate_goal_at_corner_without_a_run_this_lap_rejected(laps):
    s = make_session(laps)
    p = plan_packet(s, laps)
    del s.corner_packets["ascari"]  # that corner did not score this lap
    ok, why = s.turn(p, "plan").validate(call(p, [goal("ascari")]), p)
    assert not ok and "no run at ascari" in why


def test_validate_rejects_goal_cue_over_word_limit(turn):
    t, p, _ = turn
    cue = "Roggia: " + " ".join(["brake"] * 20)
    ok, why = t.validate(call(p, [goal("roggia", cue=cue)]), p)
    assert not ok and "words" in why


def test_validate_goal_key_includes_corner(turn):
    t, p, _ = turn
    assert t._goal_key({"drill_id": "brake_point", "corner_id": "ascari"}) == ("brake_point", "ascari")
    assert t._goal_key({"drill_id": "brake_point"}) == ("brake_point", "roggia")


def test_schemas_have_corner_enums_and_lap_summary_is_read(turn):
    t, p, s = turn
    by = {x["function"]["name"]: x for x in t.schemas}
    for name in ("get_driving_profile", "get_splits", "compare_runs", "get_corner_info"):
        props = by[name]["function"]["parameters"]["properties"]
        assert props["corner_id"]["enum"] == IDS, name
    assert "get_lap_summary" in by
    assert "corner_id" not in by["get_lap_summary"]["function"]["parameters"]["properties"]
    goal_item = by["set_plan"]["function"]["parameters"]["properties"]["goals"]["items"]
    assert goal_item["properties"]["corner_id"]["enum"] == IDS
    assert "corner_id" in goal_item["required"]
    assert t.is_read("get_lap_summary") and t.is_read("get_driving_profile")
    assert not t.is_read("set_plan")
    assert [a["function"]["name"] for a in t.action_schemas] == list(t.actions)
    assert t.system_prompt == s.prompt and "Monza" in t.system_prompt


def test_turn_run_logs_and_reports_lap_summary(turn):
    t, p, _ = turn
    seen = []
    t.on_tool = seen.append
    res = t.run(ToolCall("get_lap_summary", {"lap": "current"}), 1)
    assert res["lap"] == 2 and t.results == [res]
    assert seen[0]["name"] == "get_lap_summary" and seen[0]["summary"].startswith("lap 2:")
    assert t.log[0]["error"] is None


def test_read_tool_as_final_action_rejected(turn):
    t, p, _ = turn
    ok, why = t.validate(ToolCall("get_lap_summary", {"attempt_id": p["attempt_id"]}), p)
    assert not ok and "action tool" in why


# ---------------------------------------------------------------- Plan
def test_plan_from_goals_keeps_corner_id():
    p = Plan.from_goals([
        {"drill_id": "brake_point", "target": {"marker_m": 100}, "cue": "a", "corner_id": "roggia"},
        {"drill_id": "brake_point", "target": {"marker_m": 100}, "cue": "b", "corner_id": "ascari"},
        {"drill_id": "brake_release", "target": {"release_s": 0.5}, "cue": "c"}])
    assert [g.corner_id for g in p.goals] == ["roggia", "ascari", ""]
    assert p.goals[0].status == "active" and p.goal.corner_id == "roggia"
    p.advance(True)
    assert p.goal.corner_id == "ascari"


def test_plan_to_dict_uses_per_corner_tolerances():
    p = Plan.from_goals([
        {"drill_id": "brake_point", "target": {"marker_m": 100}, "cue": "a", "corner_id": "roggia"},
        {"drill_id": "brake_point", "target": {"marker_m": 90}, "cue": "b", "corner_id": "ascari"},
        {"drill_id": "brake_release", "target": {"release_s": 0.5}, "cue": "c", "corner_id": "other",
         "in_a_row": 2}])
    p.tolerances = {"roggia": {"brake_onset_m": 5, "release_s": 0.15},
                    "ascari": {"brake_onset_m": 9, "release_s": 0.3}}
    d = p.to_dict({"brake_onset_m": 1, "release_s": 0.01})  # fallback for corners not in tolerances
    goals = d["goals"]
    assert goals[0]["done_when"] == "brake at the 100 m board, within 5 m"
    assert goals[1]["done_when"] == "brake at the 90 m board, within 9 m"
    assert goals[2]["done_when"] == "release over 0.5 s, within 0.01 s, 2 times in a row"
    assert [g["corner_id"] for g in goals] == ["roggia", "ascari", "other"]


def test_goal_corner_id_default_empty():
    assert Goal("brake_point", {"marker_m": 100}, "x").corner_id == ""
