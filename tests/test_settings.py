"""Whole-lap settings: validation, saving, live apply, personal-best reset."""
import json
from pathlib import Path

import pytest

from coach.app import CoachApp
from coach.lap_sim import LapSim
from coach.reference import References
from coach.settings import Settings, SettingsError, SettingsStore
from coach.track import Track
from engine.config import load_corner

ROOT = Path(__file__).resolve().parents[1]
TRACK = Track.load()


def test_validation():
    assert Settings.check({"sensitivity_s": 0.1, "voice": False}) == {"sensitivity_s": 0.1, "voice": False}
    for bad in ({"sensitivity_s": 0.6}, {"countdown_s": 2}, {"lead_time_s": "4"}, {"reference": "fast"},
                {"voice": 1}, {"brake_m": 10}, {"countdown_s": True}, []):
        with pytest.raises(SettingsError):
            Settings.check(bad)


def test_saved_and_reloaded(tmp_path):
    path = tmp_path / "settings.json"
    s = SettingsStore(path)
    assert s.update({"countdown_s": 8, "reference": "pb"}) == {"countdown_s": 8.0}   # pb unchanged
    assert SettingsStore(path).value.countdown_s == 8.0
    path.write_text("{broken")
    assert SettingsStore(path, Settings(lead_time_s=5)).value.lead_time_s == 5      # defaults on a bad file


def make(tmp_path, **kw):
    refs = References(TRACK, tmp_path / "pb.json")
    base = load_corner(ROOT / "fixtures" / "corner_monza_t1.json")
    return CoachApp(base, refs.get("t1").as_attempt(), LapSim(TRACK), [], reset_mode="sim",
                    data_dir=tmp_path / "data", trace_dir=tmp_path / "traces", sound=False, countdown=0,
                    persist_checkpoint=False, track_model=TRACK, references=refs, whole_lap=True, **kw)


async def test_live_apply(tmp_path):
    app = make(tmp_path)
    seen = []
    app.subscribe(seen.append)
    changed = await app.update_settings({"reference": "ai", "sensitivity_s": 0.4, "countdown_s": 7,
                                         "lead_time_s": 5.5})
    assert set(changed) == {"reference", "sensitivity_s", "countdown_s", "lead_time_s"}
    lc = app.lap_coach
    assert app.references.mode == "ai" and lc.detector.th.time_lost_s == 0.4
    assert lc.offers.countdown_s == 7 and lc.picker.lead_s == 5.5 == app.lead_time_s
    assert seen[-1]["type"] == "settings" and seen[-1]["countdown_s"] == 7
    assert json.loads((tmp_path / "data" / "settings.json").read_text())["reference"] == "ai"
    with pytest.raises(SettingsError):
        await app.update_settings({"countdown_s": 30})
    await app.handle_command({"type": "settings", "changes": {"countdown_s": 30}})   # noted, not raised
    assert app.snapshot()["settings"]["countdown_s"] == 7


async def test_saved_settings_win_over_the_command_line(tmp_path):
    (tmp_path / "data").mkdir()
    (tmp_path / "data" / "settings.json").write_text(json.dumps({"lead_time_s": 3.5, "reference": "ai"}))
    app = make(tmp_path, lead_time_s=4.0)
    assert app.lead_time_s == 3.5 and app.references.mode == "ai"


async def test_personal_best_reset(tmp_path):
    app = make(tmp_path)
    from test_reference import cpass
    app.references.offer(cpass(seg=9.0), clean=True)
    await app.handle_command({"type": "reset_personal_best"})
    assert app.references.summary()["personal_bests"] == {}
