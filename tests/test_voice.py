import os
import sys

import pytest

from coach.app import CoachApp
from coach.telemetry import SimSource
from engine.live_cue import LiveCue, NullPlayer
from engine.nvidia_tts import to_wav
from engine.rules import rule_decide
from engine.state import VOICE_LIMITS
from engine.tools import validate
from engine.models import ToolCall
from engine.voice import ADVICE, REMINDER, VERDICT, Announcer, FallbackSpeaker, SilentSpeaker, spoken
from engine.evidence import build_packet
from engine.models import DrillState
from conftest import attempt


class Clock:
    def __init__(self):
        self.t = 0.0

    def __call__(self):
        return self.t


def sync(fn):
    fn()


def make(quiet=(240, 540), **kw):
    clk, spk, ev = Clock(), SilentSpeaker(), []
    a = Announcer(spk, quiet_zone=quiet, clock=clk, runner=sync, on_event=ev.append, **kw)
    return a, clk, spk, ev


# ---------------- spoken text ----------------
def test_spoken_units():
    assert spoken("Brake at the 100 m board.") == "Brake at the 100 board."
    assert spoken("Better, 4 m earlier.") == "Better, 4 metres earlier."
    assert spoken("Release over 0.6 s.") == "Release over 0.6 seconds."
    assert spoken("  two   spaces ") == "two spaces"


# ---------------- announcer rules ----------------
def test_speaks_immediately_outside_quiet_zone():
    a, clk, spk, ev = make()
    a.on_position(600)
    a.say("Brake earlier.", ADVICE)
    assert spk.said == ["Brake earlier."]
    assert [e["status"] for e in ev] == ["queued", "speaking", "spoken"]


def test_quiet_zone_holds_then_releases():
    a, clk, spk, _ = make()
    a.on_position(300)  # inside the corner
    a.say("Brake earlier.", ADVICE)
    assert spk.said == [] and len(a.queue) == 1
    clk.t = 2.0
    a.on_position(545)
    a.pump()
    assert spk.said == ["Brake earlier."]


def test_min_gap_between_messages():
    a, clk, spk, _ = make()
    a.on_position(600)
    a.say("One.", ADVICE)
    clk.t = 1.0
    a.say("Two.", VERDICT)
    assert spk.said == ["One."]
    clk.t = 4.9
    a.pump()
    assert spk.said == ["One."]
    clk.t = 5.1
    a.pump()
    assert spk.said == ["One.", "Two."]


def test_stale_message_dropped_not_played_late():
    a, clk, spk, ev = make()
    a.on_position(300)
    a.say("Too late.", ADVICE)
    clk.t = 10.5
    a.on_position(600)
    a.pump()
    assert spk.said == []
    assert ev[-1]["status"] == "dropped" and ev[-1]["reason"] == "stale"


def test_reminder_stale_after_3s_and_newest_wins():
    a, clk, spk, ev = make()
    a.on_position(300)
    a.say("Brake earlier.", REMINDER)
    a.say("Brake later.", REMINDER)
    assert [m.text for m in a.queue] == ["Brake later."]
    clk.t = 3.5
    a.on_position(600)
    a.pump()
    assert spk.said == []


def test_reminder_jumps_the_queue():
    a, clk, spk, _ = make()
    a.on_position(300)
    a.say("Advice.", ADVICE)
    a.say("Remind.", REMINDER)
    a.on_position(600)
    a.pump()
    assert spk.said == ["Remind."]


def test_mute_drops_queue_and_new_messages():
    a, clk, spk, ev = make()
    a.on_position(300)
    a.say("Queued.", ADVICE)
    a.set_muted(True)
    a.say("New.", ADVICE)
    a.on_position(600)
    a.pump()
    assert spk.said == [] and not a.queue
    assert a.toggle_mute() is False
    a.say("Back.", ADVICE)
    assert spk.said == ["Back."]


def test_speaker_error_is_reported_and_does_not_block():
    class Broken:
        name = "broken"

        def speak(self, text):
            raise RuntimeError("no audio")

    ev, clk = [], Clock()
    a = Announcer(Broken(), clock=clk, runner=sync, on_event=ev.append)
    a.say("Hi.", ADVICE)
    assert ev[-1]["status"] == "error" and not a.speaking


def test_fallback_speaker():
    class Broken:
        name = "nvidia"

        def speak(self, text):
            raise RuntimeError("down")

    fb = SilentSpeaker()
    FallbackSpeaker(Broken(), fb).speak("Hello.")
    assert fb.said == ["Hello."]


def test_to_wav_wraps_raw_pcm():
    w = to_wav(b"\x00\x00" * 100)
    assert w[:4] == b"RIFF"
    assert to_wav(w) == w


