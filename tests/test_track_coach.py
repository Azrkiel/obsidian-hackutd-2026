"""Whole-lap coaching end to end in the track simulator (W12), plus the CLI and GET /track."""
import json
from pathlib import Path

from aiohttp.test_utils import TestClient, TestServer

from coach.__main__ import build_app, build_parser
from coach.app import CoachApp
from coach.dashboard import make_web_app
from coach.telemetry import DEFAULT_BOARD_M, TrackSimSource
from engine.config import load_track, load_track_reference
from engine.models import Attempt, ModelResult, ToolCall
from engine.nemotron import ProviderError
from engine.state import RETRY
from engine.track_coach import TrackCoach
from engine.voice import SilentSpeaker

FIX = Path(__file__).resolve().parent.parent / "fixtures"
DEMO = {"ascari": {"board_m": DEFAULT_BOARD_M["ascari"] + 35}, "roggia": {"board_m": DEFAULT_BOARD_M["roggia"] + 25}, "parabolica": {"release_s": 0.15}}


def track():
    return load_track(FIX / "track_monza.json")


def refs():
    return load_track_reference(FIX / "track_monza_reference.json")


class PosSpeaker(SilentSpeaker):
    """Records where the car was when each message was spoken."""

    def __init__(self):
        super().__init__()
        self.app = None
        self.at: list[tuple[str, float]] = []

    def speak(self, text):
        super().speak(text)
        self.at.append((text, self.app.latest.pos_m))


async def run_track(tmp_path, providers=(), agent=False, until=None, max_laps=9, corners=None):
    t, spk = track(), PosSpeaker()
    src = TrackSimSource(t, realtime=False, corners=corners or DEMO)
    app = CoachApp(t.corners[0], refs()["t1"][0], src, list(providers), reset_mode="manual",
                   data_dir=tmp_path / "d", trace_dir=tmp_path / "t", sound=False, countdown=0,
                   persist_checkpoint=False, mode="lap", speaker=spk, agent=agent,
                   track=t, track_references=refs(),
                   announcer_kwargs={"runner": lambda fn: fn(), "clock": lambda: src.t})
    spk.app = app
    done = until or (lambda a: False)
    await app.start()
    try:
        await app.wait_for(lambda: done(app) or app.scorer.lap >= max_laps, 120)
    finally:
        await app.stop()
    return app, spk


def decisions(app):
    return [e for e in app.events if e["type"] == "decision"]


def assert_quiet_in_corners(app, spk):
    t = app.track
    assert spk.at, "nothing was spoken"
    for text, pos in spk.at:
        assert t.corner_at(pos) is None, f"spoke {text!r} inside {t.corner_at(pos).id} at {pos:.0f} m"
        assert t.in_talk_zone(pos), f"spoke {text!r} outside the talk zones at {pos:.0f} m"


async def test_rules_whole_lap_worst_corner_first_and_quiet_in_corners(tmp_path):
    app, spk = await run_track(tmp_path, until=lambda a: len(decisions(a)) >= 4)
    ds = decisions(app)
    first_lap = next(e for e in app.events if e["type"] == "lap_summary")
    top = first_lap["top"]
    assert {t["corner_id"] for t in top} == {"ascari", "roggia", "parabolica"}
    assert [t["time_lost_s"] for t in top] == sorted((t["time_lost_s"] for t in top), reverse=True)
    assert ds[0]["action"] == "offer_drill" and ds[0]["corner_id"] == top[0]["corner_id"]
    name = app.track.corner(ds[0]["corner_id"]).name
    assert ds[0]["cue"].startswith(name + ":")
    # the first cue is spoken on the main straight, right after the last corner
    assert spk.at[0][0].startswith(name) and (spk.at[0][1] >= 5250 or spk.at[0][1] <= 200)
    assert_quiet_in_corners(app, spk)
    # one change at a time: after the first corner converges, a different corner is coached
    assert len({d["corner_id"] for d in ds if d["action"] == "offer_drill"}) >= 2


async def test_agent_rules_plan_three_corners_in_time_order(tmp_path):
    def finished(a):
        return any(d["action"] == "end_drill" and (d.get("plan") or {}).get("finished") for d in decisions(a))
    app, spk = await run_track(tmp_path, agent=True, until=finished, max_laps=12)
    ds = decisions(app)
    plan = ds[0]["plan"]
    top = next(e for e in app.events if e["type"] == "lap_summary")["top"]
    assert ds[0]["plan_action"] == "set_plan"
    assert [g["corner_id"] for g in plan["goals"]] == [t["corner_id"] for t in top]
    assert plan["goals"][0]["title"].startswith(app.track.corner(top[0]["corner_id"]).name)
    assert finished(app), "plan did not complete in the sim"
    final = ds[-1]["plan"]
    assert [g["status"] for g in final["goals"]] == ["done", "done", "done"]
    # only the active goal's corner had a live cue armed each lap
    armed = [e for e in app.events if e["type"] == "cue_armed"]
    assert armed and sum(c.armed for c in app.live_cues.values()) <= 1
    assert_quiet_in_corners(app, spk)


