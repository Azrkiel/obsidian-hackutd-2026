import importlib.util
import json
import math
import struct
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location("ac_track_extract", ROOT / "scripts" / "ac_track_extract.py")
ate = importlib.util.module_from_spec(_spec)
sys.modules["ac_track_extract"] = ate
_spec.loader.exec_module(ate)

STEP = 2.0
LAP = 1000.0
APEX1, APEX2 = 450.0, 500.0
BRAKE_START = 340.0
R = (LAP + STEP) / (2 * math.pi)


def _radius(s):
    r1 = 40 + 0.5 * (s - APEX1) ** 2
    r2 = 35 + 0.5 * (s - APEX2) ** 2
    return min(5000.0, r1, r2)


def _speed_ms(s):
    pts = [(0, 85), (340, 85), (450, 20), (475, 18), (500, 20), (600, 50), (LAP, 50)]
    for (s0, v0), (s1, v1) in zip(pts, pts[1:]):
        if s0 <= s <= s1:
            return v0 + (v1 - v0) * (s - s0) / (s1 - s0)
    return pts[-1][1]


def _brake(s):
    return 0.9 if BRAKE_START <= s <= 440 else 0.0


def _gas(s):
    if s < BRAKE_START:
        return 1.0
    return 0.5 if s >= 486 else 0.0


def make_file(path, brake=True, version=7):
    n = int(LAP / STEP) + 1
    out = struct.pack("<4i", version, n, 0, 0)
    for i in range(n):
        s = i * STEP
        ang = 2 * math.pi * s / (LAP + STEP)  # closed loop so lap_length() is meaningful
        out += struct.pack("<4fi", R * math.cos(ang), R * math.sin(ang), 0.0, s, i)
    out += struct.pack("<i", n)
    for i in range(n):
        s = i * STEP
        out += struct.pack(
            "<18f", _speed_ms(s), _gas(s), _brake(s) if brake else 0.0, 0.0, _radius(s),
            6.0, 7.0, 0.01, 0.0, 0.0, 1.0, 0.0, STEP, 1.0, 0.0, 0.0, 0.0, 0.02,
        )
    out += struct.pack("<i", 0)  # no grid
    path.write_bytes(out)
    return path


@pytest.fixture
def lane(tmp_path):
    return make_file(tmp_path / "fast_lane.ai")


@pytest.fixture
def base_corner():
    return json.loads((ROOT / "fixtures" / "corner_monza_t1.json").read_text())


def test_parse_round_trip(lane):
    pts = ate.parse_file(lane)
    assert len(pts) == 501
    p = pts[225]  # s = 450
    assert p.dist_m == pytest.approx(450.0)
    assert p.id == 225
    assert p.speed_kmh == pytest.approx(20 * 3.6)
    assert p.radius == pytest.approx(40.0)
    assert p.side_left == pytest.approx(6.0) and p.side_right == pytest.approx(7.0)
    assert p.camber == pytest.approx(0.01) and p.grade == pytest.approx(0.02)
    assert pts[180].brake == pytest.approx(0.9) and pts[0].gas == 1.0


def test_unknown_version_and_truncation(tmp_path):
    bad = make_file(tmp_path / "v8.ai", version=8)
    with pytest.raises(ate.AiFormatError, match="version 8"):
        ate.parse_file(bad)
    good = make_file(tmp_path / "ok.ai")
    (tmp_path / "cut.ai").write_bytes(good.read_bytes()[:5000])
    with pytest.raises(ate.AiFormatError, match="truncated"):
        ate.parse_file(tmp_path / "cut.ai")


def test_find_chicane_gates(lane):
    ch = ate.find_chicane(ate.parse_file(lane), (0, 800), board_zero_m=440)
    assert ch.apex1_m == pytest.approx(APEX1, abs=2)
    assert ch.apex2_m == pytest.approx(APEX2, abs=2)
    assert ch.turn_in_m == pytest.approx(437, abs=4)   # 40 + .5 d^2 = 120 -> d ~ 12.6
    assert ch.exit_m == pytest.approx(514.5, abs=4)    # 35 + .5 d^2 = 140 -> d ~ 14.5
    assert ch.brake_m == BRAKE_START and not ch.brake_from_fallback
    assert ch.slowest_m == pytest.approx(476, abs=2)


