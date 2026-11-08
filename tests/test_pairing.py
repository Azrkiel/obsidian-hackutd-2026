import ipaddress
import json

import pytest

from coach.inputs import InputHub, NullPad
from coach.pairing import Pairing, PhoneClient, local_ipv4s, parse_uri, sign

PHONE = ("192.168.1.30", 50000)
OTHER = ("192.168.1.99", 40000)


@pytest.fixture
def pairing(tmp_path):
    return Pairing(tmp_path / "pairing.json", port=5005, name="RACE-PC", hosts=["192.168.1.20", "172.20.10.2"])


def hub_for(pairing, mode="optional"):
    clock = [100.0]
    return InputHub(NullPad(), arduino="off", advertise=False, clock=lambda: clock[0],
                    pairing=pairing, pairing_mode=mode)


def paired_phone(hub, pairing, addr=PHONE):
    phone = PhoneClient(pairing.uri())
    welcome = hub.feed_phone(phone.hello(), addr)
    assert phone.accept(welcome) == "RACE-PC"
    return phone


def test_uri_round_trip(pairing):
    info = parse_uri(pairing.uri())
    assert info == {"hosts": ["192.168.1.20", "172.20.10.2"], "port": 5005, "key": pairing.key,
                    "name": "RACE-PC", "id": pairing.receiver_id}
    for bad in ("https://example.com", "nomadsim://pair?v=2&k=AAAA&p=1", "nomadsim://other?v=1"):
        with pytest.raises((ValueError, KeyError)):
            parse_uri(bad)


def test_key_is_kept_and_rotated(tmp_path, pairing):
    again = Pairing(tmp_path / "pairing.json")
    assert again.key == pairing.key and len(pairing.key) == 16
    old = pairing.receiver_id
    pairing.rotate()
    assert pairing.receiver_id != old
    assert Pairing(tmp_path / "pairing.json").key == pairing.key
    assert json.loads((tmp_path / "pairing.json").read_text())["key"]


def test_handshake_proves_both_sides(pairing):
    phone = PhoneClient(pairing.uri())
    welcome, session = pairing.welcome(phone.hello())
    assert phone.accept(welcome) == "RACE-PC" and phone.session == session.key
    # a receiver without the key can't fake the welcome, and a phone without it can't say hello
    impostor = Pairing(None, name="RACE-PC", hosts=[])
    assert PhoneClient(pairing.uri()).accept(impostor.welcome(impostor_hello(impostor))[0]) is None
    assert pairing.welcome(PhoneClient(impostor.key).hello()) is None
    tampered = welcome.replace(b"RACE-PC", b"EVIL-PC")
    assert PhoneClient(pairing.uri()).accept(tampered) is None


def impostor_hello(p):
    return PhoneClient(p.key).hello()


def test_optional_mode_accepts_the_unpaired_app(pairing):
    hub = hub_for(pairing)
    assert hub.feed_phone(b"v1,30,0.2,0.5,0", OTHER) == b"ack,30"   # today's app: plain, unsigned ack
    hub.tick()
    assert hub.pad.axes == (0.2, 0.5, 0.0)


def test_paired_phone_drives_and_gets_signed_acks(pairing):
    hub = hub_for(pairing)
    phone = paired_phone(hub, pairing)
    ack = hub.feed_phone(phone.send("v1,30,-0.4,0.8,0"), PHONE)
    assert phone.check(ack) == b"ack,30"
    hub.tick()
    assert hub.pad.axes == (-0.4, 0.8, 0.0)
    got = []
    hub.on_command = got.append
    for _ in range(3):
        hub.feed_phone(phone.send("evt,1,coach_next,tap"), PHONE)
    assert got == ["next"]
    assert hub.pairing_status()["paired"] == 1


def test_attacks_are_ignored(pairing):
    hub = hub_for(pairing)
    phone = paired_phone(hub, pairing)
    good = phone.send("v1,1,0.1,0,0")
    hub.feed_phone(good, PHONE)
    hub.feed_phone(good, PHONE)                                        # replay
    hub.feed_phone(phone.send("v1,0,0.9,0,0"), PHONE)                  # older sequence
    hub.feed_phone(good.replace(b"0.1", b"0.9"), PHONE)                # tampered value
    hub.feed_phone(b"v1,5,0.9,1,0", PHONE)                             # unsigned from the paired address
    hub.tick()
    assert hub.pad.axes == (0.1, 0.0, 0.0)
    assert hub.rejected == 2                                           # tampered + unsigned


def test_required_mode_ignores_unpaired_phones(pairing):
    hub = hub_for(pairing, "required")
    assert hub.feed_phone(b"v1,30,0.5,0.5,0", OTHER) is None
    hub.tick()
    assert hub.out["phone_live"] is False and hub.rejected == 1
    phone = paired_phone(hub, pairing)
    hub.feed_phone(phone.send("v1,1,0.3,0,0"), PHONE)
    assert hub.tick()["phone_live"] is True


def test_new_code_asks_phones_to_pair_again(pairing):
    hub = hub_for(pairing)
    phone = paired_phone(hub, pairing)
    hub.new_pairing_code()
    assert hub.feed_phone(phone.send("v1,2,0,0,0"), PHONE) == b"rehello"
    assert hub.feed_phone(phone.hello(), PHONE) is None                # old code no longer pairs
    fresh = paired_phone(hub, pairing)
    assert fresh.check(hub.feed_phone(fresh.send("v1,30,0,0,0"), PHONE)) == b"ack,30"


def test_qr_code(pairing):
    svg = pairing.qr_svg()
    assert svg.startswith("<svg") and "<path" in svg
    rows = pairing.qr_text().splitlines()
    size = pairing.qr().get_size()
    assert len(rows) == (size + 4 + 1) // 2 and all(len(r) == size + 4 for r in rows)
    big = Pairing(None, name="A" * 32, hosts=["192.168.100.200", "172.20.10.12", "10.200.200.200", "192.168.1.1"])
    assert big.qr().get_version() <= 10                                # stays easy to scan


def test_local_ipv4s_are_lan_addresses():
    for a in local_ipv4s():
        ip = ipaddress.ip_address(a)
        assert ip.version == 4 and ip.is_private and not ip.is_loopback and not ip.is_link_local


def test_signing_helpers():
    key = b"k" * 32
    assert sign(key, b"ack,30").startswith(b"ack,30,")


async def test_pairing_over_real_udp(tmp_path):
    import asyncio
    import socket

    pairing = Pairing(tmp_path / "p.json", port=0, name="RACE-PC", hosts=["127.0.0.1"])
    hub = InputHub(NullPad(), phone_port=0, arduino="off", advertise=False, pairing=pairing,
                   pairing_mode="required")
    await hub.start()
    loop = asyncio.get_running_loop()
    tx = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    tx.setblocking(False)
    try:
        port = hub._transports[0].get_extra_info("sockname")[1]
        phone = PhoneClient(pairing.uri())
        tx.sendto(phone.hello(), ("127.0.0.1", port))
        assert phone.accept(await asyncio.wait_for(loop.sock_recv(tx, 256), 2)) == "RACE-PC"
        tx.sendto(phone.send("v1,30,0.6,0.4,0"), ("127.0.0.1", port))
        assert phone.check(await asyncio.wait_for(loop.sock_recv(tx, 256), 2)) == b"ack,30"
        await asyncio.sleep(0.02)
        assert hub.out["phone_live"] and hub.pad.axes == (0.6, 0.4, 0.0)
    finally:
        tx.close()
        await hub.stop()
