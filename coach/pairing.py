"""QR pairing: the phone scans a code on the race PC and every UDP packet after that is signed.

The only requirement is that the phone and the PC are on the same network. The QR carries
everything the phone needs, so there is no IP to type and Bonjour is not needed:

    nomadsim://pair?v=1&h=<ipv4>,<ipv4>&p=<udp port>&k=<key>&n=<pc name>&id=<receiver id>

  h   the PC's LAN IPv4 addresses (the phone tries each and keeps the first that answers)
  k   128-bit pairing key, base64url without padding. Only the QR holds it: anyone who can see the
      code can pair, so show it on the PC's own screen. "New pairing code" replaces it.
  id  first 8 hex digits of SHA-256(key): lets the app tell receivers apart

Handshake (HMAC-SHA256; a tag is the hex of the first N bytes of the MAC):

  phone -> PC   h1,<pn>,<tag32>                   tag32 = HMAC(K, "h1,<pn>")[:16]
  PC -> phone   w1,<pn>,<rn>,<name>,<tag32>       tag32 = HMAC(K, "w1,<pn>,<rn>,<name>")[:16]
                pn / rn: 16 hex digits of fresh randomness from the phone / the PC
  session key   S = HMAC(K, "s1,<pn>,<rn>")

  The welcome proves to the phone that it reached the real receiver; the hello proves to the PC
  that the phone scanned the code. A new hello always starts a new session.

Signed packets, both directions: "<packet>,<tag16>" with tag16 = HMAC(S, "<packet>")[:8]

  phone -> PC   v1,<seq>,<steer>,<throttle>,<brake>,<tag16>
                evt,<id>,<command>,<phase>,<tag16>
  PC -> phone   ack,<seq>,<tag16>
  PC -> phone   rehello            (unsigned hint: "I have no session for you, say hello again",
                                    e.g. after the receiver restarted; it grants nothing)

Within a session v1 sequence numbers must keep increasing, so a recorded packet can't be replayed;
event ids are de-duplicated as before. Packets are signed, not encrypted: steering values are not
secret, but nobody without the key can drive the car or fake the receiver's replies.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import ipaddress
import json
import re
import secrets
import socket
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote

from .qrcodegen import QrCode

SCHEME = "nomadsim"
VERSION = 1
MODES = ("off", "optional", "required")
_HEX16 = re.compile(rb"[0-9a-f]{16}")
_HEX32 = re.compile(rb"[0-9a-f]{32}")
_NAME = re.compile(r"[^A-Za-z0-9 ._-]")


def mac(key: bytes, text: bytes, n: int) -> bytes:
    """Hex of the first n bytes of HMAC-SHA256(key, text)."""
    return hmac.new(key, text, hashlib.sha256).hexdigest()[: 2 * n].encode()


def sign(key: bytes, packet: bytes) -> bytes:
    return packet + b"," + mac(key, packet, 8)


def verify(key: bytes, signed: bytes) -> bytes | None:
    """The packet without its tag if the tag is right, else None."""
    packet, sep, tag = signed.rpartition(b",")
    if not sep or not _HEX16.fullmatch(tag):
        return None
    return packet if hmac.compare_digest(mac(key, packet, 8), tag) else None


def looks_signed(data: bytes) -> bool:
    return bool(_HEX16.fullmatch(data.rpartition(b",")[2]))


@dataclass
class Session:
    key: bytes
    last_seq: int = -1


def local_ipv4s(limit: int = 4) -> list[str]:
    """LAN IPv4 addresses a phone on the same network could reach, the default route's first."""
    found: list[str] = []
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            probe.connect(("8.8.8.8", 9))  # no packet is sent; this only picks the outgoing interface
            found.append(probe.getsockname()[0])
        finally:
            probe.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET, socket.SOCK_DGRAM):
            found.append(info[4][0])
    except OSError:
        pass
    out: list[str] = []
    for a in found:
        ip = ipaddress.ip_address(a)
        if ip.is_private and not ip.is_loopback and not ip.is_link_local and a not in out:
            out.append(a)
    return out[:limit]


