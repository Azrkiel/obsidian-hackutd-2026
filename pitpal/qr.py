"""The pairing QR as a grid of dark/light modules (drawn by the window as flat pixel rectangles)."""
from __future__ import annotations

from coach.qrcodegen import QrCode


def modules(text: str) -> list[list[bool]]:
    qr = QrCode.encode_text(text, QrCode.Ecc.MEDIUM)
    n = qr.get_size()
    return [[qr.get_module(x, y) for x in range(n)] for y in range(n)]
