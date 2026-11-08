"""Pit Pal overlay: Rev's brain (no Tk), the live telemetry feed, the pairing link, Rev's own lines."""
import asyncio

from aiohttp.test_utils import TestClient, TestServer

from coach.app import CoachApp
from coach.dashboard import make_web_app
from coach.inputs import InputHub, NullPad
from coach.pairing import Pairing
from coach.rev_lines import RevLines, clean
from coach.telemetry import Sample, SimSource
from pitpal.model import BASE, HELMET, RACER, SUIT, RevModel, split_cue


def health(phone="silent", arduino="silent", mode="fast", pairing=True, muted=False):
    return {"type": "health", "ai": {"mode": mode, "label": "Nemotron · fast"},
            "inputs": {"phone": phone, "arduino": arduino, "pairing": {"mode": "optional"} if pairing else None},
            "voice": {"speaker": "windows", "muted": muted, "queued": 0}, "track": "Monza"}


def tele(**kw):
    return {"type": "telemetry", "status": "live", "speed_kmh": 140.0, "gas": 0.8, "brake": 0.0, "steer": 0.0,
            "pos_m": 900.0, "g_lat": 0.1, "slip_f": 0.02, "slip_r": 0.03, "tyres_out": 0, **kw}


def test_split_cue_keeps_it_short():
    assert split_cue("Brake 12 m later. Keep the car straight.") == ("Brake 12 m later.", "")
    long = "You braked very late into the first chicane and ran wide over the kerb at the exit"
    first, rest = split_cue(long)
    assert len(first.split()) <= 9 and first.endswith("…") and rest == ""


def test_offline_then_pairing_then_connected():
    m = RevModel()
    v = m.view(0.0)
    assert v.outfit == BASE and "coach" in v.bubble["sub"] and v.bubble["title"] == "Rev"
    m.feed({"type": "_conn", "online": True}, 0.0)
    m.feed({"type": "_pair", "uri": "nomadsim://pair?x"}, 0.0)
    m.feed(health(), 0.0)
    assert m.view(1.0).bubble["kind"] == "idle"                  # grace: a paired phone may reconnect itself
    v = m.view(3.0)
    assert v.bubble["kind"] == "pairing" and v.bubble["uri"] == "nomadsim://pair?x" and v.outfit == BASE
    m.feed(health(phone="live"), 4.0)
    v = m.view(4.1)
    assert v.bubble["bold"] == "Connected." and v.outfit == RACER
    assert m.view(9.0).bubble["kind"] == "idle"                  # the QR never comes back once paired
    assert not m.pair_wanted()


def test_no_pairing_bubble_without_inputs():
    m = RevModel()
    m.feed({"type": "_conn", "online": True}, 0.0)
    m.feed({"type": "_pair", "uri": None}, 0.0)
    m.feed(health(pairing=False), 0.0)
    assert m.view(10.0).bubble["kind"] == "idle"


def test_talking_shows_short_text_and_never_changes_outfit():
    m = RevModel()
    m.feed({"type": "_conn", "online": True}, 0.0)
    m.feed(health(phone="live"), 0.0)
    assert m.view(0.1).outfit == RACER
    m.feed({"type": "voice", "id": 1, "status": "speaking", "text": "Brake 12 m later. Keep the car straight."}, 1.0)
    for i in range(14):
        m.feed(tele(), 1.0 + i * 0.1)                            # the car starts moving mid-sentence
    v = m.view(2.5)
    assert v.bubble == {"kind": "text", "bold": "Brake 12 m later.", "rest": ""} and v.anim == "talk"
    assert v.outfit == RACER and m.racing                        # helmet waits until Rev stops talking
    m.feed({"type": "voice", "id": 1, "status": "spoken", "text": "x"}, 2.6)
    assert m.view(2.7).outfit == RACER
    assert m.view(4.2).outfit == HELMET


def test_offer_countdown_and_rewind():
    m = RevModel()
    m.feed({"type": "_conn", "online": True}, 0.0)
    m.feed({"type": "offer", "id": "e1", "state": "waiting_cue", "corner": "Turn 1"}, 1.0)
    assert m.view(1.1).bubble["kind"] == "thinking" and "Turn 1" in m.view(1.1).bubble["label"]
    m.feed({"type": "offer", "id": "e1", "state": "open", "corner": "Turn 1", "cue": "Brake at the 100 m board.",
            "ms_left": 5000}, 2.0)
    full, half = m.view(2.0).bubble, m.view(4.5).bubble
    assert full["kind"] == "offer" and full["frac"] == 1.0 and abs(half["frac"] - 0.5) < 0.01
    assert "accept" in m.view(2.0).actions
    m.feed({"type": "offer", "id": "e1", "state": "accepted"}, 5.0)
    m.feed({"type": "countdown", "n": 3}, 5.1)
    v = m.view(5.2)
    assert v.bubble["kind"] == "countdown" and v.bubble["n"] == 3 and v.outfit == SUIT
    m.feed({"type": "countdown", "n": 0}, 8.1)
    assert m.view(8.2).bubble["kind"] != "countdown"
    m.feed({"type": "retry_judged", "try": 2, "fixed": True}, 8.3)
    assert m.view(8.4).bubble["bold"] == "Clean." and m.tries == 2