def test_build_corner_keeps_other_keys(lane, base_corner):
    pts = ate.parse_file(lane)
    ch = ate.find_chicane(pts, (0, 800), base_corner["board_zero_m"])
    c = ate.build_corner(base_corner, ch, ate.lap_length(pts))
    assert c["start_gate_m"] == BRAKE_START - 250
    assert c["apex_window_m"] == [450.0, 500.0]
    assert c["exit_gate_m"] == pytest.approx(514.5, abs=4)
    assert c["track_length_m"] == pytest.approx(1002.0, abs=3)
    assert c["gates"]["brake_m"] == BRAKE_START
    assert c["gates"]["turn_in_m"] < c["gates"]["apex1_m"] < c["gates"]["apex2_m"]
    assert c["_source"] == "fast_lane.ai v7"
    for k in ("board_zero_m", "tolerance", "allowed", "name", "comparable_entry_kmh"):
        assert c[k] == base_corner[k]
    assert base_corner["start_gate_m"] == 240  # input not mutated


def test_brake_fallback_when_all_zero(tmp_path, base_corner):
    pts = ate.parse_file(make_file(tmp_path / "nobrake.ai", brake=False))
    ch = ate.find_chicane(pts, (0, 800), base_corner["board_zero_m"])
    assert ch.brake_from_fallback
    assert ch.brake_m == base_corner["board_zero_m"] - 150
    c = ate.build_corner(base_corner, ch, ate.lap_length(pts))
    assert c["start_gate_m"] == base_corner["board_zero_m"] - 150 - 250


def test_reference_sane(lane, base_corner):
    pts = ate.parse_file(lane)
    ch = ate.find_chicane(pts, (0, 800), base_corner["board_zero_m"])
    corner = ate.build_corner(base_corner, ch, ate.lap_length(pts))
    ref = ate.build_reference(pts, corner)
    a, tr = ref["attempt"], ref["trace"]
    core = {"attempt_id", "valid", "invalid_reason", "entry_kmh", "apex_kmh", "exit_kmh",
            "brake_onset_m", "peak_brake", "throttle_pickup_m", "section_s"}
    assert core <= set(a) <= set(json.loads((ROOT / "fixtures" / "reference.json").read_text()))
    assert a["attempt_id"] == "ai" and a["valid"] is True and a["invalid_reason"] is None
    assert a["entry_kmh"] == pytest.approx(85 * 3.6, abs=0.5)
    assert a["apex_kmh"] == pytest.approx(18 * 3.6, abs=0.5)
    assert a["exit_kmh"] > a["apex_kmh"]
    assert a["brake_onset_m"] == BRAKE_START
    assert a["peak_brake"] == pytest.approx(0.9)
    assert a["throttle_pickup_m"] == pytest.approx(486, abs=2)
    assert 0 < a["section_s"] < 15
    assert tr[0][0] == corner["start_gate_m"]
    assert tr[-1][0] == pytest.approx(corner["exit_gate_m"])
    assert all(b - a_ == pytest.approx(2.0) for (a_, *_), (b, *_) in zip(tr[:-2], tr[1:-1]))
    assert all(len(row) == 4 for row in tr)


def test_cli_end_to_end(tmp_path, lane, capsys):
    out, ref = tmp_path / "corner.json", tmp_path / "ref.json"
    csv_path = tmp_path / "pts.csv"
    rc = ate.main([str(tmp_path), "--out", str(out), "--ref-out", str(ref),
                   "--window", "0", "800", "--dump", str(csv_path)])
    assert rc == 0
    text = capsys.readouterr().out
    assert "start_gate_m: 240 -> 90.0" in text  # diff printed
    assert json.loads(out.read_text())["gates"]["brake_m"] == BRAKE_START
    assert "trace" in json.loads(ref.read_text())
    assert len(csv_path.read_text().splitlines()) == 502


def test_cli_unknown_version_fails_cleanly(tmp_path, capsys):
    bad = make_file(tmp_path / "fast_lane.ai", version=9)
    assert ate.main([str(bad)]) == 1
    assert "version 9" in capsys.readouterr().err


# --- whole lap -------------------------------------------------------------------

from engine.config import load_track, load_track_reference  # noqa: E402

WL_LAP = 3000.0
WL_BRAKES = [(540.0, 640.0), (1350.0, 1480.0), (2250.0, 2380.0)]   # chicane, single, single
WL_PICKUPS = [710.0, 1520.0, 2420.0]
WL_SPEED = [(0, 80), (540, 80), (650, 20), (675, 18), (700, 20), (800, 80), (1350, 80), (1500, 20),
            (1600, 60), (1700, 80), (2250, 80), (2400, 20), (2500, 60), (2600, 80), (WL_LAP, 80)]


