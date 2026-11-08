"""Dashboard track map (--map) and the race number shown in the header."""
import argparse

from coach.__main__ import ROOT, load_map
from coach.history import HistoryRecorder
from tests.test_history import metadata


def _args(m="auto"):
    return argparse.Namespace(map=m)


def test_auto_map_for_monza_aligned_to_lap_distance():
    m = load_map(_args(), "Monza T1 (Variante del Rettifilo)")
    assert m is not None and m["length_m"] == 5793.0
    pts = m["points"]
    assert pts[0][0] == 0 and pts[-1][0] == 5793.0
    assert all(b[0] > a[0] for a, b in zip(pts, pts[1:]))          # indexed by lap distance
    assert all(-1 <= p[1] <= m["width"] + 1 and -1 <= p[2] <= m["height"] + 1 for p in pts)  # box is rounded
    assert abs(pts[0][1] - pts[-1][1]) < 5 and abs(pts[0][2] - pts[-1][2]) < 5   # closed lap


def test_map_off_unknown_and_explicit(tmp_path):
    assert load_map(_args("off"), "Monza") is None
    assert load_map(_args(), "Nowhere Ring") is None
    assert load_map(_args(str(ROOT / "fixtures" / "track_monza_map.json")), "Anything")["name"] == "Monza"


def test_race_number_counts_the_drivers_sessions(tmp_path):
    path = tmp_path / "history.sqlite3"
    for n in (1, 2, 3):
        h = HistoryRecorder(path)
        h.start(metadata())
        h.flush()
        assert h.stats()["race"] == n
        h.close()
