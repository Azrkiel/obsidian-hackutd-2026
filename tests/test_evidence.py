from engine.evidence import build_packet
from engine.models import DrillState
from conftest import attempt


def test_deltas_and_signs(mk_packet):
    p = mk_packet("late_brake")
    assert p["phase"] == "baseline" and p["drill"] is None and p["target_gap"] is None
    d = p["delta"]
    assert d["brake_onset_m"] == 14.2  # positive = braked later
    assert d["peak_brake"] == -0.08
    assert d["entry_kmh"] == 1.3 and d["apex_kmh"] == -4.1 and d["exit_kmh"] == -2.0
    assert d["section_s"] == 0.41
    assert p["vs_previous"] is None


def test_board_numbers(mk_packet):
    p = mk_packet("late_brake")
    assert p["reference"]["brake_board_m"] == 100.0
    assert p["attempt"]["brake_board_m"] == 85.8
    assert {k: p["suggested"][k] for k in ("brake_point", "throttle_pickup", "brake_release")} == {"brake_point": 100, "throttle_pickup": 20, "brake_release": 0.5}


def test_comparable(mk_packet):
    assert mk_packet("clean")["comparable"] is True
    assert mk_packet("not_comparable")["comparable"] is False


def test_invalid(mk_packet):
    p = mk_packet("invalid")
    assert p["valid"] is False and p["invalid_reason"] == "off_track"


def test_retry_target_gap_and_prev(mk_packet):
    p = mk_packet("retry_close", retry_of="late_brake")
    assert p["phase"] == "retry"
    assert p["drill"]["id"] == "brake_point" and p["drill"]["tries"] == 1
    assert p["target_gap"] == {"brake_onset_m": 9.0}  # 349 vs target onset 340
    assert p["vs_previous"]["brake_onset_m"] == -5.2  # 349 - 354.2
    assert p["drill"]["baseline_delta"]["brake_onset_m"] == 14.2


def test_retry_throttle_gap(corner, ref):
    a = attempt("early_throttle")
    ds = DrillState("throttle_pickup", {"marker_m": 20}, 1)
    p = build_packet(a, ref, a, corner, ds, a)
    assert p["target_gap"] == {"throttle_pickup_m": -12.0}  # 476 vs 468+20
    assert p["suggested"]["adjusted_marker_m"] == 10
