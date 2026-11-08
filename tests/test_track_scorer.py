"""TrackScorer on the deterministic whole-lap simulator (non-realtime, ~2.2 laps)."""
import json
from pathlib import Path

from coach.scorer import TrackScorer
from coach.telemetry import DEFAULT_BOARD_M, Sample, TrackSimSource
from engine.config import load_track, load_track_reference

FIX = Path(__file__).resolve().parent.parent / "fixtures"
TRACK = load_track(FIX / "track_monza.json")
REFS = load_track_reference(FIX / "track_monza_reference.json")
REF_LAP_S = json.loads((FIX / "track_monza_reference.json").read_text())["lap_time_s"]
IDS = TRACK.ids
LAST = TRACK.corner(TRACK.last_id)


class Rec:
    """Collects everything a TrackScorer emits, with the sample position at each call."""

    def __init__(self, ref=True):
        self.runs, self.corners, self.laps = [], [], []
        self.pos = 0.0
        self.sc = TrackScorer(
            TRACK, on_run=lambda cid, a, tr: self.runs.append((cid, a, tr)),
            on_corners=lambda n, r: self.corners.append((n, dict(r), self.pos)),
            on_track_lap=self.laps.append,
            reference_of=(lambda cid: REFS[cid][0]) if ref else (lambda cid: None))


async def drive(rec, corners=None, laps=2.2, skip=None, after=None):
    """Feed sim samples until `laps` laps of distance are covered. skip(sample) -> drop it;
    after(rec) runs after every accepted sample."""
    src = TrackSimSource(TRACK, realtime=False, corners=corners)
    dist, last = 0.0, src.pos
    async for s in src.samples():
        dist += (s.pos_m - last) % TRACK.length_m if s.pos_m != last else 0.0
        last = s.pos_m
        if dist >= laps * TRACK.length_m:
            src.stop()
            break
        if skip and skip(s):
            continue
        rec.pos = s.pos_m
        rec.sc.add(s)
        if after:
            after(rec)
    return rec


async def test_attempt_ids_and_on_run_every_corner_every_lap():
    rec = await drive(Rec())
    by_lap = {}
    for cid, a, _ in rec.runs:
        n = int(a.attempt_id[1:3])
        assert a.attempt_id == f"L{n:02d}-{cid}"
        by_lap.setdefault(n, []).append(cid)
        assert a.valid, (a.attempt_id, a.invalid_reason)
    assert sorted(by_lap)[:2] == [0, 1]
    for lap in (0, 1):
        assert by_lap[lap] == IDS
    ids = [a.attempt_id for _, a, _ in rec.runs]
    assert len(ids) == len(set(ids))
    assert all(len(tr) > 5 for _, _, tr in rec.runs)


async def test_on_corners_once_per_lap_in_lap_order_before_the_line():
    rec = await drive(Rec())
    laps = [n for n, _, _ in rec.corners]
    assert laps == sorted(set(laps)) and laps[:2] == [0, 1]
    for n, runs, pos in rec.corners:
        assert list(runs) == IDS
        assert all(a.attempt_id == f"L{n:02d}-{cid}" for cid, (a, _) in runs.items())
        # fires when parabolica is scored: after its exit gate, before the lap line
        assert LAST.exit_gate_m <= pos < TRACK.length_m, pos


async def test_on_track_lap_time_matches_reference_with_ideal_knobs():
    rec = await drive(Rec())
    # the first partial lap (lap 0) is never emitted
    assert rec.laps and all(e["lap"] >= 1 for e in rec.laps) and rec.laps[0]["lap"] == 1
    e = rec.laps[0]
    assert e["type"] == "track_lap" and e["valid"] is True and e["invalid_reason"] is None
    assert abs(e["lap_time_s"] - REF_LAP_S) < 0.1
    assert [c["corner_id"] for c in e["corners"]] == IDS
    for c in e["corners"]:
        assert c["valid"] and c["attempt_id"] == f"L01-{c['corner_id']}"
        assert abs(c["delta_s"]) < 0.05, c
    assert abs(e["delta_s"]) < 0.1


async def test_track_lap_delta_positive_at_early_braking_corner():
    # default board + 35 = braking 35 m earlier than the reference -> slower section
    rec = await drive(Rec(), corners={"ascari": {"board_m": DEFAULT_BOARD_M["ascari"] + 35}})
    e = rec.laps[0]
    d = {c["corner_id"]: c["delta_s"] for c in e["corners"]}
    assert d["ascari"] > 0.05
    assert all(abs(v) < 0.05 for k, v in d.items() if k != "ascari")
    assert e["delta_s"] >= d["ascari"] - 0.01
    assert e["lap_time_s"] > REF_LAP_S + 0.05


