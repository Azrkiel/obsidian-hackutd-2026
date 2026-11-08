"""TrackScorer on full synthetic laps (LapSim), clean and with planted mistakes."""
import asyncio
import dataclasses
from pathlib import Path

import pytest

from coach.lap_sim import LapSim
from coach.telemetry import SPageFileGraphic, SPageFilePhysics, parse_sample
from coach.track import Track
from coach.track_scorer import TrackScorer, body_slip_deg
from engine.config import load_corner

ROOT = Path(__file__).resolve().parents[1]
TRACK = Track.load()
BASE = load_corner(ROOT / "fixtures" / "corner_monza_t1.json")
MISTAKES = {"c1": ["late_brake"], "c3": ["early_brake"], "c4": ["spin"], "c5": ["run_wide"],
            "c6": ["slow_exit"], "c7": ["lockup"]}


def drive(errors=None, laps=1.05, start=TRACK.length_m - 400, tweak=None):
    passes = []
    sc = TrackScorer(TRACK, BASE, passes.append)
    sim = LapSim(TRACK, errors=errors, laps=laps, start_m=start)

    async def go():
        async for s in sim.samples():
            sc.add(tweak(s) if tweak else s)
    asyncio.run(go())
    return passes, sc, sim


@pytest.fixture(scope="module")
def clean():
    return drive()[0]


@pytest.fixture(scope="module")
def mistakes():
    return {p.corner_id: p for p in drive(MISTAKES)[0]}


def test_clean_lap_scores_every_corner(clean):
    assert [p.corner for p in clean] == [c.name for c in TRACK.corners]
    for p, c in zip(clean, TRACK.corners):
        assert p.valid and p.lap == 1
        assert p.tyres_out_s == 0 and p.max_body_slip_deg < 5 and not p.went_backwards
        assert p.segment_s == pytest.approx(c.ai["segment_s"], abs=0.05)   # it drove the AI line
        assert p.min_kmh == pytest.approx(c.ai["min_kmh"], abs=2)
        if c.kind == "brake":
            assert p.attempt.valid and p.brake_onset_m == pytest.approx(c.brake_m, abs=12)
        else:
            assert p.brake_onset_m is None                                   # Curva Grande: flat


def test_planted_mistakes_leave_their_marks(clean, mistakes):
    ref = {p.corner_id: p for p in clean}
    lost = {k: mistakes[k].segment_s - ref[k].segment_s for k in ref}
    late = mistakes["c1"]
    assert late.tyres_out_s > 0.3 and late.max_tyres_out == 4 and late.peak_slip_f > 0.3 and lost["c1"] > 0.25
    assert late.brake_onset_m > ref["c1"].brake_onset_m + 15
    early = mistakes["c3"]
    assert early.brake_onset_m < ref["c3"].brake_onset_m - 40 and lost["c3"] > 0.25
    assert mistakes["c4"].max_body_slip_deg > 90 and lost["c4"] > 1.0                   # spin
    assert mistakes["c5"].tyres_out_s > 0.3                                              # wide
    assert lost["c6"] > 0.2 and mistakes["c6"].tyres_out_s == 0                           # slow exit
    assert mistakes["c7"].peak_slip_f >= 0.4 and abs(lost["c7"]) < 0.01                   # lock-up only
    cg = mistakes["c2"]
    assert abs(lost["c2"]) < 0.01 and cg.tyres_out_s == 0 and cg.max_body_slip_deg < 5  # untouched
    assert all(p.valid for p in mistakes.values())   # bad driving is not bad data


def test_rewind_drops_the_pass_and_the_retry_is_scored():
    passes = []
    tr = TRACK
    les = tr.get("c4")
    sc = TrackScorer(tr, BASE, passes.append)
    sim = LapSim(tr, errors={"c4": ["spin", None]}, start_m=les.entry_m - 300)

    async def go():
        rewound = False
        async for s in sim.samples():
            sc.add(s)
            if not rewound and sc.in_pass and sc.current.id == "c4" and s.pos_m > les.apex_m[0] + 40:
                sim.teleport_to(les.entry_m - 300, tr.ai_kmh(les.entry_m - 300))   # mid-pass rewind
                rewound = True
            if len(passes) == 1:
                sim.stop()
    asyncio.run(go())
    assert [(p.corner_id, p.valid) for p in passes] == [("c4", True)]
    assert passes[0].max_body_slip_deg < 5                       # the clean retry, not the spin
    assert sim.log == [("c4", 0, "spin"), ("c4", 1, None)]


def test_data_gap_marks_the_pass_invalid():
    tr = TRACK
    les = tr.get("c4")

    def gap(s):   # half a second of telemetry missing at the apex
        return dataclasses.replace(s, t=s.t + 0.5) if les.apex_m[0] <= s.pos_m < les.exit_m + 100 else s
    passes, _, _ = drive(laps=0.07, start=les.entry_m - 50, tweak=gap)
    assert passes and passes[0].corner_id == "c4" and not passes[0].valid
    assert passes[0].invalid_reason.startswith("data gap")


def test_lap_counter_and_second_lap():
    passes, sc, _ = drive(laps=2.02)
    assert sc.lap == 2 and [p.lap for p in passes] == [1] * 7 + [2] * 7


def test_body_slip_does_not_depend_on_the_yaw_sign():
    from coach.lap_sim import LapSim as Sim
    sim = Sim(TRACK, errors={"c4": ["spin"]}, start_m=TRACK.get("c4").entry_m)
    rows = [sim._step() for _ in range(int(8 / sim.dt))]
    flipped = [dataclasses.replace(s, yaw_rate=-s.yaw_rate) for s in rows]
    assert body_slip_deg(rows) == pytest.approx(body_slip_deg(flipped), abs=2) and body_slip_deg(rows) > 90


def test_tyres_out_read_from_shared_memory():
    phys, gfx = SPageFilePhysics(), SPageFileGraphic()
    phys.numberOfTyresOut, gfx.status = 3, 2
    assert parse_sample(phys, gfx, 5793.0, t=0).tyres_out == 3
