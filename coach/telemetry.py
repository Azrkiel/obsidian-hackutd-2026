"""Telemetry samples and sources: Assetto Corsa shared memory, a deterministic simulator, JSONL replay."""
from __future__ import annotations

import asyncio
import ctypes
import json
import math
import random
import sys
import time
from ctypes import c_float, c_int32, c_wchar
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import AsyncIterator

from engine.models import CornerConfig


@dataclass
class Sample:
    t: float            # seconds, monotonic-ish
    packet_id: int
    status: str         # "live" | "pause" | "replay" | "off"
    pos_norm: float
    pos_m: float
    speed_kmh: float
    gas: float
    brake: float
    steer: float
    x: float
    y: float
    z: float
    # step 1 extras (defaults keep old recordings and constructors working)
    g_lat: float = 0.0      # accG[0], lateral g
    g_lon: float = 0.0      # accG[2], longitudinal g (sign: verify in game, step 8)
    yaw_rate: float = 0.0   # localAngularVel[1], rad/s (sign: verify in game)
    slip_f: float = 0.0     # max wheelSlip of the two fronts
    slip_r: float = 0.0     # max wheelSlip of the two rears
    load_f: float = 0.0     # wheelLoad fronts, N
    load_r: float = 0.0     # wheelLoad rears, N


# --- Assetto Corsa (original, NOT ACC) shared memory --------------------------------------------
# Layouts copied (truncated after the last field we need; a smaller map view than the real page is
# fine) from the CSP team's sim_info.py for original AC:
# https://github.com/ac-custom-shaders-patch/acc-extension-apps/blob/master/apps/python/AccExtHelper/sim_info.py
# Memory names: Local\acpmf_physics, Local\acpmf_graphics, Local\acpmf_static.

AC_OFF, AC_REPLAY, AC_LIVE, AC_PAUSE = 0, 1, 2, 3
_STATUS = {AC_OFF: "off", AC_REPLAY: "replay", AC_LIVE: "live", AC_PAUSE: "pause"}


class SPageFilePhysics(ctypes.Structure):
    _pack_ = 4
    # Field order from the same sim_info.py, through localAngularVel (truncated after it).
    # Untested against the live game: check yaw-rate sign and g-forces in step 8.
    _fields_ = [("packetId", c_int32), ("gas", c_float), ("brake", c_float), ("fuel", c_float),
                ("gear", c_int32), ("rpms", c_int32), ("steerAngle", c_float), ("speedKmh", c_float),
                ("velocity", c_float * 3), ("accG", c_float * 3), ("wheelSlip", c_float * 4),
                ("wheelLoad", c_float * 4), ("wheelsPressure", c_float * 4),
                ("wheelAngularSpeed", c_float * 4), ("tyreWear", c_float * 4),
                ("tyreDirtyLevel", c_float * 4), ("tyreCoreTemperature", c_float * 4),
                ("camberRAD", c_float * 4), ("suspensionTravel", c_float * 4),
                ("drs", c_float), ("tc", c_float), ("heading", c_float), ("pitch", c_float),
                ("roll", c_float), ("cgHeight", c_float), ("carDamage", c_float * 5),
                ("numberOfTyresOut", c_int32), ("pitLimiterOn", c_int32), ("abs", c_float),
                ("kersCharge", c_float), ("kersInput", c_float), ("autoShifterOn", c_int32),
                ("rideHeight", c_float * 2), ("turboBoost", c_float), ("ballast", c_float),
                ("airDensity", c_float), ("airTemp", c_float), ("roadTemp", c_float),
                ("localAngularVel", c_float * 3)]


class SPageFileGraphic(ctypes.Structure):
    _pack_ = 4
    _fields_ = [("packetId", c_int32), ("status", c_int32), ("session", c_int32),
                ("currentTime", c_wchar * 15), ("lastTime", c_wchar * 15),
                ("bestTime", c_wchar * 15), ("split", c_wchar * 15),
                ("completedLaps", c_int32), ("position", c_int32), ("iCurrentTime", c_int32),
                ("iLastTime", c_int32), ("iBestTime", c_int32), ("sessionTimeLeft", c_float),
                ("distanceTraveled", c_float), ("isInPit", c_int32), ("currentSectorIndex", c_int32),
                ("lastSectorTime", c_int32), ("numberOfLaps", c_int32),
                ("tyreCompound", c_wchar * 33), ("replayTimeMultiplier", c_float),
                ("normalizedCarPosition", c_float), ("carCoordinates", c_float * 3)]


