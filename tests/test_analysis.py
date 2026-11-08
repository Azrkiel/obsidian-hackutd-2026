import ctypes

import pytest

from coach.telemetry import SPageFileGraphic, SPageFilePhysics, parse_sample
from engine.analysis import (compare_runs, delta_trace, driving_profile, splits, time_at, times)


def make_trace(corner, speed=lambda p: 100.0, brake=lambda p: 0.0, gas=lambda p: 0.0,
               steer=lambda p: 0.0, yaw=lambda p: 0.0, slip_f=lambda p: 0.0, slip_r=lambda p: 0.0,
               with_time=True, step=2.0):
    rows, t, p = [], 0.0, corner.start_gate_m
    while p <= corner.exit_gate_m + 1e-9:
        if rows:
            v = (speed(p) + speed(p - step)) / 2 / 3.6
            t += step / v
        row = [p, brake(p), gas(p), speed(p)]
        if with_time:
            row += [t, steer(p), yaw(p), slip_f(p), slip_r(p)]
        rows.append(row)
        p += step
    return rows


def test_times_from_column_and_integrated(corner):
    tr = make_trace(corner, speed=lambda p: 72.0)  # 20 m/s
    assert times(tr)[-1] == pytest.approx(300 / 20)
    bare = [r[:4] for r in tr]
    assert times(bare)[-1] == pytest.approx(300 / 20)
    assert time_at(tr, 250.0) == pytest.approx(0.5)  # interpolated between the 248 and 250 rows
    assert time_at(tr, 100.0) is None


def test_profile_known_answers(corner):
    # constant 72 km/h = 20 m/s, 0.1 s per 2 m sample
    brake = lambda p: 1.0 if 300 <= p < 340 else max(0.0, 1.0 - (p - 340) / 20) if 340 <= p < 360 else 0.0
    gas = lambda p: 1.0 if p >= 480 else 0.5 if p >= 470 else 0.0
    steer = lambda p: 0.2 if 330 <= p < 420 else 0.0
    slip_f = lambda p: 0.3 if 310 <= p < 320 else 0.0
    speed = lambda p: 72.0 if p != 456 else 60.0
    tr = make_trace(corner, speed=speed, brake=brake, gas=gas, steer=steer, slip_f=slip_f)
    pr = driving_profile(tr, corner)
    assert pr["brake_onset_m"] == 300 and pr["brake_board_m"] == 140
    assert pr["peak_brake"] == 1.0 and pr["brake_style"] == "stabbing"
    # last row >= 90% of peak is 340 (and 342 at 0.9); brake < 0.1 first at 358 -> 16 m = 0.8 s
    assert pr["release_s"] == pytest.approx(0.8, abs=0.11)
    # braking zone 300..356 (29 rows), steering from 330: 14 rows
    assert pr["trail_brake_share"] == pytest.approx(14 / 29, abs=0.04)
    assert pr["lockup_s"] == pytest.approx(0.5, abs=0.11)  # 310..318: 5 rows of 0.1 s
    assert pr["wheelspin_s"] == 0.0
    assert pr["min_kmh"] == 60.0 and pr["min_pos_m"] == 456
    assert pr["min_vs_apex_m"] == pytest.approx(456 - 458)
    assert pr["throttle_pickup_m"] == 470 and pr["pickup_after_apex_m"] == 2
    assert pr["coast_s"] > 0
    assert "on the apex" in pr["style"]


def test_profile_without_extra_columns(corner):
    tr = [r[:4] for r in make_trace(corner, brake=lambda p: 0.8 if 320 <= p < 400 else 0.0,
                                    gas=lambda p: 1.0 if p > 480 else 0.0)]
    pr = driving_profile(tr, corner)
    assert pr["trail_brake_share"] is None and pr["lockup_s"] is None
    assert pr["understeer_index"] is None
    assert pr["release_s"] is not None


