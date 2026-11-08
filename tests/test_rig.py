"""scripts/rig.py helpers and the measured single-corner T1 the coach now uses by default."""
import importlib.util
import json
import sys
from pathlib import Path

from coach.__main__ import build_parser
from engine.config import load_attempt, load_corner

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("rig", ROOT / "scripts" / "rig.py")
rig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rig)


def test_coach_command_game_and_sim():
    game = rig.coach_command(False, 8020, "127.0.0.1", ["--agent"])
    assert game[:3] == [sys.executable, "-m", "coach"]
    assert ["--telemetry", "ac", "--reset", "udp", "--inputs"] == game[3:8]
    assert "--history" in game and game[-1] == "--agent"
    sim = rig.coach_command(True, 8050, "0.0.0.0", [])
    assert "sim" in sim and "--inputs" not in sim and sim[sim.index("--port") + 1] == "8050"


def test_find_cli_prefers_explicit_then_env(tmp_path, monkeypatch):
    a, b = tmp_path / "a.exe", tmp_path / "b.exe"
    a.write_text(""); b.write_text("")
    monkeypatch.setenv("SPACETIME_CLI", str(b))
    assert rig.find_cli(str(a)) == str(a)
    assert rig.find_cli(None) == str(b)
    monkeypatch.setenv("SPACETIME_CLI", str(tmp_path / "missing.exe"))
    monkeypatch.setattr(rig.shutil, "which", lambda _: None)
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    assert rig.find_cli(None) is None


def test_coach_identity_is_cached_per_server(tmp_path, monkeypatch):
    calls = []

    class Resp:
        status = 200
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def read(self): return json.dumps({"identity": "c2", "token": f"tok{len(calls)}"}).encode()

    def fake_open(req, timeout=0):
        calls.append(req.full_url)
        return Resp()
    monkeypatch.setattr(rig.urllib.request, "urlopen", fake_open)
    cache = tmp_path / "id.json"
    assert rig.coach_identity("http://127.0.0.1:3000", cache) == "tok1"
    assert rig.coach_identity("http://127.0.0.1:3000", cache) == "tok1"   # reused, no new identity
    assert calls == ["http://127.0.0.1:3000/v1/identity"]
    assert rig.coach_identity("http://127.0.0.1:3001", cache) == "tok2"   # another server: new one


def test_prebuilt_module_is_committed():
    assert rig.MODULE.is_file() and rig.MODULE.stat().st_size > 10_000


def test_default_corner_is_measured_t1_with_its_reference():
    args = build_parser().parse_args([])
    corner = load_corner(args.corner)
    assert (corner.start_gate_m, corner.apex_window_m, corner.exit_gate_m) == (520, (875, 955), 1060)
    named = json.loads(Path(args.corner).read_text(encoding="utf-8"))["_reference"]
    doc = json.loads((Path(args.corner).parent / named).read_text(encoding="utf-8"))
    ref = load_attempt(Path(args.corner).parent / named)
    assert ref.valid and corner.start_gate_m < ref.brake_onset_m < corner.apex_window_m[0]
    assert abs(corner.board_zero_m - ref.brake_onset_m - 100) < 1      # the 100 m board
    assert len(doc["trace"]) > 50 and all(corner.start_gate_m <= r[0] <= corner.exit_gate_m for r in doc["trace"])