# ---------------- live cue: reminder + lap wrap ----------------
def test_reminder_waits_for_lap_wrap(corner):
    said, player = [], NullPlayer()
    c = LiveCue(corner, player, say=said.append)
    c.arm("brake_point", {"marker_m": 100}, reminder="Brake earlier.", wait_wrap=True)
    t = 0.0
    for pos in [560, 600, 2000, 5700, 5790]:  # rest of the lap: nothing fires
        c.on_sample(t, pos, 200)
        t += 0.01
    assert said == [] and c.pending_wrap
    for pos in range(2, 360, 2):  # new lap through the reminder and the brake board
        c.on_sample(t, pos, 0.0)
        t += 0.01
    assert said == ["Brake earlier."]
    assert player.calls == ["pre", "mark"]


def test_reminder_needs_say_callback(corner):
    c = LiveCue(corner, NullPlayer())
    c.arm("brake_point", {"marker_m": 100}, reminder="Brake earlier.")
    assert [n for n, _ in c._cues] == ["pre", "mark"]


def test_brake_release_cue_at_turn_in(corner):
    p = NullPlayer()
    c = LiveCue(corner, p)
    c.arm("brake_release", {"release_s": 0.6})
    t = 0.0
    for pos in range(380, 440, 2):
        c.on_sample(t, pos, 0.0)
        t += 0.01
    assert p.calls == ["mark"]


# ---------------- rules: spoken style ----------------
@pytest.mark.parametrize("name", ["late_brake", "early_throttle", "clean", "invalid", "not_comparable"])
def test_rules_voice_baseline_short_and_valid(corner, ref, name):
    a = attempt(name)
    p = build_packet(a, ref, a if a.valid else None, corner, None, None, voice=VOICE_LIMITS)
    d = rule_decide(p)
    text = d.cue if d.action == "offer_drill" else d.summary
    assert len(text.split()) <= 12, text
    if d.action == "offer_drill":
        assert 0 < len(d.reminder.split()) <= 4
        call = ToolCall("offer_drill", {"attempt_id": p["attempt_id"], "drill_id": d.drill_id,
                                        "target": d.target, "cue": d.cue, "reminder": d.reminder})
        assert validate(call, p) == (True, None)


@pytest.mark.parametrize("name", ["retry_close", "retry_hit", "retry_early", "retry_invalid"])
def test_rules_voice_retry_short(corner, ref, name):
    base = attempt("late_brake")
    p = build_packet(attempt(name), ref, base, corner, DrillState("brake_point", {"marker_m": 100}, 1),
                     base, voice=VOICE_LIMITS)
    d = rule_decide(p)
    text = d.cue if d.action == "offer_drill" else d.summary
    assert len(text.split()) <= 12, text


def test_voice_validation_limits(mk_packet, corner, ref):
    a = attempt("late_brake")
    p = build_packet(a, ref, a, corner, None, None, voice=VOICE_LIMITS)
    base = {"attempt_id": p["attempt_id"], "drill_id": "brake_point", "target": {"marker_m": 100}}
    long_cue = "Next time please brake a bit earlier than you did, at the 100 m board."
    assert not validate(ToolCall("offer_drill", {**base, "cue": long_cue}), p)[0]
    ok = {**base, "cue": "Brake earlier, at the 100 m board."}
    assert validate(ToolCall("offer_drill", {**ok, "reminder": "Brake earlier."}), p)[0]
    assert not validate(ToolCall("offer_drill", {**ok, "reminder": "Brake a little bit earlier."}), p)[0]
    assert not validate(ToolCall("offer_drill", {**ok, "reminder": "Brake at 93."}), p)[0]
    end = ToolCall("end_drill", {"attempt_id": "x", "reason": "invalid_run", "summary": ""})
    pi = build_packet(attempt("invalid"), ref, None, corner, None, None, voice=VOICE_LIMITS)
    end.arguments["attempt_id"] = pi["attempt_id"]
    assert not validate(end, pi)[0]  # spoken summary may not be empty
    # drill mode (no voice): reminder is dropped, 20-word cues still fine
    q = build_packet(a, ref, a, corner, None, None)
    c = ToolCall("offer_drill", {**ok, "reminder": "whatever you like here please"})
    assert validate(c, q)[0] and "reminder" not in c.arguments


