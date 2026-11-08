import pytest

from coach.inputs import STALE_S, TAP_S, InputHub, NullPad, RunInputs, parse_arduino, parse_phone

PHONE = ("192.168.1.20", 50000)


class Clock:
    def __init__(self):
        self.now = 100.0

    def __call__(self):
        return self.now


@pytest.fixture
def hub():
    clock = Clock()
    h = InputHub(NullPad(), arduino="off", clock=clock, advertise=False)
    h.clock_ = clock
    return h


def test_parse_phone():
    assert parse_phone(b"v1,42,-0.5,0.75,0") == ("v1", 42, -0.5, 0.75, 0.0)
    assert parse_phone(b"v1,1,-3,2,-1") == ("v1", 1, -1, 1, 0)  # clamped
    assert parse_phone(b"evt,12,shift_up,tap") == ("evt", 12, "shift_up", "tap")
    for bad in (b"", b"v1,1,0,0", b"v1,x,0,0,0", b"v1,1,nan,0,0", b"evt,1,horn,hold", b"\xff", b"ack,30"):
        assert parse_phone(bad) is None


def test_parse_arduino():
    assert parse_arduino("250,1000\r\n") == (0.25, 1.0)
    assert parse_arduino("-5,2000") == (0.0, 1.0)
    for bad in ("", "# calibrating", "1,2,3", "a,b"):
        assert parse_arduino(bad) is None


def test_arduino_pedals_win_over_phone(hub):
    hub.feed_phone(b"v1,1,0.3,0.9,0.0", PHONE)
    hub.feed_arduino("200,600")
    out = hub.tick()
    assert out["pedal_source"] == "arduino"
    assert hub.pad.axes == (0.3, 0.2, 0.6)  # steer from phone, pedals from Arduino


def test_phone_pedals_are_the_fallback(hub):
    hub.feed_arduino("200,600")
    hub.feed_phone(b"v1,1,0.3,0.9,0.1", PHONE)
    hub.clock_.now += STALE_S / 2
    hub.feed_phone(b"v1,2,0.3,0.9,0.1", PHONE)
    hub.clock_.now += STALE_S / 2 + 0.01   # Arduino now stale, phone fresh
    out = hub.tick()
    assert out["pedal_source"] == "phone" and hub.pad.axes == (0.3, 0.9, 0.1)
    hub.feed_arduino("0,0")                 # Arduino back: it takes over again
    assert hub.tick()["pedal_source"] == "arduino"


def test_everything_stale_goes_neutral(hub):
    hub.feed_phone(b"v1,1,0.5,0.8,0", PHONE)
    hub.feed_phone(b"evt,1,horn,down", PHONE)
    hub.tick()
    assert "A" in hub.pad.buttons
    hub.clock_.now += STALE_S + 0.01
    out = hub.tick()
    assert out["pedal_source"] == "none" and hub.pad.axes == (0.0, 0.0, 0.0)
    assert "A" not in hub.pad.buttons       # held horn released by the failsafe


def test_phone_silent_keeps_arduino_pedals_but_centres_steering(hub):
    hub.feed_phone(b"v1,1,0.5,0,0", PHONE)
    hub.clock_.now += STALE_S + 0.01
    hub.feed_arduino("700,0")
    hub.tick()
    assert hub.pad.axes == (0.0, 0.7, 0.0)


def test_ack_every_30_and_stale_sequence_dropped(hub):
    assert hub.feed_phone(b"v1,30,0,0,0", PHONE) == b"ack,30"
    assert hub.feed_phone(b"v1,31,0,0,0", PHONE) is None
    hub.feed_phone(b"v1,29,0.9,0,0", PHONE)  # late packet: ignored
    assert hub.steer == 0.0
    hub.feed_phone(b"v1,0,0.4,0,0", ("192.168.1.20", 50001))  # app restarted (new port)
    assert hub.steer == 0.4


def test_events_dedupe_and_taps_release(hub):
    for _ in range(3):
        hub.feed_phone(b"evt,7,shift_up,tap", PHONE)
    assert hub.pad.log == [("press", "RIGHT_SHOULDER")]
    hub.clock_.now += TAP_S + 0.001
    hub.tick()
    assert hub.pad.log[-1] == ("release", "RIGHT_SHOULDER")


def test_invert_steer():
    h = InputHub(NullPad(), arduino="off", invert_steer=True, clock=Clock(), advertise=False)
    h.feed_phone(b"v1,1,0.25,0,0", PHONE)
    h.tick()
    assert h.pad.axes[0] == -0.25


def test_run_inputs_summary():
    r = RunInputs()
    assert r.summary() is None
    live = {"pedal_source": "arduino", "phone_live": True, "steer": 0, "gas": 0.5, "brake": 0.0}
    for _ in range(8):
        r.add(live, game_gas=0.5, game_brake=0.0)
    r.add({**live, "pedal_source": "phone"}, 0.5, 0.0)
    r.add({**live, "pedal_source": "none", "phone_live": False}, 0.5, 0.0)
    s = r.summary()
    assert s["pedal_source"] == "mixed"
    assert s["phone_fallback_pct"] == 10 and s["no_pedal_input_pct"] == 10
    assert s["phone_link_drops"] == 1 and s["pedal_link_drops"] == 1


async def test_hub_receives_real_udp():
    import asyncio
    import socket

    hub = InputHub(NullPad(), phone_port=0, arduino="off", advertise=False)
    await hub.start()
    try:
        port = hub._transports[0].get_extra_info("sockname")[1]
        loop = asyncio.get_running_loop()
        tx = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        tx.setblocking(False)
        tx.sendto(b"v1,30,-0.5,0.4,0", ("127.0.0.1", port))
        reply = await asyncio.wait_for(loop.sock_recv(tx, 64), 2)
        tx.close()
        await asyncio.sleep(0.02)
        assert reply == b"ack,30"
        assert hub.out["pedal_source"] == "phone" and hub.pad.axes == (-0.5, 0.4, 0.0)
    finally:
        await hub.stop()
    assert hub.pad.axes == (0.0, 0.0, 0.0)
