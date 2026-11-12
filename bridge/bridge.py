"""Pit Pal PC bridge: phone tilt (UDP) + Arduino pedals (serial) -> one virtual Xbox 360 pad.

Run ONLY this bridge (not the coach with --inputs at the same time): two bridges = two virtual pads in AC.

Inputs
  phone   UDP :5005   "v1,seq,steer,throttle,brake"   steer -1..1, throttle/brake 0..1
  arduino serial      "gas,brake"   ints 0..1000  (hardware/pedals/pedals.ino, feat/hardware-pedals)
                      "B,<mm>,<valid>"              (older single-brake format, still accepted)
Mixing
  steering  always from the phone
  gas/brake from the pedals while they are fresh; with --no-arduino, from the phone
Failsafe
  pedals expected but silent > 200 ms (or unplugged) -> gas 0, brake 0, "INVALID" printed;
  phone silent > 200 ms -> steer 0, phone gas/brake 0. The bridge never needs the network or Nemotron.

  D:\\bridge-venv\\Scripts\\python.exe bridge\\bridge.py --debug            (auto-detect Arduino)
  D:\\bridge-venv\\Scripts\\python.exe bridge\\bridge.py --no-arduino --debug
"""
import argparse
import socket
import threading
import time

import serial
import serial.tools.list_ports as lp
import vgamepad as vg

STALE_S = 0.2

ap = argparse.ArgumentParser()
ap.add_argument("--com", default="auto", help="COM port, or 'auto' to find the Arduino")
ap.add_argument("--port", type=int, default=5005)
ap.add_argument("--rel", type=float, default=120, help="old B,mm format: released distance mm")
ap.add_argument("--full", type=float, default=40, help="old B,mm format: fully pressed distance mm")
ap.add_argument("--gas-gamma", type=float, default=1.8,
                help="throttle curve: out = in^gamma. 1 = linear; higher = gentler start "
                     "(1.8: half pedal = 29%% throttle)")
ap.add_argument("--brake-gamma", type=float, default=1.0, help="brake curve, same as --gas-gamma")
ap.add_argument("--no-arduino", action="store_true")
ap.add_argument("--debug", action="store_true")
a = ap.parse_args()

S = dict(steer=0., thr=0., pbrk=0., agas=0., abrk=0., t_phone=0., t_ard=0., seq=-1, com=None)


def find_port():
    for p in lp.comports():
        d = (p.description or "").lower()
        if p.vid == 0x2341 or "arduino" in d or "ch340" in d or "usb serial" in d:
            return p.device
    return None


def bind_phone_socket():
    """Bind UDP :port exclusively (Windows), BEFORE creating the virtual pad. If another receiver
    (coach --inputs, phone/bridge) has the port, exit instead of sharing it."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
        s.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
    try:
        s.bind(("0.0.0.0", a.port))
    except OSError as e:
        raise SystemExit(f"UDP {a.port} is already in use ({e}). Another receiver is running "
                         f"(coach --inputs or phone/bridge). Stop it first: "
                         f"only one program may create the virtual pad.")
    return s


def phone(s):
    while True:
        d, _ = s.recvfrom(256)
        try:
            v, seq, st, th, br = d.decode().strip().split(",")
            seq = int(seq)
            if v != "v1" or (seq <= S["seq"] and S["seq"] - seq < 1000):
                continue
            S.update(seq=seq, steer=max(-1., min(1., float(st))), thr=max(0., min(1., float(th))),
                     pbrk=max(0., min(1., float(br))), t_phone=time.time())
        except ValueError:
            pass


def parse_line(parts, last_mm):
    """Return (gas, brake, last_mm) or None. gas None = line carried no gas value."""
    if len(parts) == 2:                                  # pedals.ino: "gas,brake" 0..1000
        g, b = int(parts[0]), int(parts[1])
        return max(0, min(1000, g)) / 1000, max(0, min(1000, b)) / 1000, last_mm
    if len(parts) == 3 and parts[0] == "B" and parts[2] == "1":   # old "B,mm,valid"
        mm = float(parts[1])
        if last_mm is not None and abs(mm - last_mm) > 40:
            return None                                  # outlier jump
        k = (a.rel - mm) / (a.rel - a.full)
        return None, (0. if k < 0.05 else min(1., max(0., k))), mm
    return None


def ard():
    while True:
        port = a.com if a.com != "auto" else find_port()
        if not port:
            time.sleep(1)
            continue
        try:
            try:
                ser = serial.Serial(port, 115200, timeout=0.1)
            except serial.SerialException as e:
                print(f"cannot open {port} ({e}); is a serial monitor or another bridge using it? retrying")
                raise
            S["com"] = port
            last_mm = None
            while True:
                line = ser.readline().decode(errors="ignore").strip()
                if not line or line[0] == "#":
                    continue
                try:
                    r = parse_line(line.split(","), last_mm)
                except ValueError:
                    continue
                if r is None:
                    continue
                g, b, last_mm = r
                if g is not None:
                    S["agas"] = g
                S["abrk"] = b
                S["t_ard"] = time.time()
        except (serial.SerialException, OSError):
            S["com"] = None
            time.sleep(1)                                # unplugged: failsafe kicks in, retry


phone_sock = bind_phone_socket()
pad = vg.VX360Gamepad()
threading.Thread(target=phone, args=(phone_sock,), daemon=True).start()
if not a.no_arduino:
    threading.Thread(target=ard, daemon=True).start()
print(f"virtual pad ready; phone UDP :{a.port}; arduino {'off' if a.no_arduino else a.com}")

n = 0
while True:
    now = time.time()
    ph = now - S["t_phone"] < STALE_S
    ar = now - S["t_ard"] < STALE_S
    if a.no_arduino:
        gas, brake, valid = (S["thr"], S["pbrk"], True) if ph else (0., 0., True)
    elif ar:
        gas, brake, valid = S["agas"], S["abrk"], True
    else:
        gas, brake, valid = 0., 0., False                # pedals lost -> neutral + run invalid
    raw_gas = gas
    gas, brake = gas ** a.gas_gamma, brake ** a.brake_gamma   # response curves (0 and 1 unchanged)
    pad.left_joystick_float(S["steer"] if ph else 0., 0.)
    pad.right_trigger_float(gas)
    pad.left_trigger_float(brake)
    pad.update()
    time.sleep(0.005)
    n += 1
    if a.debug and n % 100 == 0:
        print(f"steer {S['steer']:+.2f} gas {gas:.2f} (pedal {raw_gas:.2f}) brk {brake:.2f} phone {ph} "
              f"arduino {ar} ({S['com']}){'' if valid else '  INVALID: pedals lost'}")
