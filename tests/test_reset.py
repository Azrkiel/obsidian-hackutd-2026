import asyncio

import pytest

from coach.reset import ResetManager, udp_roundtrip
from coach.scorer import CornerScorer
from coach.telemetry import Sample, SimSource


def sample(pos, speed=300.0, t=0.0):
    return Sample(t, 1, "live", 0.0, pos, speed, 0, 0, 0, 0, 0, 0)


def make(mode="manual", **kw):
    events, confirmed = [], []
    kw.setdefault("countdown", 0)
    rm = ResetManager(mode, events.append, lambda: confirmed.append(1), **kw)
    return rm, events, confirmed


def types(events):
    return [e["type"] for e in events]


async def test_sim_end_to_end_confirm(corner):
    sim = SimSource(corner, realtime=False)
    rm, events, confirmed = make("sim", sim=sim)
    rm.set_checkpoint(sim.start_pos_m, sim.v0_kmh)
    task = asyncio.create_task(rm.reset("d-1"))
    async for s in sim.samples():
        rm.on_sample(s)
        if task.done():
            sim.stop()
    assert task.result() is True and confirmed == [1]
    assert types(events)[-2:] == ["reset_request", "reset_confirmed"] or "reset_confirmed" in types(events)
    assert not rm.busy and rm.status == "idle"


async def test_countdown_events():
    rm, events, _ = make("manual", countdown=3, tick_s=0.0, confirm_timeout_s=0.05)
    rm.set_checkpoint(100, 200)
    await rm.reset("d")
    assert [e["n"] for e in events if e["type"] == "countdown"] == [3, 2, 1, 0]


async def test_timeout_emits_reset_failed():
    rm, events, confirmed = make("manual", confirm_timeout_s=0.05)
    rm.set_checkpoint(100, 200)
    task = asyncio.create_task(rm.reset("d"))
    await asyncio.sleep(0.01)
    rm.on_sample(sample(400, 200))  # nowhere near the checkpoint
    assert await task is False
    assert confirmed == [] and rm.status == "failed"
    assert [e for e in events if e["type"] == "reset_failed"][0]["reason"].startswith("timeout")
    assert not rm.busy
    # retry works after a failure
    task = asyncio.create_task(rm.retry())
    await asyncio.sleep(0.01)
    rm.on_sample(sample(105, 205))
    assert await task is True and confirmed == [1]


async def test_confirmation_needs_position_and_speed():
    rm, events, confirmed = make("manual", confirm_timeout_s=0.2)
    rm.set_checkpoint(100, 200)
    task = asyncio.create_task(rm.reset("d"))
    await asyncio.sleep(0.01)
    rm.on_sample(sample(100, 250))   # right place, wrong speed
    rm.on_sample(sample(150, 200))   # right speed, wrong place
    await asyncio.sleep(0.02)
    assert not task.done()
    rm.on_sample(sample(110, 195))
    assert await task is True


async def test_no_checkpoint_fails():
    rm, events, _ = make("manual")
    assert await rm.reset("d") is False
    assert events[-1]["reason"] == "no checkpoint saved"


async def test_refuses_during_run(corner):
    sc = CornerScorer(corner, lambda a, t: None)
    for p in (230, 245, 260):
        sc.add(sample(p, t=p / 100))
    assert sc.in_run
    rm, events, _ = make("manual", scorer=sc, run_wait_s=0.05, confirm_timeout_s=0.05)
    rm.set_checkpoint(100, 200)
    assert await rm.reset("d") is False
    assert events[-1]["reason"] == "run in progress"


async def test_never_two_resets_at_once():
    rm, events, _ = make("manual", confirm_timeout_s=0.1)
    rm.set_checkpoint(100, 200)
    first = asyncio.create_task(rm.reset("a"))
    await asyncio.sleep(0.01)
    assert await rm.reset("b") is False
    assert any("already in progress" in e.get("message", "") for e in events)
    await first


async def test_checkpoint_persisted(tmp_path):
    rm, _, _ = make("manual", checkpoint_path=tmp_path / "cp.json")
    rm.on_sample(sample(321, 150))
    assert await rm.save_checkpoint()
    rm2, _, _ = make("manual", checkpoint_path=tmp_path / "cp.json")
    assert rm2.checkpoint == {"pos_m": 321.0, "speed_kmh": 150.0}


class FakeLua(asyncio.DatagramProtocol):
    def __init__(self, ack=True):
        self.ack, self.got = ack, []

    def connection_made(self, transport):
        self.t = transport

    def datagram_received(self, data, addr):
        msg = data.decode()
        self.got.append(msg)
        if not self.ack:
            return
        if msg == "SAVE":
            self.t.sendto(b"SAVED 1.0 2.0 3.0 150.0", addr)
        elif msg.startswith("RESET "):
            self.t.sendto(("ACK " + msg[6:]).encode(), addr)


async def fake_lua(ack=True):
    loop = asyncio.get_running_loop()
    tr, proto = await loop.create_datagram_endpoint(lambda: FakeLua(ack), local_addr=("127.0.0.1", 0))
    return tr, proto, tr.get_extra_info("sockname")


async def test_udp_save_and_reset():
    tr, lua, addr = await fake_lua()
    try:
        rm, events, confirmed = make("udp", udp_addr=addr, confirm_timeout_s=1.0)
        rm.on_sample(sample(150, 300))
        assert await rm.save_checkpoint()
        assert lua.got == ["SAVE"]
        task = asyncio.create_task(rm.reset("d-9"))
        await asyncio.sleep(0.1)
        rm.on_sample(sample(152, 298))
        assert await task is True
        assert lua.got == ["SAVE", "RESET d-9"] and confirmed == [1]
    finally:
        tr.close()


async def test_udp_no_ack_still_confirms_from_telemetry():
    tr, lua, addr = await fake_lua(ack=False)
    try:
        rm, events, _ = make("udp", udp_addr=addr, udp_ack_s=0.05, confirm_timeout_s=1.0)
        rm.set_checkpoint(150, 300)
        task = asyncio.create_task(rm.reset("d"))
        await asyncio.sleep(0.2)
        rm.on_sample(sample(150, 300))
        assert await task is True
        assert any("no ACK" in e.get("message", "") for e in events)
    finally:
        tr.close()


async def test_udp_roundtrip_timeout():
    tr, lua, addr = await fake_lua(ack=False)
    try:
        assert await udp_roundtrip(addr, "SAVE", "SAVED", 0.05) is None
    finally:
        tr.close()
