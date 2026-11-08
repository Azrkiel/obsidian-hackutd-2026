"""Stage F, receiver side: ofr/ofx pushed to the phone, signed when paired; Next accepts the offer."""
import dataclasses

from coach.inputs import InputHub
from coach.lap_coach import LapCoach
from coach.offers import OfferManager
from coach.pairing import Pairing, PhoneClient, verify
from coach.events import RetryStart

PHONE, OTHER = ("192.168.1.20", 50000), ("192.168.1.30", 50001)


class Clock:
    t = 100.0

    def __call__(self):
        return self.t


class Sent:
    def __init__(self):
        self.out = []

    def sendto(self, data, addr):
        self.out.append((data, addr))


def hub(mode="optional", pairing=None, clock=None):
    h = InputHub(pad=None, arduino="off", advertise=False, pairing=pairing, pairing_mode=mode,
                 clock=clock or Clock())
    h._transports.append(Sent())
    return h


def test_plain_push_to_an_unpaired_phone():
    h = hub()
    assert h.send_phone("ofr,e1,Lesmo 1,4800") == 0            # no phone driving yet
    h.feed_phone(b"v1,1,0.1,0,0", PHONE)
    assert h.send_phone("ofr,e1,Lesmo 1,4800") == 1
    assert h._transports[0].out == [(b"ofr,e1,Lesmo 1,4800", PHONE)]


def test_signed_push_to_a_paired_phone_and_none_to_strangers(tmp_path):
    p = Pairing(tmp_path / "pair.json", name="PC", hosts=["192.168.1.5"])
    clock = Clock()
    h = hub(pairing=p, clock=clock)
    phone = PhoneClient(p.uri())
    phone.accept(h.feed_phone(phone.hello(), PHONE))
    h.feed_phone(phone.send("v1,1,0,0,0"), PHONE)
    h._phones[OTHER] = clock.t                                 # an unpaired device seen earlier
    h.send_phone("ofx,e1")
    (data, addr), = h._transports[0].out
    assert addr == PHONE and verify(h.sessions[PHONE].key, data) == b"ofx,e1"


def test_phones_that_stop_driving_get_nothing():
    clock = Clock()
    h = hub(clock=clock)
    h.feed_phone(b"v1,1,0,0,0", PHONE)
    clock.t += 3
    assert h.send_phone("ofx,e1") == 0


class FakeApp:
    def __init__(self, inputs, clock):
        from coach.track import Track
        self.track_model, self.lead_time_s, self.inputs = Track.load(), 4.0, inputs
        self.base_corner = None
        self.broadcast = lambda e: None
        self.offers_clock = clock


def test_lap_coach_pushes_at_4_per_second_then_closes(monkeypatch):
    import coach.lap_coach as lcm
    monkeypatch.setattr(lcm, "PassScorer", lambda *a, **k: None)
    clock = Clock()
    h = hub(clock=clock)
    h.feed_phone(b"v1,1,0,0,0", PHONE)
    offers = OfferManager(countdown_s=5, clock=clock, on_change=lambda e: None)
    lc = LapCoach(FakeApp(h, clock), offers=offers)
    E = dataclasses.make_dataclass("E", ["id", "corner_id", "corner", "severity", "kinds", "facts"])
    ev = E("e7", "lesmo1", "Lesmo 1", "minor", ["time_lost"], {})
    o, _ = offers.new(ev, RetryStart("sim", 1800, 230))
    offers.cue_delivered("e7", "cue", "rules")
    sent = h._transports[0].out
    for i in range(20):                                        # 1 s of 0.05 s ticks
        clock.t = 100.0 + i * 0.05
        h._phones[PHONE] = clock.t
        lc._push_phone()
    ofr = [d for d, _ in sent if d.startswith(b"ofr,")]
    assert len(ofr) == 4 and ofr[0] == b"ofr,e7,Lesmo 1,5000" and ofr[-1].endswith(b",4250")
    offers.accept()
    lc._push_phone()
    assert [d for d, _ in sent[-3:]] == [b"ofx,e7"] * 3
