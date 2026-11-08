"""CheckpointStore: the coach's view of the Lua app's rolling saves (docs/ROLLING_CHECKPOINTS.md, C).

The Lua app (csp/nomadsim_reset) keeps the car states; the coach keeps only an index of them:
  - a ring of timed saves (every `period_s`, the last `keep`), reported as "CK ... t ..." lines
  - one save per anchor (a track position before a corner's braking zone), "CK ... a <idx> ..."
To retry an error the coach HOLDs one of those states (it then survives the ring moving on),
later RESTOREs it, and DROPs it when the event is closed or expires.

Messages to the app go to 127.0.0.1:9101 (each in its own socket, so replies can't cross);
CK lines arrive on 127.0.0.1:9102. CFG is resent every few seconds: it is how the Lua app knows
the coach is alive (it stops timed saves after 15 s without one) and survives a script reload.
"""
from __future__ import annotations

import asyncio
import time
from collections import deque
from dataclasses import dataclass
from typing import Any, Callable, Iterable

from .reset import udp_roundtrip


@dataclass(frozen=True)
class Checkpoint:
    seq: int
    kind: str              # "t" timed | "a" anchor
    spline: float          # track position 0..1
    speed_kmh: float
    lap: int
    anchor: int | None     # 1-based anchor index for kind "a"
    call_ms: float         # time spent inside saveCarStateAsync (frame cost)
    done_ms: float         # until the state arrived
    size: int              # bytes
    t: float               # coach clock when the CK line arrived


def parse_ck(line: str, t: float) -> Checkpoint | None:
    p = line.split()
    if len(p) != 10 or p[0] != "CK" or p[2] not in ("a", "t"):
        return None
    try:
        return Checkpoint(int(p[1]), p[2], float(p[3]), float(p[4]), int(p[5]),
                          None if p[6] == "-" else int(p[6]), float(p[7]), float(p[8]), int(p[9]), t)
    except ValueError:
        return None


@dataclass
class Hold:
    event: str
    cp: Checkpoint
    expires: float


class _Listen(asyncio.DatagramProtocol):
    def __init__(self, store: "CheckpointStore") -> None:
        self.store = store

    def datagram_received(self, data: bytes, addr: Any) -> None:
        self.store.feed(data.decode("utf-8", "replace").strip())


