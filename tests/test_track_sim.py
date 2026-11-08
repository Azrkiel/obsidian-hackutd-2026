from pathlib import Path

from coach.scorer import CornerScorer
from coach.telemetry import TrackSimSource
from engine.config import load_track

FIX = Path(__file__).resolve().parent.parent / "fixtures"


def track():
    return load_track(FIX / "track_monza.json")


async def run(src, tr, laps=1.3, on_wrap=None):
    """Drive laps*length metres; return ({id: [Attempt]}, wrap times)."""
    res = {c.id: [] for c in tr.corners}
    scorers = {c.id: CornerScorer(c, (lambda a, tx, i=c.id: res[i].append(a))) for c in tr.corners}
    wraps, last, dist = [], src.pos, 0.0
    async for s in src.samples():
        for sc in scorers.values():
            sc.add(s)
        if s.pos_m < last - 1000:
            wraps.append(s.t)
            if on_wrap:
                on_wrap(src)
        dist += (s.pos_m - last) % tr.length_m if s.pos_m != last else 0
        last = s.pos_m
        if dist >= laps * tr.length_m:
            src.stop()
    return res, wraps


async def test_every_corner_scored_and_onset_matches():
    tr = track()
    src = TrackSimSource(tr, realtime=False)
    res, wraps = await run(src, tr)
    assert len(wraps) == 1 and src.lap_count == 1
    for c in tr.corners:
        a = res[c.id][0]
        assert a.valid, (c.id, a.invalid_reason)
        assert abs(a.brake_onset_m - (c.board_zero_m - 100)) < 3, (c.id, a.brake_onset_m)
        assert a.apex_kmh < a.entry_kmh


async def test_lap_time_sane_and_no_position_jump():
    tr = track()
    src = TrackSimSource(tr, realtime=False)
    res, wraps = await run(src, tr, laps=2.2)
    assert len(wraps) == 2
    assert 60 < wraps[1] - wraps[0] < 140
    for atts in res.values():
        assert len(atts) >= 2
        assert all(a.valid for a in atts), [a.invalid_reason for a in atts]


async def test_board_knob_moves_onset_and_lengthens_section():
    tr = track()
    base, _ = await run(TrackSimSource(tr, realtime=False), tr)
    early, _ = await run(TrackSimSource(tr, realtime=False, corners={"ascari": {"board_m": 130}}), tr)
    c = tr.corner("ascari")
    a0, a1 = base["ascari"][0], early["ascari"][0]
    assert abs((a0.brake_onset_m - a1.brake_onset_m) - 30) < 3
    assert abs(a1.brake_onset_m - (c.board_zero_m - 130)) < 3
    assert a1.section_s > a0.section_s
    assert early["t1"][0].brake_onset_m == base["t1"][0].brake_onset_m


async def test_target_board_converges_by_skill_per_lap():
    tr = track()
    src = TrackSimSource(tr, realtime=False, skill=0.6, corners={"ascari": {"board_m": 130}})
    src.set_target_board(100, "ascari")
    res, wraps = await run(src, tr, laps=3.3)
    c = tr.corner("ascari")
    o = [a.brake_onset_m for a in res["ascari"]]
    assert abs(o[0] - (c.board_zero_m - 130)) < 3
    assert abs(o[1] - (c.board_zero_m - (130 - 0.6 * 30))) < 3  # 112 m board
    assert abs(o[2] - (c.board_zero_m - (112 + 0.6 * (100 - 112)))) < 3


async def test_release_knob_changes_scored_release():
    tr = track()
    fast, _ = await run(TrackSimSource(tr, realtime=False, corners={"lesmo1": {"release_s": 0.2}}), tr)
    slow, _ = await run(TrackSimSource(tr, realtime=False, corners={"lesmo1": {"release_s": 1.0}}), tr)
    rf, rs = fast["lesmo1"][0].release_s, slow["lesmo1"][0].release_s
    assert rf is not None and rs is not None and rs > rf + 0.3


async def test_set_target_release_applies_at_wrap():
    tr = track()
    src = TrackSimSource(tr, realtime=False, skill=1.0)
    src.set_target_release(1.0, "lesmo1")
    res, _ = await run(src, tr, laps=2.3)
    r = [a.release_s for a in res["lesmo1"]]
    assert r[1] > r[0] + 0.15
