"""Whole-lap track model: extractor on the synthetic Monza line, and coach.track."""
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import ac_track_extract as ex  # noqa: E402
import synth_track  # noqa: E402

from coach.track import DEFAULT_TRACK, Track  # noqa: E402
from engine.config import load_corner  # noqa: E402

NAMES = synth_track.MONZA_NAMES


@pytest.fixture(scope="module")
def points():
    return ex.parse_bytes(synth_track.ai_bytes(synth_track.monza_points()))  # through the file format


@pytest.fixture(scope="module")
def track():
    return Track.load()


def test_synthetic_file_round_trips(points):
    assert len(points) == int(synth_track.LAP_M / synth_track.STEP_M)
    assert ex.lap_length(points) == pytest.approx(synth_track.LAP_M, abs=1)
    assert max(p.speed_kmh for p in points) == pytest.approx(synth_track.VMAX_KMH, abs=0.5)


def test_every_monza_corner_found(points):
    corners = ex.find_corners(points, NAMES)
    assert [c["name"] for c in corners] == NAMES
    kinds = {c["name"]: c["kind"] for c in corners}
    assert kinds["Curva Grande"] == "flat" and kinds.pop("Curva Grande") and set(kinds.values()) == {"brake"}
    by = {c["name"]: c for c in corners}
    assert len(by["Rettifilo"]["apex_m"]) == 2 and len(by["Ascari"]["apex_m"]) == 3   # chicanes = one corner
    for prev, c in zip(corners, corners[1:]):
        assert prev["exit_m"] < c["entry_m"]                                           # no overlap
    for c in corners:
        assert c["entry_m"] <= (c["brake_m"] or c["turn_in_m"]) <= c["turn_in_m"] + 20
        assert c["apex_window_m"][0] < c["apex_window_m"][1] < c["exit_m"]
        assert c["ai"]["segment_s"] > 0
    # the brake point is where the AI starts braking for this corner, not the corner before
    assert by["Roggia"]["brake_m"] > by["Curva Grande"]["exit_m"]
    assert by["Ascari"]["brake_m"] < by["Ascari"]["turn_in_m"]


def test_wrong_number_of_names(points):
    with pytest.raises(ex.AiFormatError, match="7 corners"):
        ex.find_corners(points, NAMES[:3])


def test_cli_writes_the_track(tmp_path):
    ai = tmp_path / "fast_lane.ai"
    ai.write_bytes(synth_track.ai_bytes(synth_track.monza_points()))
    out = tmp_path / "monza.json"
    assert ex.main([str(ai), "--model-out", str(out), "--names", ",".join(NAMES)]) == 0
    t = Track.load(out)
    assert [c.name for c in t.corners] == NAMES and t.length_m == pytest.approx(5793, abs=1)


def test_committed_track_matches_the_lap_coach_config(track):
    import track_model
    from engine.config import load_track
    fresh = track_model.build(ROOT / "fixtures" / "track_monza.json")
    assert [c.id for c in track.corners] == [c["id"] for c in fresh["corners"]]   # regenerate if this fails
    lap = load_track(ROOT / "fixtures" / "track_monza.json")
    for c in lap.corners:                     # same gates as the lap coach, plus Curva Grande
        m = track.get(c.id)
        assert (m.entry_m, m.exit_m, m.apex_window_m) == (c.start_gate_m, c.exit_gate_m, c.apex_window_m)
    assert [c.id for c in track.corners if c.id not in lap.ids] == ["curva_grande"]
    assert DEFAULT_TRACK.exists()


def test_lookups(track):
    r = track.get("t1")
    assert r.name == "Rettifilo" and track.corner_at(r.apex_m[0]) is r
    assert track.corner_at(r.exit_m + 50) is None
    assert track.next_corner(r.exit_m + 1).name == "Curva Grande"
    assert track.next_corner(track.length_m - 10).name == "Rettifilo"   # wraps past the line
    assert track.ai_kmh(r.apex_m[0]) < 120 < track.ai_kmh(100)


def test_anchor_is_lead_time_before_the_brake_point(track):
    for c in track.corners:
        for lead in (3.0, 4.0, 6.0):
            a = track.anchor_m(c, lead)
            assert track.ai_time(a, c.key_m) == pytest.approx(lead, abs=0.05)
    r = track.get("t1")
    assert 0 < track.anchor_m(r, 4.0) < r.brake_m - 300          # ~350 m out at 787B speed
    s = track.anchor_splines(4.0)
    assert len(s) == 7 and all(0 <= x < 1 for x in s)


def test_flat_corner_anchors_on_turn_in(track):
    cg = track.get("curva_grande")
    assert cg.major_only and cg.brake_m is None and cg.key_m == cg.turn_in_m


def test_corner_config_for_the_existing_pieces(track):
    base = load_corner(ROOT / "fixtures" / "corner_monza_t1.json")
    les = track.corner_config(track.get("lesmo1"), base)
    assert les.name == "Lesmo 1" and les.start_gate_m == track.get("lesmo1").entry_m
    assert les.gate("brake_m") == track.get("lesmo1").brake_m and les.tolerance == base.tolerance
    cg = track.corner_config(track.get("curva_grande"), base)
    assert cg.allowed["drills"] == [] and base.allowed["drills"]   # base not mutated