class CheckpointStore:
    def __init__(self, emit: Callable[[dict], None] | None = None,
                 lua_addr: tuple[str, int] = ("127.0.0.1", 9101),
                 listen: tuple[str, int] = ("127.0.0.1", 9102),
                 period_s: float = 1.0, keep: int = 20, anchors: Iterable[float] = (),
                 max_holds: int = 5, hold_s: float = 60.0, ack_s: float = 1.0,
                 cfg_every_s: float = 5.0, clock: Callable[[], float] = time.monotonic):
        self.emit = emit or (lambda e: None)
        self.lua_addr, self.listen_addr = lua_addr, listen
        self.period_s, self.keep, self.anchors = float(period_s), int(keep), [float(a) for a in anchors]
        self.max_holds, self.hold_s, self.ack_s, self.cfg_every_s = max_holds, hold_s, ack_s, cfg_every_s
        self.clock = clock
        self.ring: deque[Checkpoint] = deque(maxlen=self.keep)
        self.anchor_cps: dict[int, Checkpoint] = {}
        self.holds: dict[str, Hold] = {}
        self.last_seq = 0
        self.lua_ok = False        # the last CFG got a CFGOK
        self._transport: asyncio.DatagramTransport | None = None
        self._task: asyncio.Task | None = None

    # -- lifecycle --
    async def start(self) -> None:
        loop = asyncio.get_running_loop()
        self._transport, _ = await loop.create_datagram_endpoint(
            lambda: _Listen(self), local_addr=self.listen_addr)
        self.listen_addr = self._transport.get_extra_info("sockname")[:2]
        self._task = asyncio.create_task(self._keepalive())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        for event in list(self.holds):
            await self.drop(event)
        if self._transport:
            self._transport.close()
            self._transport = None

    async def _keepalive(self) -> None:
        while True:
            await self.send_cfg()
            await self.sweep()
            await asyncio.sleep(self.cfg_every_s)

    # -- configuration --
    def cfg_line(self) -> str:
        return (f"CFG period={self.period_s:g} keep={self.keep} "
                f"anchors={','.join(f'{a:.5f}' for a in self.anchors)}")

    async def send_cfg(self) -> bool:
        reply = await udp_roundtrip(self.lua_addr, self.cfg_line(), "CFGOK", self.ack_s)
        was, self.lua_ok = self.lua_ok, reply is not None
        self._cfg_seen = getattr(self, "_cfg_seen", False)
        if was != self.lua_ok or not self._cfg_seen:      # also the first answer (or silence) at start
            self._cfg_seen = True
            self.emit({"type": "status", "message": "rolling checkpoints: Lua app " +
                       ("connected" if self.lua_ok else "not answering")})
        return self.lua_ok

    async def configure(self, period_s: float | None = None, keep: int | None = None,
                        anchors: Iterable[float] | None = None) -> bool:
        if period_s is not None:
            self.period_s = float(period_s)
        if keep is not None and int(keep) != self.keep:
            self.keep = int(keep)
            self.ring = deque(self.ring, maxlen=self.keep)
        if anchors is not None:
            new = [float(a) for a in anchors]
            if new != self.anchors:
                self.anchors, self.anchor_cps = new, {}
        return await self.send_cfg()

    # -- index (CK lines) --
    def feed(self, line: str) -> Checkpoint | None:
        cp = parse_ck(line, self.clock())
        if cp is None:
            return None
        if cp.seq <= self.last_seq:  # the Lua script reloaded: its states (and holds) are gone
            self.ring.clear()
            self.anchor_cps.clear()
            self.holds.clear()
            self.emit({"type": "status", "message": "rolling checkpoints: Lua app restarted"})
        self.last_seq = cp.seq
        if cp.kind == "a" and cp.anchor is not None:
            self.anchor_cps[cp.anchor] = cp
        else:
            self.ring.append(cp)
        return cp

    def latest(self) -> Checkpoint | None:
        return self.ring[-1] if self.ring else None

    def before(self, t: float) -> Checkpoint | None:
        """The newest timed save taken at or before coach time t."""
        best = None
        for cp in self.ring:
            if cp.t <= t:
                best = cp
        return best

    def anchor(self, idx: int) -> Checkpoint | None:
        return self.anchor_cps.get(idx)

    def available(self, seq: int) -> bool:
        return any(c.seq == seq for c in self.ring) or any(c.seq == seq for c in self.anchor_cps.values())

    # -- holds --
    async def hold(self, event: str, cp: Checkpoint) -> bool:
        """Keep cp for this event. At the limit the oldest hold is dropped first."""
        if event not in self.holds and len(self.holds) >= self.max_holds:
            oldest = min(self.holds.values(), key=lambda h: h.expires)
            await self.drop(oldest.event)
        reply = await udp_roundtrip(self.lua_addr, f"HOLD {event} {cp.seq}", ("HELD", "ERR"), self.ack_s)
        if reply is None or not reply.startswith(f"HELD {event} "):
            self.emit({"type": "status", "message": f"hold {event} failed: {reply or 'no reply'}"})
            return False
        self.holds[event] = Hold(event, cp, self.clock() + self.hold_s)
        return True

    async def restore(self, decision_id: str, event: str) -> bool:
        """Load the state held for event. Telemetry still has the final say (ResetManager)."""
        if event not in self.holds:
            return False
        reply = await udp_roundtrip(self.lua_addr, f"RESTORE {decision_id} {event}",
                                    (f"ACK {decision_id}", "ERR"), self.ack_s)
        if reply != f"ACK {decision_id}":
            self.emit({"type": "status", "message": f"restore {event} failed: {reply or 'no reply'}"})
            return False
        return True

    def extend(self, event: str, seconds: float | None = None) -> None:
        """Keep a hold alive while it's being retried."""
        if event in self.holds:
            self.holds[event].expires = self.clock() + (seconds or self.hold_s)

    async def drop(self, event: str) -> None:
        if self.holds.pop(event, None) is not None:
            await udp_roundtrip(self.lua_addr, f"DROP {event}", f"DROPPED {event}", self.ack_s)

    async def sweep(self) -> list[str]:
        now = self.clock()
        gone = [e for e, h in self.holds.items() if h.expires <= now]
        for e in gone:
            await self.drop(e)
        return gone

    def status(self) -> dict:
        costs = [c.call_ms for c in self.ring if c.call_ms >= 0]
        return {"lua_ok": self.lua_ok, "ring": len(self.ring), "keep": self.keep,
                "anchors": len(self.anchors), "anchor_saves": len(self.anchor_cps),
                "holds": sorted(self.holds), "last_seq": self.last_seq,
                "save_call_ms_max": max(costs, default=None)}