def test_expired_offer_is_dropped():
    m = RevModel()
    m.feed({"type": "_conn", "online": True}, 0.0)
    m.feed({"type": "offer", "id": "e1", "state": "open", "cue": "Brake later.", "ms_left": 5000}, 0.0)
    m.feed({"type": "offer", "id": "e1", "state": "expired"}, 5.0)
    assert m.offer is None


def test_racing_helmet_and_lockup_reaction_with_cooldown():
    m = RevModel()
    m.feed({"type": "_conn", "online": True}, 0.0)
    m.feed(health(phone="live"), 0.0)
    for i in range(20):
        m.feed(tele(), i * 0.1)
    assert m.racing and m.view(2.0).outfit == HELMET
    m.feed(tele(brake=0.95, slip_f=0.6), 2.1)
    v = m.view(2.2)
    assert v.bubble["kind"] == "warn" and v.bubble["bold"] == "Lock-up." and v.anim == "wince"
    m.feed(tele(brake=0.95, slip_f=0.6), 5.0)                    # cooldown: no second reaction
    assert m.view(5.0).bubble is None or m.view(5.0).bubble["kind"] != "warn"


def test_parked_car_gets_no_reactions_and_stops_racing():
    m = RevModel()
    m.feed({"type": "_conn", "online": True}, 0.0)
    m.feed(health(phone="live"), 0.0)
    for i in range(15):
        m.feed(tele(), i * 0.1)
    assert m.racing
    for i in range(70):
        m.feed(tele(speed_kmh=0.0, brake=1.0, slip_f=0.9), 2.0 + i * 0.1)
    assert not m.racing
    v = m.view(20.0)                                             # long after "Lights out." has faded
    assert m.moment is None and (v.bubble is None or v.bubble["kind"] != "warn")


def test_pedal_dropout_warns_only_after_it_lasts():
    m = RevModel()
    m.feed({"type": "_conn", "online": True}, 0.0)
    m.feed(health(phone="live", arduino="live"), 0.0)
    m.feed(health(phone="live", arduino="silent"), 1.0)
    assert m.view(1.5).bubble["kind"] != "warn"                  # a wobbling cable is not a warning
    v = m.view(3.5)
    assert v.bubble["kind"] == "warn" and v.bubble["bold"] == "Pedals lost." and v.outfit == BASE
    m.feed(health(phone="live", arduino="live"), 4.0)
    assert m.view(4.1).bubble["kind"] != "warn"


def test_voice_off_decision_is_shown_and_muted_cue_too():
    m = RevModel()
    m.feed({"type": "_conn", "online": True}, 0.0)
    h = health(phone="live")
    h["voice"] = None
    m.feed(h, 0.0)
    m.feed({"type": "decision", "cue": "Brake a little earlier. At the 100 m board."}, 1.0)
    assert m.view(1.1).bubble["bold"] == "Brake a little earlier."
    m2 = RevModel()
    m2.feed({"type": "_conn", "online": True}, 0.0)
    m2.feed({"type": "voice", "id": 3, "status": "dropped", "reason": "muted", "text": "Brake later."}, 1.0)
    assert m2.view(1.1).bubble["bold"] == "Brake later."


def test_ai_dropping_to_rules_is_flagged_once():
    m = RevModel()
    m.feed({"type": "_conn", "online": True}, 0.0)
    m.feed(health(mode="fast"), 0.0)
    m.feed(health(mode="rules"), 1.0)
    assert m.view(1.1).bubble["bold"] == "AI offline."


def test_rev_line_event_is_shown():
    m = RevModel()
    m.feed({"type": "_conn", "online": True}, 0.0)
    m.feed({"type": "rev_line", "text": "Quick lap. Hold that pace.", "mood": "good"}, 1.0)
    v = m.view(1.1)
    assert v.bubble["bold"] == "Quick lap." and v.anim == "hop"


# ---- the coach side
def sample(t, speed=140.0):
    return Sample(t=t, packet_id=int(t * 100), status="live", pos_norm=0.1, pos_m=500.0 + t, speed_kmh=speed,
                  gas=0.8, brake=0.0, steer=0.1, x=0.0, y=0.0, z=0.0)


async def make_app(corner, ref, tmp_path, inputs=None):
    app = CoachApp(corner, ref, SimSource(corner, realtime=False), [], reset_mode="sim",
                   data_dir=tmp_path / "d", trace_dir=tmp_path / "t", sound=False, countdown=0,
                   persist_checkpoint=False, inputs=inputs)
    client = TestClient(TestServer(make_web_app(app)))
    await client.start_server()
    return app, client