class Pairing:
    """The receiver's side: pairing key (kept in data/pairing.json), QR code, handshake."""

    def __init__(self, path: str | Path | None = None, port: int = 5005, name: str | None = None,
                 hosts: list[str] | None = None):
        self.path = Path(path) if path else None
        self.port = port
        self.name = _NAME.sub("", name or socket.gethostname().split(".")[0])[:32] or "NomadSim"
        self._hosts = hosts
        self.key = self._load() or self._new_key()

    # -- key --
    def _load(self) -> bytes | None:
        if not self.path or not self.path.exists():
            return None
        try:
            key = _b64d(json.loads(self.path.read_text(encoding="utf-8"))["key"])
        except (OSError, ValueError, KeyError, TypeError):
            return None
        return key if len(key) == 16 else None

    def _new_key(self) -> bytes:
        key = secrets.token_bytes(16)
        if self.path:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.path.write_text(json.dumps({"key": _b64e(key)}), encoding="utf-8")
        return key

    def rotate(self) -> None:
        """New code: phones paired with the old one must scan again."""
        self.key = self._new_key()

    @property
    def receiver_id(self) -> str:
        return hashlib.sha256(self.key).hexdigest()[:8]

    # -- code --
    def hosts(self) -> list[str]:
        return list(self._hosts) if self._hosts is not None else local_ipv4s()

    def uri(self) -> str:
        return (f"{SCHEME}://pair?v={VERSION}&h={','.join(self.hosts())}&p={self.port}"
                f"&k={_b64e(self.key)}&n={quote(self.name)}&id={self.receiver_id}")

    def qr(self) -> QrCode:
        return QrCode.encode_text(self.uri(), QrCode.Ecc.MEDIUM)

    def qr_svg(self, border: int = 4) -> str:
        q = self.qr()
        n = q.get_size()
        cells = "".join(f"M{x + border},{y + border}h1v1h-1z" for y in range(n) for x in range(n)
                        if q.get_module(x, y))
        size = n + 2 * border
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" '
                f'shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/>'
                f'<path d="{cells}" fill="#000"/></svg>')

    def qr_text(self, border: int = 2) -> str:
        """The code drawn with half-block characters, for the terminal (dark text on light is not
        assumed: light modules are drawn, so it scans on a dark console)."""
        q = self.qr()
        n = q.get_size()

        def dark(x: int, y: int) -> bool:
            return 0 <= x < n and 0 <= y < n and q.get_module(x, y)

        rows = []
        for y in range(-border, n + border, 2):
            row = []
            for x in range(-border, n + border):
                top, bottom = not dark(x, y), not dark(x, y + 1)
                row.append("█" if top and bottom else "▀" if top else "▄" if bottom else " ")
            rows.append("".join(row))
        return "\n".join(rows)

    # -- handshake --
    def welcome(self, hello: bytes) -> tuple[bytes, Session] | None:
        """Answer a valid hello with a signed welcome and the new session; None for anything else."""
        parts = hello.split(b",")
        if len(parts) != 3 or parts[0] != b"h1" or not _HEX16.fullmatch(parts[1]) \
                or not _HEX32.fullmatch(parts[2]):
            return None
        pn = parts[1]
        if not hmac.compare_digest(mac(self.key, b"h1," + pn, 16), parts[2]):
            return None
        rn = secrets.token_hex(8).encode()
        body = b"w1," + pn + b"," + rn + b"," + self.name.encode()
        session = Session(hmac.new(self.key, b"s1," + pn + b"," + rn, hashlib.sha256).digest())
        return body + b"," + mac(self.key, body, 16), session


# --- the phone's side, for tests and tools (the iOS app implements the same with CryptoKit) ------
class PhoneClient:
    def __init__(self, uri_or_key: str | bytes):
        self.key = uri_or_key if isinstance(uri_or_key, bytes) else parse_uri(uri_or_key)["key"]
        self.pn = secrets.token_hex(8).encode()
        self.session: bytes | None = None

    def hello(self) -> bytes:
        return b"h1," + self.pn + b"," + mac(self.key, b"h1," + self.pn, 16)

    def accept(self, welcome: bytes) -> str | None:
        """Check the receiver's welcome; on success keep the session key and return the PC name."""
        body, _, tag = welcome.rpartition(b",")
        parts = body.split(b",")
        if len(parts) != 4 or parts[0] != b"w1" or parts[1] != self.pn \
                or not hmac.compare_digest(mac(self.key, body, 16), tag):
            return None
        self.session = hmac.new(self.key, b"s1," + self.pn + b"," + parts[2], hashlib.sha256).digest()
        return parts[3].decode()

    def send(self, packet: str) -> bytes:
        return sign(self.session, packet.encode())

    def check(self, reply: bytes) -> bytes | None:
        return verify(self.session, reply)


def parse_uri(uri: str) -> dict:
    """nomadsim://pair?... -> {"hosts", "port", "key", "name", "id"}. Raises ValueError if invalid."""
    from urllib.parse import parse_qs, urlsplit

    u = urlsplit(uri)
    q = {k: v[0] for k, v in parse_qs(u.query).items()}
    if u.scheme != SCHEME or u.netloc != "pair" or q.get("v") != str(VERSION):
        raise ValueError("not a NomadSim pairing code")
    key = _b64d(q["k"])
    if len(key) != 16:
        raise ValueError("bad pairing key")
    return {"hosts": [h for h in q.get("h", "").split(",") if h], "port": int(q["p"]),
            "key": key, "name": q.get("n", ""), "id": q.get("id", "")}


def _b64e(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _b64d(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))
