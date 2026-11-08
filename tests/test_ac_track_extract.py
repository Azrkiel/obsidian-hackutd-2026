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
