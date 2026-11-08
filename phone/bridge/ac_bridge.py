"""Stealth Racing -> Assetto Corsa bridge.

Receives the phone's UDP packets and drives a virtual Xbox 360 controller.

    py bridge\\ac_bridge.py --backend gamepad        (Windows)
    python3 bridge/ac_bridge.py                      (dry run, any OS)
"""

import argparse
import shutil
import signal
import socket
import subprocess
import sys

from arduino import ArduinoPedals
from backends import DryRunBackend, Driver, GamepadBackend
from protocol import ControlPacket, EventDeduper, EventPacket, parse_packet

SERVICE_TYPE = "_stealth-racing._udp"
TICK_SECONDS = 0.01


def open_receiver(port):
    """Bind IPv4 and IPv6 where supported, else IPv4 only (same as listen.py)."""
    try:
        receiver = socket.socket(socket.AF_INET6, socket.SOCK_DGRAM)
        try:
            receiver.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
            receiver.bind(("::", port))
        except OSError:
            receiver.close()
            raise
        return receiver, "IPv4 and IPv6"
    except OSError:
        receiver = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        receiver.bind(("", port))
        return receiver, "IPv4"


def advertise(port):
    dns_sd = shutil.which("dns-sd")
    if not dns_sd:
        print("Bonjour unavailable. Enter this computer's IP in the app.", flush=True)
        return None
    name = f"Stealth Racing - {socket.gethostname().split('.')[0]}"
    return subprocess.Popen([dns_sd, "-R", name, SERVICE_TYPE, "local.", str(port)],
                            stdout=subprocess.DEVNULL)


def make_backend(name):
    if name == "gamepad":
        return GamepadBackend()
    return DryRunBackend()


def run(args):
    backend = make_backend(args.backend)
    driver = Driver(backend, invert_steer=args.invert_steer)
    pedals = ArduinoPedals(args.arduino_port)
    deduper = EventDeduper()
    senders = set()

    receiver, protocol = open_receiver(args.port)
    receiver.settimeout(TICK_SECONDS)
    print(f"Bridge listening on UDP port {args.port} ({protocol}), backend: {args.backend}", flush=True)
    advertisement = advertise(args.port)
    try:
        while True:
            try:
                data, sender = receiver.recvfrom(1024)
            except socket.timeout:
                driver.tick()
                continue
            except ConnectionResetError:
                # Windows can report an ICMP reply after a sender disconnects.
                continue

            if sender not in senders:
                senders.add(sender)
                host = sender[0].removeprefix("::ffff:")
                print(f"Connection successful: received UDP from {host} (port {sender[1]})", flush=True)

            packet = parse_packet(data)
            if isinstance(packet, ControlPacket):
                driver.handle_control(packet, pedals.read())
                if packet.seq % 30 == 0:
                    try:
                        receiver.sendto(b"ack,%d" % packet.seq, sender)
                    except OSError:
                        pass
            elif isinstance(packet, EventPacket) and deduper.is_new(sender, packet.id):
                button = driver.handle_event(packet)
                print(f"EVENT {packet.command} {packet.phase} -> {button or 'unbound'}", flush=True)
            driver.tick()
    except KeyboardInterrupt:
        pass
    finally:
        driver.neutralize()
        receiver.close()
        if advertisement:
            advertisement.terminate()
            advertisement.wait()


def main(argv=None):
    parser = argparse.ArgumentParser(description="Drive Assetto Corsa from the Stealth Racing phone app.")
    parser.add_argument("--port", type=int, default=5005, help="UDP port (default: 5005)")
    parser.add_argument("--backend", choices=("dryrun", "gamepad"), default="dryrun",
                        help="dryrun logs inputs; gamepad drives a virtual Xbox 360 controller")
    parser.add_argument("--arduino-port", help="serial port of the Arduino pedals (not implemented yet)")
    parser.add_argument("--invert-steer", action="store_true", help="flip steering direction")
    args = parser.parse_args(argv)
    if not 1 <= args.port <= 65535:
        parser.error("--port must be between 1 and 65535")

    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    try:
        run(args)
    except RuntimeError as error:
        parser.exit(1, f"error: {error}\n")


if __name__ == "__main__":
    main()
