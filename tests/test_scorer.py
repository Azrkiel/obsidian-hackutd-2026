from dataclasses import replace

import pytest

from coach.scorer import CornerScorer
from coach.telemetry import Sample

DT = 0.01


def profile(u, brake_u=300.0, apex_u=448.0, pick_u=480.0):
    """(speed km/h, gas, brake) at unwrapped position u; linear pieces so interpolation is exact."""
    if u < brake_u:
        return 180 + 0.25 * (u - brake_u), 1.0, 0.0
    if u < apex_u:
        return 180 - 110 * (u - brake_u) / (apex_u - brake_u), 0.0, 0.8
    if u < pick_u:
        return 70.0, 0.0, 0.0
    return 70 + (u - pick_u) * 50 / 60, 0.5, 0.0


def drive(L, u0, u1, step=0.5, v=50.0, **kw):
    """Samples from unwrapped u0 to u1; t = (u-u0)/v so section time is exact."""
    out, i = [], 0
    while True:
        u = u0 + i * step
        if u > u1:
            return out
        sp, gas, br = profile(u, **kw)
        out.append(Sample(i * step / v, i, "live", (u % L) / L, u % L, sp, gas, br, 0, 0, 0, 0))
        i += 1


def run(corner, samples, **kw):
    got = []
    sc = CornerScorer(corner, lambda a, tr: got.append((a, tr)), **kw)
    for s in samples:
        sc.add(s)
    return got, sc


def test_metrics(corner):
    got, _ = run(corner, drive(corner.track_length_m, 200, 600))
    assert len(got) == 1
    a, trace = got[0]
    assert a.attempt_id == "a-0001" and a.valid and a.invalid_reason is None
    assert a.brake_onset_m == pytest.approx(300, abs=0.5)
    assert a.peak_brake == pytest.approx(0.8)
    assert a.entry_kmh == pytest.approx(165.0, abs=0.01)
    assert a.apex_kmh == pytest.approx(70.0)
    assert a.throttle_pickup_m == pytest.approx(480, abs=0.5)
    assert a.exit_kmh == pytest.approx(120.0, abs=0.01)
    assert a.section_s == pytest.approx(300 / 50, abs=1e-6)
    assert trace[0][0] == pytest.approx(240, abs=0.1) and trace[-1][0] == pytest.approx(540, abs=0.1)
    body = trace[:-1]  # the last row is the exit gate itself (splits time it)
    assert all(b[0] - a_[0] >= 1.99 for a_, b in zip(body, body[1:]))
    assert len(trace[0]) == 9  # pos, brake, gas, speed, t, steer, yaw, slip_f, slip_r
    assert trace[-1][4] == pytest.approx(a.section_s, abs=1e-3)


@pytest.mark.parametrize("offset", [0.0, 0.3, 1.7])
def test_interpolation_between_samples(corner, offset):
    # coarse 5 m sampling and the gates never land on a sample
    got, _ = run(corner, drive(corner.track_length_m, 200 + offset, 600, step=5.0))
    a = got[0][0]
    assert a.entry_kmh == pytest.approx(165.0, abs=0.01)
    assert a.exit_kmh == pytest.approx(120.0, abs=0.01)
    assert a.section_s == pytest.approx(6.0, abs=1e-6)


def test_run_ids_increase(corner):
    got, sc = run(corner, drive(corner.track_length_m, 200, 600))
    for s in drive(corner.track_length_m, 200, 600):
        sc.add(replace(s, t=s.t + 100))
    assert [a.attempt_id for a, _ in got] == ["a-0001", "a-0002"]


def invalid(corner, samples, **kw):
    got, _ = run(corner, samples, **kw)
    assert len(got) == 1 and not got[0][0].valid
    return got[0][0].invalid_reason


def test_invalid_data_gap(corner):
    ss = [s for s in drive(corner.track_length_m, 200, 600) if not 400 <= s.pos_m < 410]
    assert "data gap" in invalid(corner, ss)


def test_invalid_position_jump(corner):
    ss = drive(corner.track_length_m, 200, 600)
    ss = [replace(s, pos_m=s.pos_m + 35) if s.pos_m > 400 else s for s in ss]
    assert invalid(corner, ss) == "position jump"


def test_invalid_backwards(corner):
    ss = drive(corner.track_length_m, 200, 600)
    ss = [replace(s, pos_m=400 - (s.pos_m - 400) * 1.0 + 0.0) if 400 <= s.pos_m < 410 else s for s in ss]
    assert invalid(corner, ss) == "went backwards"


def test_invalid_status(corner):
    ss = drive(corner.track_length_m, 200, 600)
    ss = [replace(s, status="pause") if 400 <= s.pos_m < 402 else s for s in ss]
    assert invalid(corner, ss) == "status pause"


def test_invalid_too_long(corner):
    ss = [replace(s, t=s.t * 50) for s in drive(corner.track_length_m, 200, 600, step=0.1, v=50)]
    # dt = 0.1/50*50 = 0.1 s per sample -> 300 m = 3000 samples = 300 s
    assert "longer" in invalid(corner, ss)


def test_missing_onset_and_pickup(corner):
    ss = [replace(s, brake=0.0) for s in drive(corner.track_length_m, 200, 600)]
    assert invalid(corner, ss) == "no brake onset"
    ss = [replace(s, gas=0.0) for s in drive(corner.track_length_m, 200, 600)]
    assert invalid(corner, ss) == "no throttle pickup"


def test_brief_brake_blip_is_not_onset(corner):
    ss = drive(corner.track_length_m, 200, 600)
    # a 30 ms blip at 250 m before the real braking point
    ss = [replace(s, brake=0.5) if 250 <= s.pos_m < 251.5 else s for s in ss]
    got, _ = run(corner, ss)
    assert got[0][0].brake_onset_m == pytest.approx(300, abs=0.5)


def test_teleport_aborts_run(corner):
    ss = drive(corner.track_length_m, 200, 400)
    got = []
    sc = CornerScorer(corner, lambda a, t: got.append(a))
    for s in ss:
        sc.add(s)
    assert sc.in_run
    full = drive(corner.track_length_m, 150, 600)  # teleported back to 150 and drives again
    for s in full:
        sc.add(replace(s, t=s.t + 10))
    assert len(got) == 1 and got[0].valid and got[0].attempt_id == "a-0001"


def test_explicit_abort(corner):
    got, sc = run(corner, drive(corner.track_length_m, 200, 400))
    sc.abort()
    assert not sc.in_run
    for s in drive(corner.track_length_m, 400, 600):
        sc.add(replace(s, t=s.t + 10))
    assert got == []


def test_lap_wrap(corner):
    c = replace(corner, track_length_m=1000.0, start_gate_m=900.0, apex_window_m=(48.0, 68.0),
                exit_gate_m=140.0, board_zero_m=1040.0)
    # unwrapped: gate 900, brake 1000 (=0), apex 1048, pickup 1080, exit 1140
    ss = drive(1000.0, 800, 1200, brake_u=1000.0, apex_u=1048.0, pick_u=1080.0)
    got, _ = run(c, ss)
    assert len(got) == 1
    a = got[0][0]
    assert a.valid, a.invalid_reason
    assert a.brake_onset_m == pytest.approx(1000, abs=0.5)
    assert a.throttle_pickup_m == pytest.approx(1080, abs=0.5)
    assert a.apex_kmh == pytest.approx(70.0)
    assert a.section_s == pytest.approx(240 / 50, abs=1e-6)
