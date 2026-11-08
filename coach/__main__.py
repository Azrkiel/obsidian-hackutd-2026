"""uv run python -m coach [--mode lap|drill] [--telemetry ac|sim|replay FILE] [--reset udp|hotkey|manual|sim]
[--voice auto|windows|nvidia|silent|off] [--port 8020] [--track fixtures/track_monza.json]

Whole lap: --track coaches every corner of the track in lap mode, one decision per lap after the
last corner (spoken on the main straight). Drill mode (rewind per corner) stays single-corner (--corner).

With --inputs the coach is also the input receiver: phone (UDP 5005) + Arduino pedals -> one
virtual Xbox 360 pad. Then do not run bridge/bridge.py or hardware/bridge.py alongside it (port 5005,
the COM port and a second virtual pad would clash). The pad/serial packages stay out of the uv .venv
(see PC_SETUP.md), so add them for that run only:
    uv run --with vgamepad --with pyserial python -m coach --telemetry ac --reset udp --inputs
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from engine.config import load_attempt, load_corner, load_track, load_track_reference
from engine.nemotron import default_providers
from engine.voice import make_speaker

from .app import CoachApp
from .dashboard import Dashboard
from .inputs import InputHub, make_pad
from .telemetry import ACSharedMemory, Recorder, ReplaySource, SimSource, TrackSimSource

ROOT = Path(__file__).resolve().parent.parent
# track sim demo: three corners with a mistake (two brake early, one snaps off the brake)
DEMO_SIM_CORNERS = {"ascari": {"board_m": 135}, "roggia": {"board_m": 120}, "parabolica": {"release_s": 0.15}}


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(prog="coach", description=__doc__)
    ap.add_argument("--telemetry", nargs="+", default=["sim"], metavar="ac|sim|replay [FILE]")
    ap.add_argument("--reset", choices=["udp", "hotkey", "manual", "sim"], default=None)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8020)
    ap.add_argument("--corner", default=str(ROOT / "fixtures" / "corner_monza_t1.json"))
    ap.add_argument("--reference", default=None)
    ap.add_argument("--data-dir", default=str(ROOT / "data"))
    ap.add_argument("--traces", default=str(ROOT / "traces"))
    ap.add_argument("--record", action="store_true", help="write samples to data/recordings/")
    ap.add_argument("--sound", action=argparse.BooleanOptionalAction, default=None)
    ap.add_argument("--countdown", type=int, default=3)
    ap.add_argument("--brake-board", type=float, default=86.0, help="sim: first-run brake board (m)")
    ap.add_argument("--transport", choices=["tools", "json"], default=None)
    g = ap.add_argument_group("inputs (phone + Arduino -> virtual pad; off unless --inputs)")
    g.add_argument("--inputs", action="store_true",
                   help="receive phone + Arduino inputs here instead of running bridge/bridge.py")
    g.add_argument("--pad", choices=["auto", "vgamepad", "none"], default="auto",
                   help="auto = vgamepad on Windows, none elsewhere (inputs are still read and logged)")
    g.add_argument("--phone-port", type=int, default=5005)
    g.add_argument("--arduino", default="auto", metavar="auto|off|COMx", help="serial pedals")
    g.add_argument("--arduino-udp-port", type=int, default=None,
                   help="also accept 'gas,brake' pedal datagrams on this UDP port (e.g. 5006)")
    g.add_argument("--invert-steer", action="store_true")
    g.add_argument("--gas-gamma", type=float, default=1.8,
                   help="throttle curve sent to the game: out = in^gamma. 1 = linear, higher = gentler "
                        "start (1.8: half pedal = 29%% throttle)")
    g.add_argument("--brake-gamma", type=float, default=1.0, help="brake curve, same as --gas-gamma")
    ap.add_argument("--auto-retry", action=argparse.BooleanOptionalAction, default=True,
                    help="after Accept, keep rewinding until the drill ends, then resume (default on)")
    ap.add_argument("--max-retries", type=int, default=5,
                    help="auto-retry stops after this many retries of one drill and resumes (default 5)")
    ap.add_argument("--mode", choices=["lap", "drill"], default="drill",
                    help="lap: keep driving, the coach talks (no Accept/reset). drill: Accept, reset, retry")
    ap.add_argument("--voice", choices=["auto", "windows", "nvidia", "silent", "off"], default=None,
                    help="spoken coaching (default: auto in lap mode, off in drill mode)")
    ap.add_argument("--mute", action="store_true", help="start with the voice muted (M toggles)")
    ap.add_argument("--agent", action="store_true",
                    help="Nemotron runs the session: read tools (profile, splits, ...) + a 1-3 goal plan")
    ap.add_argument("--release", type=float, default=0.55,
                    help="sim: first-run brake release time in s (0.15 = snaps off: triggers brake_release)")
    ap.add_argument("--lap-gap", type=float, default=12.0,
                    help="sim lap mode: seconds between corner passes")
    t = ap.add_argument_group("whole lap (lap mode over every corner of a track)")
    t.add_argument("--track", default=None, metavar="FILE",
                   help="track JSON (e.g. fixtures/track_monza.json): score and coach every corner; implies --mode lap")
    t.add_argument("--track-reference", default=None, metavar="FILE",
                   help="per-corner reference (default: data/track_reference.json, else the track's own)")
    t.add_argument("--sim-corner", action="append", default=[], metavar="ID:KEY=V[,KEY=V]",
                   help="track sim knobs, e.g. ascari:board_m=135 or parabolica:release_s=0.15 "
                        "(repeatable; default: a demo set with three mistakes)")
    return ap


def parse_sim_corners(specs: list[str]) -> dict[str, dict]:
    if not specs:
        return {k: dict(v) for k, v in DEMO_SIM_CORNERS.items()}
    out: dict[str, dict] = {}
    for spec in specs:
        cid, _, kv = spec.partition(":")
        if not cid or not kv:
            raise SystemExit(f"--sim-corner {spec!r}: expected ID:KEY=V[,KEY=V]")
        for pair in kv.split(","):
            k, _, v = pair.partition("=")
            try:
                out.setdefault(cid, {})[k.strip()] = float(v)
            except ValueError:
                raise SystemExit(f"--sim-corner {spec!r}: {v!r} is not a number") from None
    return out


def track_reference_path(args: argparse.Namespace, track_path: Path) -> Path:
    if args.track_reference:
        return Path(args.track_reference)
    data = Path(args.data_dir) / "track_reference.json"
    if data.exists():
        return data
    ref = json.loads(track_path.read_text(encoding="utf-8")).get("reference")
    if not ref:
        raise SystemExit(f"{track_path} names no reference; pass --track-reference")
    return track_path.parent / ref


def build_track_app(args: argparse.Namespace) -> CoachApp:
    tpath = Path(args.track)
    track = load_track(tpath)
    refs = load_track_reference(track_reference_path(args, tpath))
    missing = [c for c in track.ids if c not in refs]
    if missing:
        raise SystemExit(f"the track reference has no corner {missing}")
    kind = args.telemetry[0]
    if kind == "sim":
        unknown = [c for c in parse_sim_corners(args.sim_corner) if c not in track.ids]
        if unknown:
            raise SystemExit(f"--sim-corner: unknown corner {unknown}; known: {track.ids}")
        source = TrackSimSource(track, corners=parse_sim_corners(args.sim_corner))
    elif kind == "ac":
        source = ACSharedMemory(track.length_m)
    elif kind == "replay":
        if len(args.telemetry) < 2:
            raise SystemExit("--telemetry replay needs a FILE")
        source = ReplaySource(args.telemetry[1], realtime=True)
    else:
        raise SystemExit(f"unknown telemetry source {kind!r}")
    reset = args.reset or "manual"
    if reset == "sim":
        raise SystemExit("--reset sim is for single-corner drills; whole lap never resets the car")
    voice = args.voice or "auto"
    speaker = None if voice == "off" else make_speaker(voice)
    first = track.corners[0].id
    return CoachApp(track.corners[0], refs[first][0], source, default_providers(transport=args.transport),
                    reset_mode=reset, data_dir=Path(args.data_dir), trace_dir=args.traces,
                    recorder=Recorder(Path(args.data_dir) / "recordings") if args.record else None,
                    sound=args.sound, countdown=args.countdown, persist_checkpoint=kind != "sim",
                    mode="lap", speaker=speaker, muted=args.mute, agent=args.agent,
                    inputs=build_inputs(args), auto_retry=False, max_retries=args.max_retries,
                    track=track, track_references=refs)


def build_inputs(args: argparse.Namespace) -> InputHub | None:
    if not args.inputs:
        return None
    try:
        pad = make_pad(args.pad)
    except RuntimeError as e:
        raise SystemExit(f"error: {e}") from e
    return InputHub(pad, phone_port=args.phone_port, arduino=args.arduino,
                    arduino_udp_port=args.arduino_udp_port, invert_steer=args.invert_steer,
                    gas_gamma=args.gas_gamma, brake_gamma=args.brake_gamma)


def build_app(args: argparse.Namespace) -> CoachApp:
    if args.track:
        if args.mode == "drill" and "--mode" in sys.argv:
            raise SystemExit("--track is lap mode only (drill mode rewinds one corner: use --corner)")
        args.mode = "lap"
        return build_track_app(args)
    corner = load_corner(args.corner)
    data = Path(args.data_dir)
    if args.reference:
        ref_path = Path(args.reference)
    elif (data / "reference.json").exists():
        ref_path = data / "reference.json"
    else:
        ref_path = ROOT / "fixtures" / "reference.json"
    ref_trace_path = ref_path.with_name(ref_path.stem + "_trace.json")
    ref_trace = json.loads(ref_trace_path.read_text(encoding="utf-8")) if ref_trace_path.exists() else []
    kind = args.telemetry[0]
    lap = args.mode == "lap"
    if kind == "sim":
        source = SimSource(corner, brake_board_m=args.brake_board, laps=lap, lap_gap_s=args.lap_gap,
                           release_s=args.release)
        reset = args.reset or ("manual" if lap else "sim")
    elif kind == "ac":
        source = ACSharedMemory(corner.track_length_m)
        reset = args.reset or "manual"
    elif kind == "replay":
        if len(args.telemetry) < 2:
            raise SystemExit("--telemetry replay needs a FILE")
        source = ReplaySource(args.telemetry[1], realtime=True)
        reset = args.reset or "manual"
    else:
        raise SystemExit(f"unknown telemetry source {kind!r}")
    if reset == "sim" and kind != "sim":
        raise SystemExit("--reset sim needs --telemetry sim")
    voice = args.voice or ("auto" if lap else "off")
    speaker = None if voice == "off" else make_speaker(voice)
    return CoachApp(corner, load_attempt(ref_path), source,
                    default_providers(transport=args.transport), reset_mode=reset,
                    reference_trace=ref_trace, data_dir=data, trace_dir=args.traces,
                    recorder=Recorder(data / "recordings") if args.record else None,
                    sound=args.sound, countdown=args.countdown,
                    persist_checkpoint=kind != "sim", mode=args.mode, speaker=speaker,
                    muted=args.mute, agent=args.agent, inputs=build_inputs(args),
                    auto_retry=args.auto_retry, max_retries=args.max_retries)


async def amain(args: argparse.Namespace) -> None:
    app = build_app(args)
    dash = Dashboard(app, args.host, args.port)
    await dash.start()
    try:
        await app.start()
    except RuntimeError as e:  # e.g. UDP 5005 already taken by bridge.py
        await dash.stop()
        raise SystemExit(f"error: {e}") from e
    voice = "off" if app.announcer is None else app.announcer.speaker.name
    print(f"NomadSim coach: mode={app.mode} agent={'on' if app.coach.agent else 'off'} telemetry={args.telemetry[0]} reset={app.reset.mode} "
          f"voice={voice} dashboard http://{args.host}:{args.port}", flush=True)
    if app.track is not None:
        print(f"whole lap: {app.track.name}, corners {', '.join(app.track.ids)}; decides after {app.track.last_id}",
              flush=True)
    if app.inputs is not None:
        i = app.inputs
        print(f"inputs: phone UDP :{i.phone_port}, arduino {i.arduino}"
              f"{f' + UDP :{i.arduino_udp_port}' if i.arduino_udp_port else ''}, pad {type(i.pad).__name__}",
              flush=True)
    try:
        await asyncio.Event().wait()
    finally:
        await app.stop()
        await dash.stop()


def main() -> None:
    args = build_parser().parse_args()
    try:
        import truststore
        truststore.inject_into_ssl()
    except ImportError:
        pass
    try:
        asyncio.run(amain(args))
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