class SPageFileStatic(ctypes.Structure):
    _pack_ = 4
    _fields_ = [("_smVersion", c_wchar * 15), ("_acVersion", c_wchar * 15),
                ("numberOfSessions", c_int32), ("numCars", c_int32),
                ("carModel", c_wchar * 33), ("track", c_wchar * 33),
                ("playerName", c_wchar * 33), ("playerSurname", c_wchar * 33),
                ("playerNick", c_wchar * 33), ("sectorCount", c_int32),
                ("maxTorque", c_float), ("maxPower", c_float), ("maxRpm", c_int32),
                ("maxFuel", c_float), ("suspensionMaxTravel", c_float * 4),
                ("tyreRadius", c_float * 4), ("maxTurboBoost", c_float), ("airTemp", c_float),
                ("roadTemp", c_float), ("penaltiesEnabled", c_int32), ("aidFuelRate", c_float),
                ("aidTireRate", c_float), ("aidMechanicalDamage", c_float),
                ("aidAllowTyreBlankets", c_int32), ("aidStability", c_float),
                ("aidAutoClutch", c_int32), ("aidAutoBlip", c_int32), ("hasDRS", c_int32),
                ("hasERS", c_int32), ("hasKERS", c_int32), ("kersMaxJ", c_float),
                ("engineBrakeSettingsCount", c_int32), ("ersPowerControllerCount", c_int32),
                ("trackSPlineLength", c_float), ("trackConfiguration", c_wchar * 33)]


class ACNotRunning(RuntimeError):
    pass


def parse_sample(phys: SPageFilePhysics, gfx: SPageFileGraphic, track_len_m: float,
                 t: float | None = None) -> Sample:
    """Pure conversion of the two live pages into a Sample (unit-tested with fake buffers)."""
    pn = float(gfx.normalizedCarPosition)
    c = gfx.carCoordinates
    ws, wl = phys.wheelSlip, phys.wheelLoad  # FL, FR, RL, RR
    return Sample(t=time.monotonic() if t is None else t, packet_id=int(phys.packetId),
                  status=_STATUS.get(int(gfx.status), "off"), pos_norm=pn, pos_m=pn * track_len_m,
                  speed_kmh=float(phys.speedKmh), gas=float(phys.gas), brake=float(phys.brake),
                  steer=float(phys.steerAngle), x=float(c[0]), y=float(c[1]), z=float(c[2]),
                  g_lat=float(phys.accG[0]), g_lon=float(phys.accG[2]),
                  yaw_rate=float(phys.localAngularVel[1]),
                  slip_f=max(float(ws[0]), float(ws[1])), slip_r=max(float(ws[2]), float(ws[3])),
                  load_f=float(wl[0]) + float(wl[1]), load_r=float(wl[2]) + float(wl[3]))


class ACSharedMemory:
    """Reads the three AC shared-memory pages (Windows only). samples() yields on new physics packets."""
    finite = False

    def __init__(self, track_length_m: float | None = None, poll_hz: float = 200.0,
                 fixed_length: bool = False):
        # fixed_length (whole-lap mode): position = normalized position x track_length_m, so corner
        # positions are fractions of the lap even if AC's spline length differs from the config's
        self.fallback_len, self.fixed_length = track_length_m, fixed_length
        self.poll_s = 1.0 / poll_hz
        self.car = self.track = ""

    @staticmethod
    def _open():
        if sys.platform != "win32":
            raise ACNotRunning("AC shared memory is Windows-only")
        import mmap
        return [mmap.mmap(-1, ctypes.sizeof(s), name) for s, name in (
            (SPageFilePhysics, "Local\\acpmf_physics"), (SPageFileGraphic, "Local\\acpmf_graphics"),
            (SPageFileStatic, "Local\\acpmf_static"))]

    @staticmethod
    def _read(mm, cls):
        mm.seek(0)
        return cls.from_buffer_copy(mm.read(ctypes.sizeof(cls)))

    async def samples(self) -> AsyncIterator[Sample]:
        maps = self._open()
        try:
            st = self._read(maps[2], SPageFileStatic)
            if not st.track:
                raise ACNotRunning("Assetto Corsa is not running (shared memory is empty)")
            self.car, self.track = st.carModel, st.track
            length = (self.fallback_len if self.fixed_length and self.fallback_len
                      else float(st.trackSPlineLength) or self.fallback_len)
            if not length:
                raise ACNotRunning("track length unknown: corner config needs track_length_m")
            last = 0
            while True:
                phys = self._read(maps[0], SPageFilePhysics)
                if phys.packetId != last and phys.packetId != 0:
                    last = phys.packetId
                    gfx = self._read(maps[1], SPageFileGraphic)
                    if gfx.status == AC_LIVE:
                        yield parse_sample(phys, gfx, length)
                await asyncio.sleep(self.poll_s)
        finally:
            for m in maps:
                m.close()


