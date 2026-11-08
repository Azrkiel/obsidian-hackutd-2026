"""Pit Pal brand tokens (the Pit theme) and asset loading for the overlay.

Colours are the design system's tokens.json, verbatim. Fonts are its woff2 files converted once to
ttf (Tk cannot read woff2); they are loaded privately for this process, nothing is installed.
"""
from __future__ import annotations

import sys
import tkinter as tk
import tkinter.font
from pathlib import Path

ASSETS = Path(__file__).resolve().parent / "assets"
KEY = "#010203"      # the window's see-through colour: never drawn on, and no text ever touches it

C = {
    "bg": "#12141c", "surface": "#1c1f2a", "raised": "#222633", "hair": "#2b2f3a",
    "edge": "#616b83",       # outline-strong
    "ol": "#0a0b10",         # pixel-outline
    "ink": "#e8ebf2", "muted": "#8d96ad", "faint": "#5a6277",
    "brand": "#d92b1f", "deep": "#8a150f", "tint": "#3a1512", "accent": "#ff6a58",
    "go": "#3fd17a", "ongo": "#06210f", "caution": "#ffc233", "blue": "#4aa8ff", "led": "#ff7a1a",
    "white": "#ffffff",
}

FONT_FILES = ("PitPalBubble.ttf", "barlow-500-normal.ttf", "barlow-600-normal.ttf", "barlow-700-normal.ttf")
OUTFITS = {"racer": "rev_racer.png", "helmet_suit": "rev_helmet_suit.png", "suit": "rev_suit.png",
           "base": "rev_base.png"}


def mix(a: str, b: str, t: float) -> str:
    """a blended toward b by t (0..1), as a hex colour."""
    ca = [int(a[i:i + 2], 16) for i in (1, 3, 5)]
    cb = [int(b[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(x + (y - x) * t):02x}" for x, y in zip(ca, cb))


def load_fonts() -> None:
    """Make the ttf files in assets/fonts usable by this process only (Windows)."""
    if sys.platform != "win32":
        return
    import ctypes
    add = ctypes.windll.gdi32.AddFontResourceExW
    for name in FONT_FILES:
        p = ASSETS / "fonts" / name
        if p.exists():
            add(str(p), 0x10, 0)      # FR_PRIVATE


def pick_family(root: tk.Misc, *names: str) -> str:
    have = set(tk.font.families(root))
    for n in names:
        if n in have:
            return n
    return "Segoe UI"


class Sprites:
    """Rev at a whole-number zoom: nearest-neighbour only, so every art pixel stays a sharp square."""

    def __init__(self, scale: int):
        self.scale = scale
        self._base: dict[str, tk.PhotoImage] = {}
        self._zoom: dict[str, tk.PhotoImage] = {}

    def get(self, outfit: str) -> tk.PhotoImage:
        if outfit not in self._zoom:
            if outfit not in self._base:
                self._base[outfit] = tk.PhotoImage(file=str(ASSETS / "rev" / OUTFITS[outfit]))
            self._zoom[outfit] = self._base[outfit].zoom(self.scale, self.scale)
        return self._zoom[outfit]