def test_understeer_index_relative(corner):
    yaw = lambda p: 0.5 if 420 <= p <= 540 else 0.0
    neutral = make_trace(corner, steer=lambda p: 0.2 if 420 <= p <= 540 else 0.0, yaw=yaw)
    pushing = make_trace(corner, steer=lambda p: 0.3 if 420 <= p <= 540 else 0.0, yaw=yaw)
    a, b = driving_profile(neutral, corner)["understeer_index"], driving_profile(pushing, corner)["understeer_index"]
    assert b == pytest.approx(a * 1.5, rel=0.02)


def test_splits_add_up_and_delta(corner):
    ref = make_trace(corner, speed=lambda p: 100.0)
    slow_brake = make_trace(corner, speed=lambda p: 90.0 if 290 <= p < 418 else 100.0)
    sp = splits(slow_brake, ref, corner)
    names = [s["sector"] for s in sp["sectors"]]
    assert names == ["approach", "braking", "entry", "apex", "exit"]
    corner_time = time_at(slow_brake, corner.exit_gate_m) - time_at(slow_brake, corner.start_gate_m)
    assert sp["total_s"] == pytest.approx(corner_time, abs=1e-3)
    by = {s["sector"]: s for s in sp["sectors"]}
    assert by["braking"]["delta_s"] > 0.1 and abs(by["exit"]["delta_s"]) < 1e-3
    assert sp["summary"].startswith("you lose") and "braking" in sp["summary"]
    assert sp["total_delta_s"] == pytest.approx(sum(s["delta_s"] for s in sp["sectors"]), abs=1e-3)
    dt = sp["delta_trace"]
    assert dt[0] == [240.0, 0.0] and dt[-1][1] == pytest.approx(sp["total_delta_s"], abs=0.01)


def test_splits_without_reference(corner):
    sp = splits(make_trace(corner), None, corner)
    assert "summary" not in sp and sp["total_s"] > 0


def test_gate_override(corner):
    corner.gates = {"brake_m": 330.0, "turn_in_m": 400.0}
    tr = make_trace(corner)
    sp = splits(tr, tr, corner)
    assert sp["sectors"][0]["to_m"] == 330.0 and sp["sectors"][1]["to_m"] == 400.0


def test_compare_runs():
    d = compare_runs({"release_s": 0.3, "style": "V line", "x": None},
                     {"release_s": 0.5, "style": "U line"})
    assert d == {"release_s": -0.2, "style": {"a": "V line", "b": "U line"}}


@pytest.mark.skipif(ctypes.sizeof(ctypes.c_wchar) != 2, reason="AC layout assumes 2-byte wchar (Windows)")
def test_physics_extras_offsets_and_parse():
    # offsets from the CSP / Kunos shared-memory docs for original AC
    assert SPageFilePhysics.accG.offset == 44 and SPageFilePhysics.wheelSlip.offset == 56
    assert SPageFilePhysics.wheelLoad.offset == 72 and SPageFilePhysics.localAngularVel.offset == 296
    phys = SPageFilePhysics(packetId=3, speedKmh=200.0)
    phys.accG[0], phys.accG[2] = 1.5, -3.0
    phys.localAngularVel[1] = 0.4
    for i, v in enumerate([0.1, 0.3, 0.05, 0.2]):
        phys.wheelSlip[i] = v
    for i, v in enumerate([3000.0, 3100.0, 4000.0, 4100.0]):
        phys.wheelLoad[i] = v
    gfx = SPageFileGraphic(packetId=3, status=2, normalizedCarPosition=0.5)
    s = parse_sample(SPageFilePhysics.from_buffer_copy(bytes(phys)), gfx, 1000.0, t=0.0)
    assert (s.g_lat, s.g_lon, s.yaw_rate) == pytest.approx((1.5, -3.0, 0.4))
    assert (s.slip_f, s.slip_r) == pytest.approx((0.3, 0.2))
    assert (s.load_f, s.load_r) == (6100.0, 8100.0)
