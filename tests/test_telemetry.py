import ctypes
import json

import pytest

from coach.scorer import CornerScorer
from coach.telemetry import (ACSharedMemory, ACNotRunning, Recorder, ReplaySource, Sample,
                             SPageFileGraphic, SPageFilePhysics, SPageFileStatic, SimSource,
                             parse_sample)


async def collect(src, n):
    out = []
    async for s in src.samples():
        out.append(s)
        if len(out) >= n:
            src.stop() if hasattr(src, "stop") else None
            break
    return out


async def drive_runs(corner, src, seconds=12.0):
    got = []
    sc = CornerScorer(corner, lambda a, t: got.append(a))
    async for s in src.samples():
        sc.add(s)
        if got or s.t > seconds:
            src.stop()
            break
    return got


async def test_sim_deterministic(corner):
    a = await collect(SimSource(corner, seed=3, realtime=False), 400)
    b = await collect(SimSource(corner, seed=3, realtime=False), 400)
    assert a == b and a[0].status == "live"
    c = await collect(SimSource(corner, seed=4, realtime=False), 5)
    assert c[0].speed_kmh != a[0].speed_kmh


async def test_sim_brake_board_moves_onset(corner):
    onsets = {}
    for board in (86.0, 120.0):
        got = await drive_runs(corner, SimSource(corner, realtime=False, brake_board_m=board))
        assert got and got[0].valid, got
        onsets[board] = got[0].brake_onset_m
        assert onsets[board] == pytest.approx(corner.board_zero_m - board, abs=1.5)
    assert onsets[86.0] > onsets[120.0]


async def test_sim_skill_converges_after_teleport(corner):
    sim = SimSource(corner, realtime=False)
    sim.set_target_board(100)
    first = (await drive_runs(corner, sim))[0]
    sim.teleport_to(sim.start_pos_m, sim.v0_kmh)
    sim._stop = False
    got = []
    sc = CornerScorer(corner, lambda a, t: got.append(a))
    async for s in sim.samples():
        sc.add(s)
        if got:
            sim.stop()
    target = corner.board_zero_m - 100
    assert abs(got[0].brake_onset_m - target) < abs(first.brake_onset_m - target) * 0.5


async def test_sim_pause_samples(corner):
    s = await collect(SimSource(corner, realtime=False, with_pause=True), 5)
    assert [x.status for x in s[:4]] == ["pause", "pause", "pause", "live"]


async def test_replay_roundtrip(corner, tmp_path):
    rec = Recorder(tmp_path)
    src = await collect(SimSource(corner, realtime=False), 50)
    for s in src:
        rec.write(s)
    rec.close()
    back = [s async for s in ReplaySource(rec.path).samples()]
    assert back == src


def _build_pages():
    phys = SPageFilePhysics(packetId=7, gas=0.25, brake=0.75, steerAngle=0.1, speedKmh=123.5)
    gfx = SPageFileGraphic(packetId=7, status=2, normalizedCarPosition=0.1)
    gfx.carCoordinates[0], gfx.carCoordinates[1], gfx.carCoordinates[2] = 1.0, 2.0, 3.0
    return phys, gfx


@pytest.mark.skipif(ctypes.sizeof(ctypes.c_wchar) != 2, reason="AC layout assumes 2-byte wchar (Windows)")
def test_struct_layout_matches_ac():
    # offsets from the CSP sim_info.py layout for original AC
    assert SPageFilePhysics.speedKmh.offset == 28 and SPageFilePhysics.steerAngle.offset == 24
    assert SPageFileGraphic.status.offset == 4
    assert SPageFileGraphic.completedLaps.offset == 132
    assert SPageFileGraphic.normalizedCarPosition.offset == 248
    assert SPageFileGraphic.carCoordinates.offset == 252
    assert SPageFileStatic.carModel.offset == 68  # two wchar[15] + 2 ints


def test_parse_from_raw_bytes():
    phys, gfx = _build_pages()
    p2 = SPageFilePhysics.from_buffer_copy(bytes(phys))
    g2 = SPageFileGraphic.from_buffer_copy(bytes(gfx))
    s = parse_sample(p2, g2, 5793.0, t=1.5)
    assert (s.packet_id, s.status, s.t) == (7, "live", 1.5)
    assert s.pos_m == pytest.approx(579.3, rel=1e-5)
    assert (s.gas, s.brake, s.speed_kmh) == (0.25, 0.75, 123.5)
    assert (s.x, s.y, s.z) == (1.0, 2.0, 3.0)
    gfx.status = 3
    assert parse_sample(phys, gfx, 100.0).status == "pause"


async def test_ac_source_errors_cleanly_off_windows_or_without_ac(corner):
    src = ACSharedMemory(corner.track_length_m)
    with pytest.raises(ACNotRunning):
        async for _ in src.samples():
            break
