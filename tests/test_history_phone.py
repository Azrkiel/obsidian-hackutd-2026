import json
from unittest.mock import Mock

from coach.inputs import InputHub, _PhoneProto
from coach.pairing import Pairing, PhoneClient


def test_history_packet_is_opt_in_and_old_ack_stays_compatible():
    hub = InputHub(arduino="off")
    assert hub.feed_phone(b"v1,0,0,0,0", ("127.0.0.1", 5000)) == b"ack,0"
    hub.race_history = {
        "lap_id": "abc",
        "last_s": 6.8,
        "best_today_s": 6.7,
        "last_valid": True,
    }
    assert hub.feed_phone(b"v1,30,0,0,0", ("127.0.0.1", 5000)) == b"ack,30"
    sent = []

    class Transport:
        def sendto(self, data, addr):
            sent.append(data)

    proto = _PhoneProto(hub)
    proto.connection_made(Transport())
    proto.datagram_received(b"v1,60,0,0,0", ("127.0.0.1", 5000))
    assert sent[0] == b"ack,60"
    assert json.loads(sent[1]) == {"type": "race_history", "history": hub.race_history}


def test_paired_history_packet_is_signed(tmp_path):
    address = ("127.0.0.1", 5000)
    pairing = Pairing(tmp_path / "pairing.json", hosts=[address[0]])
    hub = InputHub(arduino="off", pairing=pairing, pairing_mode="required")
    hub.race_history = {"lap_id": "abc", "last_s": 6.8}
    phone = PhoneClient(pairing.uri())
    transport = Mock()
    proto = _PhoneProto(hub)
    proto.connection_made(transport)

    proto.datagram_received(phone.hello(), address)
    (welcome,) = transport.sendto.call_args_list
    assert phone.accept(welcome.args[0])

    transport.reset_mock()
    proto.datagram_received(phone.send("v1,30,0,0,0"), address)
    ack, history = [call.args[0] for call in transport.sendto.call_args_list]
    assert phone.check(ack) == b"ack,30"
    assert json.loads(phone.check(history)) == {"type": "race_history", "history": hub.race_history}
