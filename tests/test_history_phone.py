import json

from coach.inputs import InputHub, _PhoneProto


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