# ---------------- lap mode end to end (V5 in the simulator) ----------------
async def test_lap_mode_three_laps_no_clicks(corner, ref, tmp_path):
    spk = SilentSpeaker()
    src = SimSource(corner, realtime=False, laps=True, lap_gap_s=8.0)
    app = CoachApp(corner, ref, src, [], reset_mode="manual", data_dir=tmp_path / "d",
                   trace_dir=tmp_path / "t", sound=False, countdown=0, persist_checkpoint=False,
                   mode="lap", speaker=spk,
                   announcer_kwargs={"runner": sync, "clock": lambda: src.t})
    await app.start()
    try:
        await app.wait_for(lambda: len([e for e in app.events if e["type"] == "decision"]) >= 3, 30)
        await app.wait_for(lambda: len(spk.said) >= 4, 30)
    finally:
        await app.stop()
    runs = [e["role"] for e in app.events if e["type"] == "run"]
    assert runs[:3] == ["baseline", "retry", "retry"]
    assert not [e for e in app.events if e["type"] in ("reset_request", "countdown")]
    decisions = [e for e in app.events if e["type"] == "decision"]
    assert decisions[0]["action"] == "offer_drill" and decisions[0]["drill_id"] == "brake_point"
    assert decisions[0]["reminder"] == "Brake earlier."
    # advice after lap 1, reminder on the lap-2 approach, verdict after lap 2, then lap 3
    assert spk.said[0] == "Brake 14 metres earlier, at the 100 board."
    assert spk.said[1] == "Brake earlier."
    assert spk.said[2].startswith("Better,")
    assert decisions[-1]["action"] == "end_drill" or spk.said[3] == "Brake earlier."
    spoken_events = [e for e in app.events if e["type"] == "voice" and e["status"] == "spoken"]
    for e in spoken_events:
        assert len(e["text"].split()) <= 12


async def test_drill_mode_unchanged_without_voice(corner, ref, tmp_path):
    app = CoachApp(corner, ref, SimSource(corner, realtime=False), [], reset_mode="sim",
                   data_dir=tmp_path / "d", trace_dir=tmp_path / "t", sound=False, countdown=0,
                   persist_checkpoint=False)
    assert app.announcer is None and app.coach.voice is None
    await app.handle_command({"type": "toggle_mute"})
    assert app.events[-1]["message"].startswith("ignored: voice is off")


@pytest.mark.skipif(sys.platform != "win32" or not os.environ.get("PITPAL_SAPI_TEST"),
                    reason="set PITPAL_SAPI_TEST=1 on Windows to start the real voice")
def test_sapi_speaker_null_output():
    from engine.voice import SapiSpeaker
    s = SapiSpeaker(null_output=True)
    try:
        s.speak("Brake at the 100 board.")
        s.speak("Better, 4 metres earlier.")
    finally:
        s.close()


async def test_lap_mode_brake_release_drill(corner, ref, tmp_path):
    spk = SilentSpeaker()
    src = SimSource(corner, realtime=False, laps=True, lap_gap_s=8.0, brake_board_m=100, release_s=0.15)
    app = CoachApp(corner, ref, src, [], reset_mode="manual", data_dir=tmp_path / "d",
                   trace_dir=tmp_path / "t", sound=False, countdown=0, persist_checkpoint=False,
                   mode="lap", speaker=spk, announcer_kwargs={"runner": sync, "clock": lambda: src.t})
    await app.start()
    try:
        await app.wait_for(lambda: len([e for e in app.events if e["type"] == "decision"]) >= 3, 30)
    finally:
        await app.stop()
    ds = [e for e in app.events if e["type"] == "decision"]
    assert ds[0]["drill_id"] == "brake_release" and ds[0]["target"] == {"release_s": 0.5}
    assert ds[0]["reminder"] == "Ease off slowly."
    assert spk.said[0] == "Ease off the brake slower as you turn in."
    runs = [e["attempt"]["release_s"] for e in app.events if e["type"] == "run"]
    assert runs[1] > runs[0]  # the sim driver follows the drill
    assert any(d["action"] == "end_drill" and d["end_reason"] == "drill_complete" for d in ds)


# ---------------- whole lap: quiet in every corner, talk only on straights (W8) ----------------
def test_track_zones_quiet_in_every_corner_and_talk_only_on_straights():
    a, clk, spk, _ = make(quiet=None, quiet_zones=[(240, 540), (1500, 1800)],
                          talk_zones=[(5300, 200), (560, 1480)])
    a.on_position(1600)  # inside the second corner
    a.say("Brake earlier.", ADVICE)
    assert spk.said == []
    a.on_position(1850)  # between corners but not a talk zone
    a.pump()
    assert spk.said == []
    clk.t = 1.0
    a.on_position(600)
    a.pump()
    assert spk.said == ["Brake earlier."]


def test_talk_zone_wraps_over_the_lap_line():
    a, clk, spk, _ = make(quiet=None, quiet_zones=[(240, 540)], talk_zones=[(5300, 200)])
    for pos, ok in ((5400, True), (100, True), (220, False), (5000, False)):
        a.on_position(pos)
        assert a.can_talk is ok, pos


def test_message_never_in_a_talk_zone_goes_stale():
    a, clk, spk, ev = make(quiet=None, talk_zones=[(5300, 200)])
    a.on_position(3000)
    a.say("Same again.", ADVICE)
    clk.t = 11.0
    a.pump()
    assert spk.said == [] and ev[-1]["status"] == "dropped" and ev[-1]["reason"] == "stale"


def test_no_telemetry_can_talk_with_zones():
    a, clk, spk, _ = make(quiet=None, quiet_zones=[(240, 540)], talk_zones=[(5300, 200)])
    a.say("Hello.", ADVICE)
    assert spk.said == ["Hello."]