async def test_telemetry_feed_is_throttled_and_not_history(corner, ref, tmp_path):
    app, client = await make_app(corner, ref, tmp_path)
    try:
        got = []
        app.subscribe(got.append)
        for i in range(200):                                     # 200 samples at 100 Hz: ~2 s of driving
            app._on_sample(sample(i * 0.01))
            if i % 10 == 9:
                await asyncio.sleep(0.02)
        tel = [e for e in got if e["type"] == "telemetry"]
        assert 3 <= len(tel) <= 40                               # far fewer than the 200 samples
        assert tel[0]["status"] == "live" and tel[0]["speed_kmh"] == 140.0 and "tyres_out" in tel[0]
        assert not any(e["type"] == "telemetry" for e in app.events)
    finally:
        await client.close()


async def test_no_subscribers_no_telemetry_events(corner, ref, tmp_path):
    app, client = await make_app(corner, ref, tmp_path)
    try:
        for i in range(30):
            app._on_sample(sample(i * 0.05))
        assert not any(e["type"] == "telemetry" for e in app.events)
    finally:
        await client.close()


async def test_pair_json_serves_the_link_only_when_pairing_is_on(corner, ref, tmp_path):
    app, client = await make_app(corner, ref, tmp_path)
    try:
        assert (await client.get("/pair.json")).status == 404
    finally:
        await client.close()
    pairing = Pairing(tmp_path / "pairing.json", port=5005, name="RACE-PC", hosts=["192.168.1.20"])
    hub = InputHub(NullPad(), arduino="off", advertise=False, pairing=pairing, pairing_mode="optional")
    app, client = await make_app(corner, ref, tmp_path, inputs=hub)
    try:
        r = await client.get("/pair.json")
        body = await r.json()
        assert r.status == 200 and body["uri"] == pairing.uri() and body["uri"].startswith("nomadsim://pair")
        assert body["paired"] == 0 and r.headers["Cache-Control"] == "no-store"
        assert (await client.get("/pair.svg")).status == 200      # the old route still works
    finally:
        await client.close()


# ---- Rev's own lines
class FakeApp:
    def __init__(self, providers):
        self.providers, self.sent, self.said = providers, [], []
        said = self.said
        self.announcer = type("A", (), {"say": lambda s, t, k, **m: said.append((t, k, m))})()

    def broadcast(self, e):
        self.sent.append(e)

    def _spawn(self, coro):
        return asyncio.get_running_loop().create_task(coro)


class Good:
    available = True

    async def say(self, system, user, max_tokens=48):
        assert "Rev" in system and "quick_lap" in user
        return '"Nice one, that was clean!!"\n'


class Slow(Good):
    async def say(self, *a, **k):
        await asyncio.sleep(5)


class Broken(Good):
    async def say(self, *a, **k):
        raise RuntimeError("endpoint down")


def test_clean_accepts_short_plain_lines_only():
    assert clean('"Quick lap!"') == "Quick lap."
    assert clean("x " * 20) is None and clean("") is None and clean("Nice one 🏁") is None


async def test_rev_line_from_nemotron_is_broadcast_and_spoken():
    app = FakeApp([Good()])
    ev = await RevLines(app).line({"kind": "quick_lap", "facts": {"lap_time_s": 85.2}})
    assert ev["source"] == "nemotron" and ev["text"] == "Nice one, that was clean."
    assert app.sent == [ev] and app.said[0][0] == "Nice one, that was clean."


async def test_rev_line_falls_back_to_rules_when_the_model_is_slow_or_down():
    for prov in (Slow(), Broken(), None):
        app = FakeApp([] if prov is None else [prov])
        ev = await RevLines(app, timeout_s=0.05).line({"kind": "slow_lap", "facts": {}})
        assert ev["source"] == "rules" and ev["mood"] == "bad" and ev["text"] == "Slow lap. Reset and go again."


async def test_rev_lines_only_react_to_real_moments_and_not_too_often():
    app, now = FakeApp([]), [0.0]
    rl = RevLines(app, min_gap_s=10, clock=lambda: now[0])
    rl.on_event({"type": "track_lap", "lap_time_s": 90.0, "delta_s": 0.1})       # unremarkable
    rl.on_event({"type": "decision"})
    await asyncio.sleep(0.01)
    assert app.sent == []
    rl.on_event({"type": "track_lap", "lap_time_s": 85.0, "delta_s": -0.4})
    rl.on_event({"type": "retry_judged", "try": 2, "fixed": True})               # too soon after the last line
    await asyncio.sleep(0.05)
    assert [e["moment"] for e in app.sent] == ["quick_lap"]
    now[0] = 30.0
    rl.on_event({"type": "retry_judged", "try": 2, "fixed": True})
    await asyncio.sleep(0.05)
    assert [e["moment"] for e in app.sent] == ["quick_lap", "fixed"]


def test_rev_lines_without_an_event_loop_never_raise():
    RevLines(FakeApp([])).on_event({"type": "retry_judged", "try": 1, "fixed": True})