# --- recording / replay -------------------------------------------------------------------------
class Recorder:
    def __init__(self, directory: str | Path = "data/recordings"):
        d = Path(directory)
        d.mkdir(parents=True, exist_ok=True)
        self.path = d / (time.strftime("%Y%m%d-%H%M%S") + ".jsonl")
        self._f = self.path.open("a", encoding="utf-8")

    def write(self, s: Sample) -> None:
        self._f.write(json.dumps(asdict(s), separators=(",", ":")) + "\n")

    def close(self) -> None:
        self._f.close()


class ReplaySource:
    finite = True

    def __init__(self, path: str | Path, realtime: bool = False):
        self.path, self.realtime = Path(path), realtime

    async def samples(self) -> AsyncIterator[Sample]:
        prev = None
        for line in self.path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            s = Sample(**json.loads(line))
            if self.realtime and prev is not None:
                await asyncio.sleep(max(0.0, s.t - prev))
            else:
                await asyncio.sleep(0)
            prev = s.t
            yield s


# --- simulator ----------------------------------------------------------------------------------
class SimSource:
    """Deterministic synthetic driver for the corner.

    Drives approach -> start gate -> brake -> apex -> throttle -> exit gate, then parks until
    teleport_to() (the sim reset). After each teleport the brake point moves `skill` of the way
    toward the active drill target (set_target_board), so the coaching loop converges.
    """
    finite = False

    def __init__(self, corner: CornerConfig, seed: int = 1, realtime: bool = True,
                 brake_board_m: float = 86.0, hz: float = 100.0, skill: float = 0.6,
                 apex_kmh: float = 74.0, pickup_after_apex_m: float = 22.0,
                 start_pos_m: float | None = None, with_pause: bool = False,
                 laps: bool = False, lap_gap_s: float = 12.0, lap_start_m: float = 0.0,
                 release_s: float = 0.55):
        self.corner, self.realtime, self.dt, self.skill = corner, realtime, 1.0 / hz, skill
        rng = random.Random(seed)
        self.v0_kmh = 318.0 + rng.uniform(-0.5, 0.5)
        self.start_pos_m = corner.start_gate_m - 90 if start_pos_m is None else start_pos_m
        self.onset_m = corner.board_zero_m - brake_board_m
        self.target_onset_m: float | None = None
        self.apex_kmh = apex_kmh
        self.apex_start = corner.apex_window_m[0]
        self.pickup_m = corner.apex_window_m[1] + pickup_after_apex_m
        self.end_m = corner.exit_gate_m + 100
        self.accel = 8.1
        self.with_pause = with_pause
        # lap mode: after the corner the car "drives the rest of the lap" (parked for lap_gap_s),
        # then reappears at lap_start_m: a lap wrap, like AC's position going 5793 -> 0
        self.laps, self.lap_gap_s, self.lap_start_m = laps, lap_gap_s, lap_start_m
        self.release_s = release_s  # seconds from peak brake to off (ramp before the apex)
        self.target_release_s: float | None = None
        self._parked_at: float | None = None
        self.pos, self.t, self.packet, self.parked = self.start_pos_m, 0.0, 0, False
        self._stop = False
        self._tele = False

    # -- control --
    def set_target_board(self, board_m: float) -> None:
        self.target_onset_m = self.corner.board_zero_m - board_m

    def set_target_release(self, release_s: float) -> None:
        self.target_release_s = float(release_s)

    def teleport_to(self, pos_m: float, speed_kmh: float) -> None:
        if self.target_onset_m is not None:
            self.onset_m += self.skill * (self.target_onset_m - self.onset_m)
        if self.target_release_s is not None:
            self.release_s += self.skill * (self.target_release_s - self.release_s)
        self.pos, self.v0_kmh, self.parked, self._tele = pos_m, speed_kmh, False, True

    def stop(self) -> None:
        self._stop = True

    # -- model --
    def _profile(self, pos: float) -> tuple[float, float, float]:
        """(speed km/h, gas, brake) at a track position."""
        v0 = self.v0_kmh / 3.6
        va = self.apex_kmh / 3.6
        if pos < self.onset_m:
            return self.v0_kmh, 1.0, 0.0
        if pos < self.apex_start:
            span = max(self.apex_start - self.onset_m, 1.0)
            a = (v0 * v0 - va * va) / (2 * span)
            v = math.sqrt(max(v0 * v0 - 2 * a * (pos - self.onset_m), va * va))
            peak = min(1.0, max(0.3, a / 42.0))
            # progressive release: brake ramps from peak to 0 over the last release_s before the apex
            rel_m = max(self.release_s, 0.0) * (va + 0.25 * (v0 - va))
            left = self.apex_start - pos
            if rel_m > 0 and left < rel_m:
                peak *= max(left / rel_m, 0.0)
            return v * 3.6, 0.0, peak
        if pos < self.pickup_m:
            return self.apex_kmh + 0.02 * (pos - self.apex_start), 0.0, 0.0
        vp = (self.apex_kmh + 0.02 * (self.pickup_m - self.apex_start)) / 3.6
        d = pos - self.pickup_m
        v = math.sqrt(vp * vp + 2 * self.accel * d)
        return v * 3.6, min(1.0, 0.4 + d / 20.0), 0.0

    def _steer(self, pos: float) -> float:
        """Right then left through the chicane (normalised steering input)."""
        c = self.corner
        ti, a1, a2, ex = c.gate("turn_in_m"), c.gate("apex1_m"), c.gate("apex2_m"), c.exit_gate_m
        if ti <= pos < a1:
            return 0.30 * math.sin(math.pi / 2 * (pos - ti) / max(a1 - ti, 1.0))
        if a1 <= pos < a2:
            return 0.30 - 0.55 * (pos - a1) / max(a2 - a1, 1.0)
        if a2 <= pos < ex:
            return -0.25 * (1 - (pos - a2) / max(ex - a2, 1.0))
        return 0.0

    def _sample(self, status: str = "live") -> Sample:
        if self.parked:
            speed, gas, brake = 0.0, 0.0, 0.3
        else:
            speed, gas, brake = self._profile(self.pos)
        self.packet += 1
        n = self.corner.track_length_m
        steer = 0.0 if self.parked else self._steer(self.pos)
        v = speed / 3.6
        yaw = v * math.tan(steer * 0.25) / self.corner.wheelbase_m  # kinematic, neutral car
        g_lon = -brake * 2.4 + gas * 0.6 if not self.parked else 0.0
        slip_f = 0.03 + (0.25 if brake > 0.97 and v < 40 else 0.0)  # front lock at low speed
        slip_r = 0.03 + (0.2 if gas > 0.9 and v < 35 else 0.0)
        return Sample(self.t, self.packet, status, self.pos / n, self.pos, speed, gas, brake,
                      steer, self.pos, 0.0, 0.0, g_lat=v * yaw / 9.81, g_lon=g_lon, yaw_rate=yaw,
                      slip_f=slip_f, slip_r=slip_r)

    async def samples(self) -> AsyncIterator[Sample]:
        loop = asyncio.get_running_loop()
        wall0 = loop.time() - self.t
        if self.with_pause:
            for _ in range(3):
                yield self._sample("pause")
                self.t += self.dt
        while not self._stop:
            s = self._sample()
            yield s
            if self._tele:
                self._tele = False
            elif not self.parked:
                self.pos += (s.speed_kmh / 3.6) * self.dt
                if self.pos >= self.end_m:
                    self.pos, self.parked, self._parked_at = self.end_m, True, self.t
            elif self.laps and self.t - (self._parked_at or self.t) >= self.lap_gap_s:
                self.teleport_to(self.lap_start_m, self.v0_kmh)
            self.t += self.dt
            if self.realtime:
                await asyncio.sleep(max(0.0, wall0 + self.t - loop.time()))
            else:
                await asyncio.sleep(0.002 if self.parked else 0)