async def test_no_reference_gives_none_deltas():
    rec = await drive(Rec(ref=False))
    assert all(c["delta_s"] is None for c in rec.laps[0]["corners"])
    assert rec.laps[0]["delta_s"] == 0.0


async def test_fallback_on_corners_at_the_lap_line_when_last_corner_never_scores():
    def kill_last(rec):
        if rec.sc.scorers[TRACK.last_id].in_run:
            rec.sc.scorers[TRACK.last_id].abort()
    rec = await drive(Rec(), after=kill_last)
    assert rec.corners, "on_corners never fired"
    for n, runs, pos in rec.corners:
        assert list(runs) == IDS[:-1]
        assert pos < 300, pos  # just past the line, not at parabolica's exit
    assert not any(cid == TRACK.last_id for cid, _, _ in rec.runs)
    laps = [n for n, _, _ in rec.corners]
    assert len(laps) == len(set(laps))  # still once per lap


async def test_data_gap_invalidates_lap_time():
    # drop ~1 s of samples on lap 1 between turn 1 and roggia (a straight: no corner is scored there)
    state = {"laps": 0, "prev": None}

    def skip(s):
        if state["prev"] is not None and s.pos_m < state["prev"] - 1000:
            state["laps"] += 1
        state["prev"] = s.pos_m
        return state["laps"] == 1 and 1200 <= s.pos_m <= 1300
    rec = await drive(Rec(), skip=skip, laps=3.2)
    e = rec.laps[0]
    assert e["lap"] == 1 and e["lap_time_s"] is None and e["valid"] is False
    assert e["invalid_reason"].startswith("data gap")
    # every corner still scored fine; the next lap is clean again
    assert all(c["valid"] for c in e["corners"])
    assert len(rec.laps) >= 2 and rec.laps[1]["lap_time_s"] is not None


async def test_short_gap_is_tolerated():
    state = {"n": 0}

    def skip(s):  # one dropped 100 Hz sample = 20 ms gap
        state["n"] += 1
        return state["n"] == 9000
    rec = await drive(Rec(), skip=skip)
    assert rec.laps[0]["valid"] is True


def _s(t, pos, status="live"):
    return Sample(t, int(t * 100), status, pos / 5793, pos, 250.0, 1.0, 0.0, 0.0, 0, 0, 0)


def test_non_live_status_marks_lap_invalid():
    rec = Rec()
    for t, pos, st in [(0.0, 5700, "live"), (0.1, 20, "live"), (0.2, 40, "pause"), (0.3, 60, "live"),
                       (0.4, 5700, "live"), (0.5, 20, "live")]:
        rec.sc.add(_s(t, pos, st))
    assert rec.laps and rec.laps[0]["lap"] == 1
    assert rec.laps[0]["lap_time_s"] is None and rec.laps[0]["invalid_reason"] == "status pause"


async def test_in_run_and_abort():
    rec = Rec()
    assert rec.sc.in_run is False
    seen = {}

    def watch(r):
        if r.sc.in_run and "first" not in seen:
            seen["first"] = [cid for cid, s in r.sc.scorers.items() if s.in_run]
            r.sc.abort()
            seen["after"] = r.sc.in_run
    await drive(rec, after=watch)
    assert seen["first"] == [IDS[0]] and seen["after"] is False
    # the aborted corner produced no lap-0 attempt; the other five did
    lap0 = [cid for cid, a, _ in rec.runs if a.attempt_id.startswith("L00-")]
    assert lap0 == IDS[1:]
    assert list(rec.corners[0][1]) == IDS[1:] and rec.corners[0][0] == 0
    # lap 1 is a fresh lap and not affected
    assert rec.laps[0]["lap"] == 1 and rec.laps[0]["valid"] is True


async def test_abort_mid_lap_marks_that_lap_reset():
    rec = Rec()
    state = {"done": False}

    def watch(r):
        if r.sc.lap == 1 and not state["done"] and r.sc.scorers["ascari"].in_run:
            state["done"] = True
            r.sc.abort()
    await drive(rec, after=watch)
    e = rec.laps[0]
    assert e["lap"] == 1 and e["lap_time_s"] is None and e["invalid_reason"] == "reset"
    assert "ascari" not in [c["corner_id"] for c in e["corners"]]
