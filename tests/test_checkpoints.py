"""CheckpointStore against a fake Lua app speaking the csp/nomadsim_reset protocol over real UDP."""
import asyncio
import socket

import pytest

from coach.checkpoints import CheckpointStore, parse_ck


class FakeLua(asyncio.DatagramProtocol):
    """Mirrors nomadsim_reset.lua: ring of timed saves, anchor saves, holds, restore."""

    def __init__(self, max_holds=8):
        self.cfg = {"period": 0.0, "keep": 20, "anchors": []}
        self.ring, self.anchors, self.holds = [], {}, {}
        self.seq, self.max_holds = 0, max_holds
        self.loaded, self.received = [], []
        self.coach_addr = None
        self.transport = None

    def connection_made(self, transport):
        self.transport = transport

    def save(self, kind="t", spline=0.5, kmh=200.0, lap=1, anchor=None):
        self.seq += 1
        blob = f"state{self.seq}"
        if kind == "a":
            self.anchors[anchor] = (self.seq, blob)
        else:
            self.ring.append((self.seq, blob))
            del self.ring[:-self.cfg["keep"]]
        line = f"CK {self.seq} {kind} {spline:.5f} {kmh:.1f} {lap} {anchor if anchor else '-'} 0.40 3.10 4096"
        self.transport.sendto(line.encode(), self.coach_addr)
        return self.seq

    def find(self, n):
        for s, b in self.ring + list(self.anchors.values()):
            if s == n:
                return b
        return None

    def datagram_received(self, data, addr):
        msg = data.decode().strip()
        self.received.append(msg)
        p = msg.split()
        out = None
        if p[0] == "CFG":
            kv = dict(x.split("=", 1) for x in p[1:])
            self.cfg = {"period": float(kv["period"]), "keep": int(kv["keep"]),
                        "anchors": [float(a) for a in kv["anchors"].split(",") if a]}
            del self.ring[:-self.cfg["keep"]]
            out = f"CFGOK {kv['period']} {kv['keep']} {len(self.cfg['anchors'])}"
        elif p[0] == "HOLD":
            blob = self.find(int(p[2]))
            if blob is None:
                out = "ERR gone"
            elif p[1] not in self.holds and len(self.holds) >= self.max_holds:
                out = "ERR full"
            else:
                self.holds[p[1]] = blob
                out = f"HELD {p[1]} {p[2]}"
        elif p[0] == "RESTORE":
            if p[2] not in self.holds:
                out = "ERR nohold"
            else:
                self.loaded.append(self.holds[p[2]])
                out = f"ACK {p[1]}"
        elif p[0] == "DROP":
            self.holds.pop(p[1], None)
            out = f"DROPPED {p[1]}"
        if out:
            self.transport.sendto(out.encode(), addr)


class Clock:
    def __init__(self):
        self.t = 100.0

    def __call__(self):
        return self.t


@pytest.fixture
async def rig():
    loop = asyncio.get_running_loop()
    _, lua = await loop.create_datagram_endpoint(FakeLua, local_addr=("127.0.0.1", 0))
    clock = Clock()
    events = []
    store = CheckpointStore(events.append, lua_addr=lua.transport.get_extra_info("sockname")[:2],
                            listen=("127.0.0.1", 0), keep=5, anchors=[0.1, 0.6], ack_s=0.5,
                            cfg_every_s=60, clock=clock)
    await store.start()
    lua.coach_addr = store.listen_addr
    await asyncio.sleep(0.05)  # first CFG
    return store, lua, clock, events


async def settle():
    await asyncio.sleep(0.03)


async def test_cfg_reaches_the_app(rig):
    store, lua, _, events = rig
    assert store.lua_ok
    assert lua.cfg == {"period": 1.0, "keep": 5, "anchors": [0.1, 0.6]}
    assert await store.configure(period_s=2, keep=3)
    assert lua.cfg["period"] == 2.0 and lua.cfg["keep"] == 3 and store.ring.maxlen == 3
    await store.stop()


