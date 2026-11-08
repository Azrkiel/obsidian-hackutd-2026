from engine.live_cue import LiveCue, NullPlayer

# corner: board_zero 440; marker 100 -> mark at 340, pre at 290; apex end 468


def drive(cue, start, end, speed_kmh=360.0, dt=0.05, t0=0.0):
    """Drive at constant speed (100 m/s at 360 km/h). Returns last t."""
    t, pos = t0, start
    while pos < end:
        cue.on_sample(t, pos, speed_kmh)
        t += dt
        pos += speed_kmh / 3.6 * dt
    return t


def test_fires_pre_then_mark_with_lead(corner):
    pl = NullPlayer()
    c = LiveCue(corner, pl, lead_s=0.2)
    c.arm("brake_point", {"marker_m": 100})
    positions = []
    orig = pl.play
    t, pos = 0.0, 250.0
    while pos < 400:
        before = len(pl.calls)
        c.on_sample(t, pos, 360.0)
        if len(pl.calls) > before:
            positions.append((pl.calls[-1], pos))
        t += 0.05
        pos += 5.0
    assert pl.calls == ["pre", "mark"]
    # lead = 100 m/s * 0.2 s = 20 m: tone fires ~20 m before the cue position
    assert 270 <= positions[0][1] <= 275 and 320 <= positions[1][1] <= 325


def test_fires_once(corner):
    pl = NullPlayer()
    c = LiveCue(corner, pl)
    c.arm("brake_point", {"marker_m": 100})
    drive(c, 250, 400)
    assert pl.calls == ["pre", "mark"]
    c.on_sample(10.0, 400, 300)  # gap -> disarmed, still nothing new
    assert pl.calls == ["pre", "mark"]


def test_throttle_mark(corner):
    pl = NullPlayer()
    c = LiveCue(corner, pl)
    c.arm("throttle_pickup", {"marker_m": 20})  # 468 + 20 = 488
    drive(c, 440, 520, speed_kmh=180.0)
    assert pl.calls == ["mark"]


def test_gap_disarms(corner):
    pl = NullPlayer()
    c = LiveCue(corner, pl)
    c.arm("brake_point", {"marker_m": 100})
    c.on_sample(0.0, 250, 360)
    c.on_sample(0.5, 300, 360)  # 0.5 s gap
    drive(c, 301, 400, t0=0.6)
    assert pl.calls == [] and not c.armed


def test_not_armed_baseline(corner):
    pl = NullPlayer()
    c = LiveCue(corner, pl)
    drive(c, 250, 400)
    c.on_run_scored(None, 1.0, 5.0)
    assert pl.calls == []


def test_wrap_no_crash(corner):
    pl = NullPlayer()
    c = LiveCue(corner, pl)
    c.arm("brake_point", {"marker_m": 100})
    c.on_sample(0.0, corner.track_length_m - 5, 300)
    c.on_sample(0.05, 3.0, 300)  # wrapped
    c.on_sample(0.10, 8.0, 300)
    assert pl.calls == [] and not c.armed


def test_past_exit_silent(corner):
    pl = NullPlayer()
    c = LiveCue(corner, pl, lead_s=0.0)
    c.arm("throttle_pickup", {"marker_m": 80})  # 548 > exit_gate 540
    drive(c, 500, 600, speed_kmh=180.0)
    assert pl.calls == []


def test_hit_and_miss_tones(corner):
    for gap, tone in ((3.0, "hit"), (-5.0, "hit"), (7.0, "miss")):
        pl = NullPlayer()
        c = LiveCue(corner, pl)
        c.arm("brake_point", {"marker_m": 100})
        c.on_run_scored(None, gap, 5.0)
        assert pl.calls == [tone] and not c.armed
        c.on_run_scored(None, gap, 5.0)  # disarmed: silent
        assert pl.calls == [tone]