class Scripted:
    """Plan turn: get_lap_summary + a corner profile, then set_plan with the SAME drill at two corners."""
    name, model, available = "scripted", "scripted-model", True

    def __init__(self):
        self.packets = []

    async def call(self, packet, mode, *, agent=None, **kw):
        self.packets.append(packet)
        if agent is None or agent.kind != "plan":
            raise ProviderError("bad_response")
        aid, top = packet["attempt_id"], packet["lap"]["top"]
        agent.run(ToolCall("get_lap_summary", {"lap": "current"}), 1)
        agent.run(ToolCall("get_driving_profile", {"attempt_id": "current", "corner_id": top[1]["corner_id"]}), 2)
        goals = []
        for t in top[:2]:
            m = t["suggested"]["brake_point"]
            goals.append({"corner_id": t["corner_id"], "drill_id": "brake_point", "target": {"marker_m": m},
                          "cue": f"Brake at the {m} m board.", "reminder": "Brake later."})
        return ModelResult(call=ToolCall("set_plan", {"attempt_id": aid, "goals": goals,
                                                      "summary": "Two corners brake early."}),
                           reasoning="lap summary, then profiles", model=self.model)

    async def warm(self):
        return 1.0


async def test_agent_model_plans_same_drill_at_two_corners(tmp_path):
    prov = Scripted()
    app, spk = await run_track(tmp_path, providers=[prov], agent=True,
                               until=lambda a: len(decisions(a)) >= 1, max_laps=3)
    d = decisions(app)[0]
    assert d["mode"] == "think" and d["plan_action"] == "set_plan", d["rungs"]
    goals = d["plan"]["goals"]
    assert [g["drill_id"] for g in goals] == ["brake_point", "brake_point"]
    assert goals[0]["corner_id"] != goals[1]["corner_id"]
    assert [c["name"] for c in d["tool_calls"]] == ["get_lap_summary", "get_driving_profile"]
    assert d["tool_calls"][1]["arguments"]["corner_id"] == goals[1]["corner_id"]
    p = prov.packets[0]
    assert p["turn"] == "plan" and p["corner_id"] == goals[0]["corner_id"]
    assert len(json.dumps(p["lap"])) < 2000  # the lap part of the packet stays small


async def test_goal_corner_missing_carries_over(tmp_path):
    t, r = track(), refs()
    events = []
    co = TrackCoach(t, r, [], events.append, voice={"max_cue_words": 12, "max_reminder_words": 4})

    def lap_runs(skip=()):
        out = {}
        for cid, (a, tr) in r.items():
            if cid in skip:
                continue
            d = {**a.__dict__, "attempt_id": f"x-{cid}"}
            if cid == "ascari":
                d["brake_onset_m"] -= 30  # 30 m early: the only corner to coach
                d["section_s"] += 0.1
            out[cid] = (Attempt.from_dict(d), tr)
        return out

    await co.on_lap(1, lap_runs())
    assert co.state == RETRY and co.offer.corner_id == "ascari"
    await co.on_lap(2, lap_runs(skip=("ascari",)))
    assert co.state == RETRY and co.offer.corner_id == "ascari" and co.drill.tries == 0
    assert any("no run at Ascari" in (e.get("message") or "") for e in events)


async def test_cli_track_and_get_track(tmp_path):
    args = build_parser().parse_args(["--track", str(FIX / "track_monza.json"), "--voice", "off",
                                      "--data-dir", str(tmp_path / "d"), "--traces", str(tmp_path / "t"),
                                      "--sim-corner", "ascari:board_m=130,release_s=0.4"])
    app = build_app(args)
    assert app.mode == "lap" and app.track.ids[0] == "t1"
    assert app.track_sim.knobs["ascari"]["board_m"] == 130 and app.track_sim.knobs["ascari"]["release_s"] == 0.4
    client = TestClient(TestServer(make_web_app(app)))
    await client.start_server()
    try:
        r = await client.get("/track")
        body = await r.json()
        assert r.status == 200 and [c["id"] for c in body["corners"]] == app.track.ids and body["laps"] == []
        snap = await (await client.get("/state")).json()
        assert snap["track"]["name"] == "Monza" and snap["focus"]["corner_id"] == "t1"
    finally:
        await client.close()