def _wl_radius(s):
    rs = [40 + 0.5 * (s - 650) ** 2, 35 + 0.5 * (s - 700) ** 2,
          40 + 0.5 * (s - 1500) ** 2, 40 + 0.5 * (s - 2400) ** 2]
    return min([5000.0] + rs)


def _wl_speed(s):
    for (s0, v0), (s1, v1) in zip(WL_SPEED, WL_SPEED[1:]):
        if s0 <= s <= s1:
            return v0 + (v1 - v0) * (s - s0) / (s1 - s0)
    return WL_SPEED[-1][1]


def make_lap_file(path, brake=True):
    n = int(WL_LAP / STEP) + 1
    rr = (WL_LAP + STEP) / (2 * math.pi)
    out = struct.pack("<4i", 7, n, 0, 0)
    for i in range(n):
        s = i * STEP
        ang = 2 * math.pi * s / (WL_LAP + STEP)
        out += struct.pack("<4fi", rr * math.cos(ang), rr * math.sin(ang), 0.0, s, i)
    out += struct.pack("<i", n)
    for i in range(n):
        s = i * STEP
        braking = any(a <= s <= b for a, b in WL_BRAKES)
        coast = any(a <= s < p for (a, _), p in zip(WL_BRAKES, WL_PICKUPS))
        out += struct.pack("<18f", _wl_speed(s), 0.0 if coast else 1.0, 0.9 if braking and brake else 0.0,
                           0.0, _wl_radius(s), 6.0, 7.0, 0.01, 0.0, 0.0, 1.0, 0.0, STEP,
                           1.0, 0.0, 0.0, 0.0, 0.02)
    out += struct.pack("<i", 0)
    path.write_bytes(out)
    return path


@pytest.fixture
def wl_points(tmp_path):
    return ate.parse_file(make_lap_file(tmp_path / "fast_lane.ai"))


WL_BASE = {
    "name": "Testring", "length_m": 3000,
    "defaults": {"wheelbase_m": 2.5, "comparable_entry_kmh": 7,
                 "tolerance": {"brake_onset_m": 5}, "allowed": {"drills": ["brake_point"]}},
    "corners": [
        {"id": "first", "name": "First Chicane", "start_gate_m": 200, "board_zero_m": 555,
         "apex_window_m": [640, 710], "exit_gate_m": 760},
        {"id": "hairpin", "name": "The Hairpin", "start_gate_m": 1000, "board_zero_m": 1400,
         "apex_window_m": [1490, 1510], "exit_gate_m": 1560},
        {"id": "far", "name": "Far Away", "start_gate_m": 1700, "board_zero_m": 1800,
         "apex_window_m": [1850, 1870], "exit_gate_m": 1900},
    ],
}


def _wl_track(points, base=WL_BASE):
    zones = ate.find_braking_zones(points)
    return ate.build_track(base, ate.build_zone_corners(points, zones, ate.lap_length(points)),
                           ate.lap_length(points))


def test_find_braking_zones(wl_points):
    zones = ate.find_braking_zones(wl_points)
    assert [z.brake_m for z in zones] == pytest.approx([540, 1350, 2250], abs=5)
    assert [z.slowest_m for z in zones] == pytest.approx([675, 1500, 2400], abs=5)
    assert not any(z.fallback for z in zones)


def test_merge_close_brake_runs(wl_points):
    assert len(ate.find_braking_zones(wl_points, min_gap_m=1000.0)) == 1


def test_zero_brake_fallback(tmp_path):
    pts = ate.parse_file(make_lap_file(tmp_path / "nobrake.ai", brake=False))
    zones = ate.find_braking_zones(pts)
    assert all(z.fallback for z in zones)
    assert [z.brake_m for z in zones] == pytest.approx([540, 1350, 2250], abs=5)
    assert [z.slowest_m for z in zones] == pytest.approx([675, 1500, 2400], abs=5)
    corners = ate.build_zone_corners(pts, zones, ate.lap_length(pts))
    assert all(c["_fallback"] for c in corners)


def test_zone_corners_chicane_and_single_apex(wl_points):
    zones = ate.find_braking_zones(wl_points)
    c1, c2, c3 = ate.build_zone_corners(wl_points, zones, ate.lap_length(wl_points))
    assert c1["apex_window_m"] == pytest.approx([650, 700], abs=2)       # chicane: apex1..apex2
    assert c2["apex_window_m"] == pytest.approx([1490, 1510], abs=2)     # single apex +-10
    assert c3["apex_window_m"] == pytest.approx([2390, 2410], abs=2)
    assert c2["start_gate_m"] == pytest.approx(1350 - 250, abs=5)
    assert c2["gates"]["brake_m"] == pytest.approx(1350, abs=5)
    assert c2["gates"]["turn_in_m"] < c2["gates"]["apex1_m"] < c2["gates"]["apex2_m"] < c2["exit_gate_m"]


