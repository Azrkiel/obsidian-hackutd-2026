"""References: AI line, personal best with AI fallback, saved per track, reset."""
import dataclasses
import json

import pytest

from coach.reference import References
from coach.track import Track
from coach.corner_pass import CornerPass

TRACK = Track.load()


def cpass(cid="c1", seg=9.5, valid=True, **kw):
    d = dict(corner_id=cid, corner=TRACK.get(cid).name, lap=1, valid=valid, invalid_reason=None,
             t_entry=0, t_exit=seg, entry_kmh=300, exit_kmh=150, min_kmh=90, min_pos_m=455, segment_s=seg,
             tyres_out_s=0, max_tyres_out=0, max_body_slip_deg=1, went_backwards=False, peak_slip_f=0.1,
             peak_slip_r=0.1)
    d.update(kw)
    return CornerPass(**d)


def test_ai_until_a_clean_pass(tmp_path):
    refs = References(TRACK, tmp_path / "pb.json")
    r = refs.get("c1")
    assert r.source == "ai" and r.segment_s == TRACK.get("c1").ai["segment_s"]
    assert r.brake_onset_m == TRACK.get("c1").brake_m
    assert refs.get("c2").brake_onset_m is None                     # flat corner


def test_only_clean_faster_passes_become_the_best(tmp_path):
    refs = References(TRACK, tmp_path / "pb.json")
    assert not refs.offer(cpass(seg=9.0), clean=False)              # an error: not a best
    assert not refs.offer(cpass(seg=9.0, valid=False), clean=True)  # bad data: not a best
    assert refs.offer(cpass(seg=9.8), clean=True)
    assert refs.get("c1").source == "pb" and refs.get("c1").segment_s == 9.8
    assert not refs.offer(cpass(seg=9.9), clean=True)               # slower
    assert refs.offer(cpass(seg=9.6), clean=True)
    assert refs.get("c1").segment_s == 9.6 and refs.get("c3").source == "ai"


def test_mode_ai_ignores_the_best(tmp_path):
    refs = References(TRACK, tmp_path / "pb.json", mode="ai")
    refs.offer(cpass(seg=9.0), clean=True)
    assert refs.get("c1").source == "ai" and refs.personal_best("c1").segment_s == 9.0
    refs.mode = "pb"
    assert refs.get("c1").source == "pb"
    with pytest.raises(ValueError):
        refs.mode = "fastest"


def test_saved_and_loaded(tmp_path):
    path = tmp_path / "pb.json"
    References(TRACK, path).offer(cpass("c4", seg=6.0), clean=True)
    again = References(TRACK, path)
    assert again.get("c4").segment_s == 6.0 and again.get("c4").source == "pb"
    assert again.get("c4").as_attempt().section_s == 6.0
    assert json.loads(path.read_text())["track"] == TRACK.name


def test_another_track_file_is_not_compared(tmp_path):
    path = tmp_path / "pb.json"
    References(TRACK, path).offer(cpass(seg=9.0), clean=True)
    other = Track(TRACK.name.replace("SYNTHETIC", "real"), TRACK.length_m, TRACK.corners,
                  [[0, 100, 1, 0], [10, 100, 1, 0]])
    assert References(other, path).get("c1").source == "ai"


def test_reset_clears_the_file(tmp_path):
    path = tmp_path / "pb.json"
    refs = References(TRACK, path)
    refs.offer(cpass(seg=9.0), clean=True)
    refs.reset()
    assert not path.exists() and refs.get("c1").source == "ai"
    assert References(TRACK, path).summary()["personal_bests"] == {}


def test_reference_as_attempt_for_the_existing_pieces():
    a = References(TRACK, None).get("c1").as_attempt()
    assert a.valid and a.brake_onset_m == TRACK.get("c1").brake_m and a.section_s > 0
    assert dataclasses.asdict(a)["attempt_id"] == "ref-ai-c1"