async def test_ring_index_follows_the_app(rig):
    store, lua, clock, _ = rig
    for i in range(8):
        clock.t = 100 + i
        lua.save(spline=0.1 * i)
        await settle()
    assert [c.seq for c in store.ring] == [4, 5, 6, 7, 8]          # same eviction as the app
    assert [s for s, _ in lua.ring] == [4, 5, 6, 7, 8]
    assert store.latest().seq == 8
    assert store.before(105.5).seq == 6
    assert store.before(50) is None
    assert store.latest().call_ms == pytest.approx(0.4) and store.latest().size == 4096
    await store.stop()


async def test_anchor_saves_are_kept_per_anchor(rig):
    store, lua, _, _ = rig
    lua.save("a", spline=0.1, anchor=1)
    lua.save("t")
    n = lua.save("a", spline=0.1, anchor=1)     # next lap replaces it
    await settle()
    assert store.anchor(1).seq == n and store.anchor(2) is None
    assert len(store.ring) == 1
    await store.stop()


async def test_hold_then_restore_round_trip(rig):
    store, lua, _, _ = rig
    lua.save(spline=0.42)
    await settle()
    cp = store.latest()
    assert await store.hold("e1", cp)
    for _ in range(10):          # the ring moves on; the held state survives
        lua.save()
    await settle()
    assert not store.available(cp.seq)
    assert await store.restore("d-7", "e1")
    assert lua.loaded == [f"state{cp.seq}"]
    await store.stop()


async def test_hold_of_an_evicted_state_fails(rig):
    store, lua, _, events = rig
    lua.save()
    await settle()
    old = store.latest()
    for _ in range(6):
        lua.save()
    await settle()
    assert not await store.hold("e1", old)
    assert "e1" not in store.holds
    assert any("hold e1 failed: ERR gone" in e.get("message", "") for e in events)
    assert not await store.restore("d", "e1")
    await store.stop()


async def test_hold_limit_drops_the_oldest(rig):
    store, lua, clock, _ = rig
    lua.save()
    await settle()
    cp = store.latest()
    for i in range(6):
        clock.t = 100 + i
        assert await store.hold(f"e{i}", cp)
    assert sorted(store.holds) == ["e1", "e2", "e3", "e4", "e5"]
    assert "DROP e0" in lua.received and "e0" not in lua.holds
    await store.stop()


async def test_holds_expire_unless_extended(rig):
    store, lua, clock, _ = rig
    lua.save()
    await settle()
    cp = store.latest()
    await store.hold("old", cp)
    clock.t += 30
    await store.hold("kept", cp)
    clock.t += 31
    store.extend("kept")
    assert await store.sweep() == ["old"]
    assert set(lua.holds) == {"kept"}
    await store.stop()
    assert lua.holds == {}                       # stop releases everything


async def test_lua_reload_clears_the_index(rig):
    store, lua, _, events = rig
    for _ in range(3):
        lua.save()
    await settle()
    await store.hold("e1", store.latest())
    lua.seq = 0                                  # script reloaded: seq starts over
    lua.save()
    await settle()
    assert [c.seq for c in store.ring] == [1] and store.holds == {}
    assert any("restarted" in e.get("message", "") for e in events)
    await store.stop()


async def test_no_lua_app():
    port = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    port.bind(("127.0.0.1", 0))                  # nobody answers here
    store = CheckpointStore(lua_addr=port.getsockname(), listen=("127.0.0.1", 0), ack_s=0.05,
                            cfg_every_s=60)
    await store.start()
    await asyncio.sleep(0.15)
    assert store.lua_ok is False and store.status()["ring"] == 0
    await store.stop()
    port.close()


def test_parse_ck():
    cp = parse_ck("CK 12 a 0.10230 182.4 3 2 0.41 3.20 5120", 9.0)
    assert (cp.seq, cp.kind, cp.anchor, cp.lap, cp.size, cp.t) == (12, "a", 2, 3, 5120, 9.0)
    assert parse_ck("CK 12 t 0.5 100 1 - 0.4 3 10", 0).anchor is None
    for bad in ("CK 1 x 0.5 100 1 - 0 0 1", "CK 1 t", "SAVED 1 2 3 4", "CK one t 0.5 1 1 - 0 0 1"):
        assert parse_ck(bad, 0) is None