def test_start_gate_clamped_after_previous_exit(wl_points):
    zones = [ate.BrakingZone(540.0, 675.0, False), ate.BrakingZone(760.0, 800.0, False)]
    c1, c2 = ate.build_zone_corners(wl_points, zones, ate.lap_length(wl_points))
    assert c2["start_gate_m"] == c1["exit_gate_m"] + 10


def test_build_track_reuses_base_ids(wl_points):
    t = _wl_track(wl_points)
    assert [c["id"] for c in t["corners"]] == ["first", "hairpin", "c3"]
    assert t["corners"][0]["name"] == "First Chicane" and t["corners"][0]["board_zero_m"] == 555
    assert t["corners"][2]["board_zero_m"] == pytest.approx(2250 + 100, abs=5)
    assert t["name"] == "Testring" and t["defaults"] == WL_BASE["defaults"]
    assert t["length_m"] == pytest.approx(3002, abs=3)


def test_build_track_without_base(wl_points):
    t = _wl_track(wl_points, None)
    assert [c["id"] for c in t["corners"]] == ["c1", "c2", "c3"]
    assert t["corners"][0]["board_zero_m"] == pytest.approx(640, abs=5)
    assert t["defaults"]["tolerance"] and t["defaults"]["allowed"]


def test_track_loads_without_overlap_and_talk_zones_wrap(tmp_path, wl_points):
    t = _wl_track(wl_points)
    f = tmp_path / "track.json"
    f.write_text(json.dumps(t))
    track = load_track(f)
    cs = track.corners
    assert all(a.exit_gate_m < b.start_gate_m for a, b in zip(cs, cs[1:]))
    assert len(track.talk_zones) == 3
    a, b = track.talk_zones[-1]
    assert a > b and a == pytest.approx(cs[-1].exit_gate_m + 20, abs=0.2)   # wraps the lap line
    assert b == pytest.approx(cs[0].start_gate_m - 20, abs=0.2)
    assert track.talk_zones[0][0] == pytest.approx(cs[0].exit_gate_m + 20, abs=0.2)
    assert track.talk_zones[0][1] == pytest.approx(cs[1].start_gate_m - 20, abs=0.2)
    for prev, c in zip(cs, cs[1:]):
        assert c.reminder_m == pytest.approx(max(prev.exit_gate_m + 20, c.start_gate_m - 200), abs=0.2)
    assert track.corner("hairpin").wheelbase_m == 2.5   # base defaults merged


def test_track_reference_loads(tmp_path, wl_points):
    t = _wl_track(wl_points)
    ref = ate.build_track_reference(wl_points, t)
    assert ref["source"] == "fast_lane.ai v7"
    assert 40 < ref["lap_time_s"] < 90
    f = tmp_path / "ref.json"
    f.write_text(json.dumps(ref))
    loaded = load_track_reference(f)
    assert set(loaded) == {"first", "hairpin", "c3"}
    att, trace = loaded["hairpin"]
    assert att.apex_kmh == pytest.approx(20 * 3.6, abs=1) and trace


def test_cli_track_end_to_end(tmp_path, capsys):
    make_lap_file(tmp_path / "fast_lane.ai")
    base = tmp_path / "base.json"
    base.write_text(json.dumps(WL_BASE))
    out, ref = tmp_path / "track.json", tmp_path / "track_ref.json"
    rc = ate.main([str(tmp_path), "--track", str(base), "--track-out", str(out), "--track-ref-out", str(ref)])
    assert rc == 0
    text = capsys.readouterr().out
    assert "first: brake_m=540" in text and "c3: brake_m=2250" in text
    track = load_track(out)
    assert track.ids == ["first", "hairpin", "c3"]
    assert set(load_track_reference(ref)) == set(track.ids)


def test_cli_track_fallback_warns(tmp_path, capsys):
    make_lap_file(tmp_path / "fast_lane.ai", brake=False)
    out = tmp_path / "track.json"
    assert ate.main([str(tmp_path), "--track-out", str(out)]) == 0
    assert "speed minimum" in capsys.readouterr().err
    assert len(load_track(out).corners) == 3
