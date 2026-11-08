import argparse
import shutil
import signal
import socket
import subprocess
from collections import deque

SERVICE_TYPE = "_stealth-racing._udp"

# Stub: map each phone command to an Assetto Corsa input in the game bridge
# (virtual controller button, keystroke, ...). None means "not mapped yet".
AC_BINDINGS = {
    "shift_up": None,
    "shift_down": None,
    "pit_limiter": None,
    "drs": None,
    "headlights": None,
    "horn": None,       # held: receives down, then up
    "look_back": None,  # held: receives down, then up
    "tc_down": None,
    "tc_up": None,
    "abs_down": None,
    "abs_up": None,
    "camera": None,
}


def handle_event(command, phase):
    """Called once per unique event. Replace the print with the real AC input."""
    binding = AC_BINDINGS.get(command)
    target = binding if binding is not None else "unmapped"
    print(f"EVENT {command} {phase} -> {target}", flush=True)


def stop_listener(_signum, _frame):
    raise SystemExit(0)


def open_receiver():
    try:
        receiver = socket.socket(socket.AF_INET6, socket.SOCK_DGRAM)
        try:
            receiver.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except OSError:
            receiver.close()
            raise
        return receiver, "::", "IPv4 and IPv6"
    except OSError:
        return socket.socket(socket.AF_INET, socket.SOCK_DGRAM), "", "IPv4"


parser = argparse.ArgumentParser(description="Receive Stealth Racing controller packets.")
parser.add_argument("--port", type=int, default=5005, help="UDP port (default: 5005)")
port = parser.parse_args().port
if not 1 <= port <= 65535:
    parser.error("--port must be between 1 and 65535")

signal.signal(signal.SIGTERM, stop_listener)

receiver, bind_address, protocol = open_receiver()
with receiver:
    receiver.bind((bind_address, port))
    print(f"Listening on UDP port {port} ({protocol})", flush=True)
    dns_sd = shutil.which("dns-sd")
    advertisement = None
    senders = set()
    seen_events = {}  # sender -> recent event IDs; each event arrives up to 3 times
    try:
        if dns_sd:
            name = f"Stealth Racing - {socket.gethostname().split('.')[0]}"
            advertisement = subprocess.Popen([dns_sd, "-R", name, SERVICE_TYPE, "local.", str(port)])
        else:
            print("Bonjour unavailable. Enter this computer's IP in the app.", flush=True)

        while True:
            try:
                packet, sender = receiver.recvfrom(1024)
            except ConnectionResetError:
                # Windows can report an ICMP reply after a sender disconnects.
                continue
            if sender not in senders:
                senders.add(sender)
                host = sender[0].removeprefix("::ffff:")
                print(f"Connection successful: received UDP from {host} (port {sender[1]})", flush=True)
            fields = packet.split(b",")
            # evt,<id>,<command>,<tap|down|up>
            if len(fields) == 4 and fields[0] == b"evt" and fields[1].isdigit():
                recent = seen_events.setdefault(sender, deque(maxlen=64))
                if fields[1] not in recent:
                    recent.append(fields[1])
                    handle_event(fields[2].decode("utf-8", "replace"), fields[3].decode("utf-8", "replace"))
                continue
            print(packet.decode("utf-8", errors="replace"), flush=True)
            if len(fields) == 5 and fields[0] == b"v1" and fields[1].isdigit():
                sequence = fields[1]
                if int(sequence) % 30 == 0:
                    try:
                        receiver.sendto(b"ack," + sequence, sender)
                    except OSError:
                        pass
    except KeyboardInterrupt:
        pass
    finally:
        if advertisement:
            advertisement.terminate()
            advertisement.wait()