# --- whole-lap simulator --------------------------------------------------------------------------
_DEFAULT_APEX_KMH = {"t1": 74.0, "roggia": 110.0, "lesmo1": 170.0, "lesmo2": 160.0,
                     "ascari": 190.0, "parabolica": 160.0}


class TrackSimSource:
    """Deterministic synthetic driver for a whole lap with per-corner board/release knobs.

    A 1 m table of (speed, gas, brake) is built from a forward pass over the lap (accelerate, brake
    to each apex, coast to pickup, accelerate). On every lap wrap (pos 5793 -> 0, like AC) each corner
    with a target moves `skill` of the way toward it, then the table is rebuilt.
    """
    finite = False

    def __init__(self, track, seed: int = 1, realtime: bool = True, hz: float = 100.0,
                 skill: float = 0.6, corners: dict[str, dict] | None = None,
                 vmax_kmh: float = 318.0, accel: float = 8.1, start_pos_m: float = 0.0):
        self.track, self.realtime, self.dt, self.skill = track, realtime, 1.0 / hz, skill
        self.length = float(track.length_m)
        self.vmax_kmh, self.accel = vmax_kmh, accel
        self.knobs: dict[str, dict[str, float]] = {}
        for c in track.corners:
            k = {"board_m": 100.0, "apex_kmh": _DEFAULT_APEX_KMH.get(c.id, 120.0),
                 "pickup_after_apex_m": 20.0, "release_s": 0.55}
            k.update({a: float(b) for a, b in (dict(corners or {}).get(c.id) or {}).items()})
            self.knobs[c.id] = k
        self.target_board: dict[str, float] = {}
        self.target_release: dict[str, float] = {}
        self.start_pos_m = float(start_pos_m)
        self.lap_count = 0
        self.pos, self.t, self.packet = self.start_pos_m, 0.0, 0
        self._stop = False
        self._build()
        self.v0_kmh = self._lookup(self.start_pos_m)[0]

    # -- control --
    def set_target_board(self, board_m: float, corner_id: str) -> None:
        self.track.corner(corner_id)
        self.target_board[corner_id] = float(board_m)

    def set_target_release(self, release_s: float, corner_id: str) -> None:
        self.track.corner(corner_id)
        self.target_release[corner_id] = float(release_s)

    def stop(self) -> None:
        self._stop = True

    def onset_m(self, corner_id: str) -> float:
        return self.track.corner(corner_id).board_zero_m - self.knobs[corner_id]["board_m"]

    # -- model --
    def _build(self) -> None:
        L = self.length
        n = int(math.ceil(L)) + 2
        cs = []
        for c in self.track.corners:
            k = self.knobs[c.id]
            cs.append({"c": c, "onset": c.board_zero_m - k["board_m"], "a0": c.apex_window_m[0],
                       "pickup": c.apex_window_m[1] + k["pickup_after_apex_m"],
                       "va": k["apex_kmh"] / 3.6, "rel": k["release_s"]})
        vmax = self.vmax_kmh / 3.6
        v_start = vmax
        for _ in range(3):  # lap start speed must equal lap end speed
            spd, gas, brk = [0.0] * n, [0.0] * n, [0.0] * n
            v = v_start
            for ph in cs:
                ph.pop("v0", None), ph.pop("braking", None)
            for i in range(n):
                p = float(i)
                if i > 0:
                    v = min(math.sqrt(v * v + 2 * self.accel * 1.0), vmax)
                g, b = 1.0, 0.0
                done = False
                for ph in cs:
                    if "braking" not in ph and p >= ph["onset"]:
                        ph["v0"] = v
                        ph["braking"] = v > ph["va"] + 5 / 3.6
                    if not ph.get("braking") or p < ph["onset"]:
                        continue
                    va, v0 = ph["va"], ph["v0"]
                    if p < ph["a0"]:
                        span = max(ph["a0"] - ph["onset"], 1.0)
                        a = (v0 * v0 - va * va) / (2 * span)
                        v = math.sqrt(max(v0 * v0 - 2 * a * (p - ph["onset"]), va * va))
                        b = min(1.0, max(0.3, a / 42.0))
                        rel_m = max(ph["rel"], 0.0) * (va + 0.25 * (v0 - va))
                        left = ph["a0"] - p
                        if rel_m > 0 and left < rel_m:
                            b *= max(left / rel_m, 0.0)
                        g, done = 0.0, True
                    elif p < ph["pickup"]:
                        v = va + 0.02 * (p - ph["a0"]) / 3.6
                        g, b, done = 0.0, 0.0, True
                    if done:
                        break
                if not done:
                    # throttle ramp right after the last pickup behind us (wrapping over the lap line)
                    d = min(((p - ph["pickup"]) % L) for ph in cs) if cs else 1e9
                    g = min(1.0, 0.4 + d / 20.0)
                spd[i], gas[i], brk[i] = v * 3.6, g, b
            end_v = spd[n - 1] / 3.6
            if abs(end_v - v_start) < 1e-6:
                break
            v_start = end_v
        self._spd, self._gas, self._brk = spd, gas, brk

    def _lookup(self, pos: float) -> tuple[float, float, float]:
        i = min(int(pos), len(self._spd) - 2)
        f = pos - i
        return (self._spd[i] + f * (self._spd[i + 1] - self._spd[i]), self._gas[i], self._brk[i])

    def _steer(self, pos: float) -> float:
        for c in self.track.corners:
            ti, ex = c.gate("turn_in_m"), c.exit_gate_m
            if ti <= pos < ex:
                a1, a2 = c.gate("apex1_m"), c.gate("apex2_m")
                if pos < a1:
                    return 0.30 * math.sin(math.pi / 2 * (pos - ti) / max(a1 - ti, 1.0))
                if pos < a2:
                    return 0.30 - 0.55 * (pos - a1) / max(a2 - a1, 1.0)
                return -0.25 * (1 - (pos - a2) / max(ex - a2, 1.0))
        return 0.0

    def _sample(self, status: str = "live") -> Sample:
        speed, gas, brake = self._lookup(self.pos)
        self.packet += 1
        n = self.length
        steer = self._steer(self.pos)
        v = speed / 3.6
        wb = self.track.corners[0].wheelbase_m if self.track.corners else 2.6
        yaw = v * math.tan(steer * 0.25) / wb
        g_lon = -brake * 2.4 + gas * 0.6
        slip_f = 0.03 + (0.25 if brake > 0.97 and v < 40 else 0.0)
        slip_r = 0.03 + (0.2 if gas > 0.9 and v < 35 else 0.0)
        return Sample(self.t, self.packet, status, self.pos / n, self.pos, speed, gas, brake,
                      steer, self.pos, 0.0, 0.0, g_lat=v * yaw / 9.81, g_lon=g_lon, yaw_rate=yaw,
                      slip_f=slip_f, slip_r=slip_r)

    def _wrap(self) -> None:
        self.lap_count += 1
        for cid, tgt in self.target_board.items():
            k = self.knobs[cid]
            k["board_m"] += self.skill * (tgt - k["board_m"])
        for cid, tgt in self.target_release.items():
            k = self.knobs[cid]
            k["release_s"] += self.skill * (tgt - k["release_s"])
        self._build()

    async def samples(self) -> AsyncIterator[Sample]:
        loop = asyncio.get_running_loop()
        wall0 = loop.time() - self.t
        while not self._stop:
            s = self._sample()
            yield s
            self.pos += (s.speed_kmh / 3.6) * self.dt
            if self.pos >= self.length:
                self.pos -= self.length
                self._wrap()
            self.t += self.dt
            if self.realtime:
                await asyncio.sleep(max(0.0, wall0 + self.t - loop.time()))
            else:
                await asyncio.sleep(0)
