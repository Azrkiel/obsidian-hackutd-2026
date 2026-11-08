"""The Pit Pal overlay window: Rev and a speech bubble, always on top of the game.

Crispness rules (the whole point of a pixel mascot):
  * the process is per-monitor DPI aware, so Windows never bitmap-stretches the window;
  * Rev is zoomed by whole numbers with nearest-neighbour sampling, and moves in whole art pixels;
  * everything is drawn from flat rectangles on the pixel grid, no curves, no blur, no gradients;
  * text is only ever drawn on an opaque panel, never on the see-through colour (that would leave
    a coloured fringe around every letter);
  * the see-through colour is a colour key, so the window has no soft edges to smear.
It never takes focus from the game (WS_EX_NOACTIVATE) and has no taskbar entry; the see-through
parts pass clicks to the game.
"""
from __future__ import annotations

import json
import math
import queue
import sys
import time
import tkinter as tk
import tkinter.font as tkfont
from pathlib import Path

from . import brand
from .brand import C, KEY, mix
from .client import CoachClient
from .model import RevModel
from .qr import modules

STATE_FILE = Path(__file__).resolve().parent.parent / "data" / "pitpal.json"
TICK_MS = 33
LED_COLORS = ["go"] * 4 + ["caution"] * 3 + ["brand"] * 3


# ------------------------------------------------------------------ Windows glue
def dpi_aware() -> None:
    if sys.platform != "win32":
        return
    import ctypes
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)     # per-monitor
    except (AttributeError, OSError):
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except (AttributeError, OSError):
            pass


def _hwnd(root: tk.Tk) -> int:
    import ctypes
    h = root.winfo_id()
    return ctypes.windll.user32.GetParent(h) or h


def float_over_game(root: tk.Tk) -> None:
    """No focus, no taskbar button, topmost (re-asserted: games like to steal the top spot)."""
    if sys.platform != "win32":
        return
    import ctypes
    u = ctypes.windll.user32
    u.GetWindowLongPtrW.restype = ctypes.c_ssize_t
    u.GetWindowLongPtrW.argtypes = [ctypes.c_void_p, ctypes.c_int]
    u.SetWindowLongPtrW.restype = ctypes.c_ssize_t
    u.SetWindowLongPtrW.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_ssize_t]
    u.SetWindowPos.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_int, ctypes.c_int,
                               ctypes.c_int, ctypes.c_int, ctypes.c_uint]
    h = _hwnd(root)
    GWL_EXSTYLE, NOACTIVATE, TOOLWINDOW = -20, 0x08000000, 0x00000080
    u.SetWindowLongPtrW(h, GWL_EXSTYLE, u.GetWindowLongPtrW(h, GWL_EXSTYLE) | NOACTIVATE | TOOLWINDOW)
    # SWP_NOSIZE | NOMOVE | NOACTIVATE | FRAMECHANGED, HWND_TOPMOST
    u.SetWindowPos(h, ctypes.c_void_p(-1), 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010 | 0x0020)


def keep_on_top(root: tk.Tk) -> None:
    if sys.platform != "win32":
        root.attributes("-topmost", True)
        return
    import ctypes
    ctypes.windll.user32.SetWindowPos(_hwnd(root), ctypes.c_void_p(-1), 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010)


def screen_rect(root: tk.Tk) -> tuple[int, int, int, int]:
    """The whole primary screen (left, top, right, bottom). The game covers the taskbar, so no taskbar gap."""
    return 0, 0, root.winfo_screenwidth(), root.winfo_screenheight()


# ------------------------------------------------------------------ the overlay
class Overlay:
    def __init__(self, base_url: str, scale: int | None = None, side: str | None = None,
                 feed: "queue.Queue[dict] | None" = None):
        dpi_aware()
        self.root = tk.Tk()
        r = self.root
        r.withdraw()
        r.title("Rev")
        r.overrideredirect(True)
        r.configure(bg=KEY)
        r.attributes("-topmost", True)
        if sys.platform == "win32":
            r.attributes("-transparentcolor", KEY)
        brand.load_fonts()

        # one size knob: ui = how much bigger than a 1080p screen's pixels this screen needs
        self.ui = max(1.0, round(r.winfo_screenheight() / 1080 * 4) / 4)
        self.S = scale or max(3, round(4 * self.ui))                 # Rev's whole-number zoom
        self.stroke = max(2, round(2.5 * self.ui))
        self.ring = max(3, round(3 * self.ui))
        u = self.ui
        fam = brand.pick_family(r, "Barlow Medium", "Barlow")
        bold = brand.pick_family(r, "Barlow", "Barlow SemiBold")
        mk = lambda f, px, w="normal": tkfont.Font(root=r, family=f, size=-round(px * u), weight=w)  # noqa: E731
        self.f_body, self.f_bold = mk(fam, 14), mk(bold, 14, "bold")
        self.f_btn, self.f_lbl = mk(bold, 13, "bold"), mk(brand.pick_family(r, "Barlow SemiBold", "Barlow"), 11)
        self.f_small = mk(fam, 12)
        self.disp_family = brand.pick_family(r, "Pit Pal Bubble")
        self.sprites = brand.Sprites(self.S)

        self.margin, self.gap = round(12 * u), round(10 * u)
        self.rev_w = max(self.sprites.get(o).width() for o in brand.OUTFITS)
        self.rev_h = max(self.sprites.get(o).height() for o in brand.OUTFITS)
        self.bw_max = round(250 * u)
        self.chip_h = round(22 * u)
        self.W = self.margin * 2 + self.bw_max + self.gap + self.rev_w
        # room for Rev, the tail, and the tallest bubble (the pairing code) above his head
        self.H = self.margin * 2 + self.chip_h + self.rev_h + round(44 * u) + round(300 * u)
        saved = self._load_state()
        self.side = side or saved.get("side", "right")
        x, y = saved.get("x"), saved.get("y")
        if x is None or y is None:
            # bottom-right corner of the screen: the dark cockpit area, clear of the AC apps and the road
            l, t, rt, b = screen_rect(r)
            x, y = rt - self.W - round(36 * u), b - self.H - round(36 * u)      # a little inward from both edges
        self._place(x, y)
        self.c = tk.Canvas(r, width=self.W, height=self.H, bg=KEY, highlightthickness=0, bd=0)
        self.c.pack()

        self.model = RevModel()
        self.q: "queue.Queue[dict]" = feed or queue.Queue()
        self.client = CoachClient(base_url, self.q) if feed is None else None
        self.hover = self.expanded = self.menu = False
        self.hover_at = self.menu_at = 0.0
        self.regions: list[tuple[int, int, int, int, str]] = []
        self.pressed: str | None = None
        self.over: str | None = None
        self._drag: dict | None = None
        self._sig = None
        self._qr_cache: dict[str, list[list[bool]]] = {}
        self._last_top = 0.0
        self.c.bind("<Motion>", self._motion)
        self.c.bind("<Enter>", self._enter)
        self.c.bind("<Leave>", self._leave)
        self.c.bind("<ButtonPress-1>", self._press)
        self.c.bind("<B1-Motion>", self._dragging)
        self.c.bind("<ButtonRelease-1>", self._release)
        self.c.bind("<Button-3>", self._right_click)

    # ---- persistence / placement
    def _load_state(self) -> dict:
        try:
            return json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}

    def _save_state(self) -> None:
        try:
            STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
            STATE_FILE.write_text(json.dumps({"x": self.root.winfo_x(), "y": self.root.winfo_y(),
                                              "side": self.side}), encoding="utf-8")
        except OSError:
            pass

    def _place(self, x: int, y: int) -> None:
        self.root.geometry(f"{self.W}x{self.H}+{int(x)}+{int(y)}")

    def _snap(self) -> None:
        l, t, rt, b = screen_rect(self.root)
        x, y = self.root.winfo_x(), self.root.winfo_y()
        pad, near = round(36 * self.ui), round(140 * self.ui)
        if abs(x - (l + pad)) < near:
            x = l + pad
        if abs((x + self.W) - (rt - pad)) < near:
            x = rt - pad - self.W
        if abs(y - (t + pad)) < near:
            y = t + pad
        if abs((y + self.H) - (b - pad)) < near:
            y = b - pad - self.H
        self.side = "left" if x + self.W / 2 < (l + rt) / 2 else "right"
        self._place(x, y)
        self._save_state()

    # ---- run
    def run(self) -> None:
        self.root.deiconify()
        self.root.update_idletasks()
        float_over_game(self.root)
        if self.client:
            self.client.start()
        self.root.after(TICK_MS, self._tick)
        self.root.mainloop()

    def quit(self) -> None:
        if self.client:
            self.client.stop()
        self.root.destroy()

    def _tick(self) -> None:
        now = time.monotonic()
        try:
            while True:
                self.model.feed(self.q.get_nowait(), now)
        except queue.Empty:
            pass
        while self.model.outbox:
            self._send(self.model.outbox.pop(0))
        if now - self._last_top > 2.0:
            self._last_top = now
            keep_on_top(self.root)
        if self.hover and self.over is None and now - self.hover_at > 1.5 and not self.menu:
            self.hover = False
        if self.menu and now - self.menu_at > 6.0:
            self.menu = False
        v = self.model.view(now)
        dx, dy = self._offsets(v.anim, now - v.anim_t0)
        b = None if v.bubble is None else dict(v.bubble)
        if b and b["kind"] == "offer":
            b["lit"] = math.ceil(b.pop("frac") * 10)
        sig = (v.outfit, v.flash, dx, dy, None if b is None else tuple(sorted(b.items(), key=str)),
               None if v.chip is None else tuple(v.chip.items()), v.muted, tuple(v.actions),
               self.hover, self.expanded, self.menu, self.over, self.pressed,
               repr(v.card) if self.expanded else None)
        if sig != self._sig:
            self._sig = sig
            self._render(v, b, dx, dy)
        self.root.after(TICK_MS, self._tick)

    def _offsets(self, anim: str, t: float) -> tuple[int, int]:
        """Rev moves in whole art pixels, in steps, like sprite frames: never tweened."""
        S = self.S
        if anim == "idle":
            return 0, (-S if int(t * 1.8) % 2 else 0)
        if anim == "talk":
            return 0, (-S if int(t * 6) % 2 else 0)
        if anim == "think":
            return (S if int(t * 2) % 2 else 0), 0
        if anim == "warn":
            return ((S if int(t * 14) % 2 else -S) if t < 1.0 else 0), 0
        if anim == "hop":
            return 0, -S * (0, 2, 3, 3, 2, 0)[min(int(t * 12), 5)]
        if anim == "wince":
            return ((S if int(t * 12) % 2 else 0) if t < 0.5 else 0), (S if t < 0.45 else 0)
        return 0, 0

    # ---- drawing primitives (flat rectangles on the pixel grid)
    def _rect(self, x0, y0, x1, y1, fill) -> None:
        self.c.create_rectangle(round(x0), round(y0), round(x1), round(y1), fill=fill, outline="", width=0)

    def _plus_frame(self, x, y, w, h, t, color) -> None:
        """A frame whose four corners are notched: two overlapping bars, like the box-shadow ring."""
        self._rect(x, y - t, x + w, y + h + t, color)
        self._rect(x - t, y, x + w + t, y + h, color)

    def _text(self, x, y, s, font, fill, anchor="nw") -> None:
        self.c.create_text(round(x), round(y), text=s, font=font, fill=fill, anchor=anchor)

    def _display(self, x, y, s, size, anchor="nw") -> None:
        """Pit Pal Bubble: white face, near-black 1-cell outline, 1-cell red drop shadow (.pp-display)."""
        f = tkfont.Font(root=self.root, family=self.disp_family, size=-size)
        cell = max(1, round(size / 22))
        s = s.upper()
        for ox, oy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, -1), (-1, 1), (2, 1), (1, 2), (2, 2)):
            self._text(x + ox * cell, y + oy * cell, s, f, "#12141c", anchor)
        self._text(x + cell, y + cell, s, f, C["brand"], anchor)
        self._text(x, y, s, f, C["white"], anchor)

    def _button(self, x, y, w, h, label, kind, name, icon=None) -> None:
        lift = 2 * self.ring
        hot, down = self.over == name, self.pressed == name
        dy = -2 if hot and not down else (self.ring if down else 0)
        y += dy
        ring = self.ring
        if kind == "quiet":
            ring, face, fg = self.stroke, C["raised"], C["ink"]
            hi, lo, edge = mix(face, "#ffffff", 0.08), face, C["edge"]
        elif kind == "go":
            face, fg, hi, lo, edge = C["go"], C["ongo"], mix(C["go"], "#ffffff", 0.35), mix(C["go"], "#000000", 0.28), C["ol"]
        else:
            face, fg, hi, lo, edge = C["brand"], C["white"], mix(C["brand"], "#ffffff", 0.28), C["deep"], C["ol"]
        drop = lift if not down else lift // 2
        self._rect(x, y + drop, x + w, y + h + drop, C["ol"])
        self._plus_frame(x, y, w, h, ring, edge)
        self._rect(x, y, x + w, y + h, face)
        self._rect(x, y, x + w, y + ring, hi)
        self._rect(x, y + h - ring, x + w, y + h, lo)
        self._text(x + w / 2, y + h / 2, label, self.f_btn, fg, "center")
        self.regions.append((round(x - ring), round(y - ring), round(x + w + ring), round(y + h + ring + drop), name))

    def _led(self, x, y, lit, size=None, colors=None) -> int:
        size = size or round(11 * self.ui)
        gap = max(3, round(4 * self.ui))
        for i in range(10):
            on = i < lit
            col = (colors or LED_COLORS)[i]
            self._rect(x + i * (size + gap), y, x + i * (size + gap) + size, y + size, C[col] if on else C["hair"])
        return 10 * size + 9 * gap

    def _wrap(self, bold: str, rest: str, maxw: int) -> tuple[list[list[tuple[str, tkfont.Font]]], int]:
        """Greedy word wrap: the first sentence in bold, the rest regular. Returns lines of (text, font)."""
        words = [(w, self.f_bold) for w in bold.split()] + [(w, self.f_body) for w in rest.split()]
        lines: list[list[tuple[str, tkfont.Font]]] = [[]]
        cur = 0
        for w, f in words:
            ww, sp = f.measure(w), self.f_body.measure(" ")
            if lines[-1] and cur + sp + ww > maxw:
                lines.append([])
                cur = 0
            cur += (sp if lines[-1] else 0) + ww
            lines[-1].append((w, f))
        widest = max((sum(f.measure(w) for w, f in ln) + self.f_body.measure(" ") * (len(ln) - 1)) for ln in lines)
        return lines, widest

    def _draw_lines(self, x, y, lines) -> int:
        lh = self.f_body.metrics("linespace") + round(4 * self.ui)
        sp = self.f_body.measure(" ")
        for ln in lines:
            cx = x
            for w, f in ln:
                self._text(cx, y, w, f, C["ink"])
                cx += f.measure(w) + sp
            y += lh
        return lh * len(lines)

    # ---- the bubble
    def _frame(self, w: int, h: int, warn: bool = False) -> tuple[int, int]:
        """Draw the bubble above Rev's head, its pixel tail pointing down at him; return its top-left."""
        st = self.stroke
        step = st * 2
        tail_h = 3 * step + st
        by = self._head_top - round(6 * self.ui) - tail_h - h
        # the bubble sits up and to the side of Rev, its tail dropping toward his shoulder, so it
        # never covers his face or the road: right-docked Rev talks to the left, left-docked to the right
        if self.side == "right":
            end = self._rev_left + round(self._rev_img_w * 0.08)
            bx = min(max(end - w, self.margin), self.W - self.margin - w)
            near = min(max(end - step - st, bx + step + st), bx + w - step - st)
        else:
            start = self._rev_left + self._rev_img_w - round(self._rev_img_w * 0.08)
            bx = min(max(start, self.margin), self.W - self.margin - w)
            near = min(max(start + step + st, bx + step + st), bx + w - step - st)
        edge, face = (C["accent"], C["tint"]) if warn else (C["edge"], C["surface"])
        self._plus_frame(bx, by, w, h, st, edge)
        self._rect(bx, by, bx + w, by + h, face)
        for i in range(3):                                  # the tail: three narrowing steps
            tw = (3 - i) * step
            x0, x1 = (near - tw, near) if self.side == "right" else (near, near + tw)
            self._rect(x0 - st, by + h + i * step, x1 + st, by + h + (i + 1) * step + (st if i == 2 else 0), edge)
        for i in range(3):
            tw = (3 - i) * step
            x0, x1 = (near - tw, near) if self.side == "right" else (near, near + tw)
            self._rect(x0, by + h - (st if i == 0 else 0), x1, by + h + (i + 1) * step - (st if i == 2 else 0), face)
        return bx, by

    def _bubble(self, b: dict) -> None:
        pad, u = round(10 * self.ui), self.ui
        kind = b["kind"]
        maxtext = self.bw_max - 2 * pad - 2 * self.stroke
        if kind in ("text", "warn"):
            lines, tw = self._wrap(b.get("bold", ""), b.get("rest", ""), maxtext)
            lh = self.f_body.metrics("linespace") + round(4 * u)
            w, h = tw + 2 * pad, len(lines) * lh + 2 * pad - round(4 * u)
            bx, by = self._frame(w, h, warn=kind == "warn")
            self._draw_lines(bx + pad, by + pad, lines)
        elif kind == "idle":
            lh = self.f_body.metrics("linespace")
            w = max(self.f_lbl.measure(b["title"].upper()), self.f_body.measure(b["sub"])) + 2 * pad
            h = self.f_lbl.metrics("linespace") + lh + 2 * pad
            bx, by = self._frame(max(w, round(150 * u)), h)
            self._text(bx + pad, by + pad, b["title"].upper(), self.f_lbl, C["ink"])
            self._text(bx + pad, by + pad + self.f_lbl.metrics("linespace") + round(2 * u), b["sub"], self.f_body, C["muted"])
        elif kind == "thinking":
            cell = round(11 * u)
            w = max(self.f_body.measure(b["label"]) + 2 * pad, 3 * cell + 2 * round(4 * u) + 2 * pad)
            h = cell + self.f_body.metrics("linespace") + 2 * pad
            bx, by = self._frame(w, h)
            for i in range(3):
                self._rect(bx + pad + i * (cell + round(4 * u)), by + pad, bx + pad + i * (cell + round(4 * u)) + cell,
                           by + pad + cell, C["caution"] if i < b["cells"] else C["hair"])
            self._text(bx + pad, by + pad + cell + round(6 * u), b["label"], self.f_body, C["muted"])
        elif kind == "countdown":
            size = 22 * max(2, round(2 * u))
            w, h = round(120 * u), size + self.f_lbl.metrics("linespace") + 2 * pad
            bx, by = self._frame(w, h)
            self._display(bx + w / 2, by + pad - round(2 * u), str(b["n"]), size, "n")
            self._text(bx + w / 2, by + pad + size + round(6 * u), b["label"].upper(), self.f_lbl, C["muted"], "n")
        elif kind == "offer":
            lines, tw = self._wrap(b.get("bold", ""), b.get("rest", ""), maxtext)
            lh = self.f_body.metrics("linespace") + round(4 * u)
            led_w = 10 * round(11 * u) + 9 * max(3, round(4 * u))
            w = max(tw, led_w, self.f_small.measure(b["hint"])) + 2 * pad
            h = len(lines) * lh + round(12 * u) + round(11 * u) + round(8 * u) + self.f_small.metrics("linespace") + 2 * pad
            bx, by = self._frame(w, h)
            y = by + pad + self._draw_lines(bx + pad, by + pad, lines) + round(8 * u)
            self._led(bx + pad, y, b["lit"])
            self._text(bx + pad, y + round(11 * u) + round(8 * u), b["hint"], self.f_small, C["muted"])
        elif kind == "pairing":
            self._pairing(b)

    def _pairing(self, b: dict) -> None:
        u, pad = self.ui, round(10 * self.ui)
        mods = self._qr_cache.setdefault(b["uri"], modules(b["uri"]))
        n = len(mods)
        qp = max(3, round(3 * u))
        quiet = 3 * qp                                   # a quiet zone the phone camera can rely on
        plate = n * qp + 2 * quiet
        size = 22 * max(1, round(u))
        w = max(plate, self.f_small.measure("Scan with the Pit Pal app")) + 2 * pad
        h = size + round(8 * u) + plate + round(6 * u) + self.f_small.metrics("linespace") + 2 * pad
        bx, by = self._frame(w, h)
        self._display(bx + w / 2, by + pad - round(2 * u), "Scan me", size, "n")
        px, py = bx + (w - plate) / 2, by + pad + size + round(8 * u)
        self._rect(px, py, px + plate, py + plate, C["white"])
        for y, row in enumerate(mods):
            x = 0
            while x < n:                                 # merge runs: fewer, crisper rectangles
                if row[x]:
                    x0 = x
                    while x < n and row[x]:
                        x += 1
                    self._rect(px + quiet + x0 * qp, py + quiet + y * qp, px + quiet + x * qp, py + quiet + (y + 1) * qp, "#12141c")
                else:
                    x += 1
        self._text(bx + w / 2, py + plate + round(6 * u), "Scan with the Pit Pal app", self.f_small, C["muted"], "n")

    def _card(self, v) -> None:
        u, pad = self.ui, round(11 * self.ui)
        card = v.card
        rows = card["rows"]
        lh = self.f_small.metrics("linespace") + round(6 * u)
        mark = round(10 * u)
        text_w = max([self.f_bold.measure(card["title"])] + [self.f_small.measure(t) + mark + round(8 * u) for _, t in rows])
        w = min(self.bw_max, max(text_w, round(200 * u)) + 2 * pad)
        h = self.f_bold.metrics("linespace") + round(10 * u) + round(11 * u) + round(10 * u) + lh * len(rows) + 2 * pad
        bx, by = self._frame(w, h)
        self._text(bx + pad, by + pad, card["title"], self.f_bold, C["ink"])
        y = by + pad + self.f_bold.metrics("linespace") + round(10 * u)
        lit = round(10 * card["tries"] / max(1, card["max"])) if card["tries"] else 0
        self._led(bx + pad, y, lit)
        y += round(11 * u) + round(10 * u)
        for state, text in rows:
            col = C[state] if state in C else C["muted"]
            if state == "muted":
                self._plus_frame(bx + pad + 1, y + 2, mark - 2, mark - 2, 1, C["muted"])
            else:
                self._rect(bx + pad, y + 2, bx + pad + mark, y + 2 + mark, col)
            self._text(bx + pad + mark + round(8 * u), y, text, self.f_small, C["ink"])
            y += lh

    def _menu(self) -> None:
        u, pad = self.ui, round(10 * self.ui)
        phone = (self.model.health.get("inputs") or {}).get("pedal_mode") == "phone"
        items = [("m_qr", "Show pairing code"), ("m_new", "New pairing code"),
                 ("m_pedals", "Pedals: use Arduino" if phone else "Pedals: use phone"),
                 ("m_mute", "Mute / unmute voice"), ("m_card", "Details"), ("m_quit", "Quit Rev")]
        lh = self.f_body.metrics("linespace") + round(10 * u)
        w = max(self.f_body.measure(t) for _, t in items) + 2 * pad
        h = lh * len(items) + 2 * pad
        bx, by = self._frame(w, h)
        for i, (name, label) in enumerate(items):
            y = by + pad + i * lh
            if self.over == name:
                self._rect(bx + pad // 2, y, bx + w - pad // 2, y + lh, C["raised"])
            self._text(bx + pad, y + round(5 * u), label, self.f_body, C["accent"] if name == "m_quit" else C["ink"])
            self.regions.append((bx, y, bx + w, y + lh, name))

    # ---- the whole frame
    def _render(self, v, b: dict | None, dx: int, dy: int) -> None:
        self.c.delete("all")
        self.regions = []
        u = self.ui
        ground = self.H - self.margin - self.chip_h
        img = self.sprites.get(v.outfit)
        rx = (self.W - self.margin - self.rev_w) if self.side == "right" else self.margin
        rx += (self.rev_w - img.width()) // 2
        ry = ground - img.height()
        self._head_top, self._rev_left, self._rev_img_w = ry, rx, img.width()
        if self.hover and not self.menu:                  # Accept / Resume / Mute stack beside Rev
            names = v.actions
            labels = {"accept": "Accept", "resume": "Resume", "mute": "Unmute" if v.muted else "Mute"}
            kinds = {"accept": "primary", "resume": "quiet", "mute": "quiet"}
            bh, vgap = round(34 * u), round(16 * u)
            widths = [self.f_btn.measure(labels[n].upper()) + round(28 * u) for n in names]
            bw = max(widths)
            x = (rx - round(16 * u) - bw) if self.side == "right" else (rx + img.width() + round(16 * u))
            y = ground - len(names) * (bh + vgap) + vgap
            for n in names:
                self._button(x, y, bw, bh, labels[n].upper(), kinds[n], n)
                y += bh + vgap
        if self.menu:
            self._menu()
        elif self.expanded:
            self._card(v)
        elif b is not None:
            self._bubble(b)
        if not v.flash:
            self.c.create_image(rx + dx, ry + dy, image=img, anchor="nw")
            self.regions.append((rx, ry, rx + img.width(), ry + img.height(), "rev"))
        if v.chip:
            self._chip(v.chip, ground + round(8 * u))

    def _chip(self, chip: dict, y: int) -> None:
        u = self.ui
        w = self.f_lbl.measure(chip["label"]) + round(34 * u)
        h = self.chip_h - round(4 * u)
        x = (self.W - self.margin - self.rev_w / 2 - w / 2) if self.side == "right" else (self.margin + self.rev_w / 2 - w / 2)
        self._plus_frame(x, y, w, h, 1, C["edge"])
        self._rect(x, y, x + w, y + h, C["raised"])
        d = round(8 * u)
        self._rect(x + round(10 * u), y + (h - d) / 2, x + round(10 * u) + d, y + (h + d) / 2, C[chip["dot"]])
        self._text(x + round(24 * u), y + h / 2, chip["label"], self.f_lbl, C["ink"], "w")

    # ---- mouse
    def _hit(self, x: int, y: int) -> str | None:
        for x0, y0, x1, y1, name in reversed(self.regions):
            if x0 <= x < x1 and y0 <= y < y1:
                return name
        return None

    def _enter(self, e) -> None:
        self.hover, self.hover_at = True, time.monotonic()

    def _leave(self, e) -> None:
        # the see-through gaps between Rev and his buttons count as "leaving": hold the buttons a moment
        self.over, self.hover_at = None, time.monotonic()

    def _motion(self, e) -> None:
        self.hover, self.hover_at = True, time.monotonic()
        self.over = self._hit(e.x, e.y)

    def _press(self, e) -> None:
        self.pressed = self._hit(e.x, e.y)
        self._drag = {"x": e.x_root, "y": e.y_root, "wx": self.root.winfo_x(), "wy": self.root.winfo_y(), "moved": False}

    def _dragging(self, e) -> None:
        d = self._drag
        if d is None or self.pressed != "rev":
            return
        if abs(e.x_root - d["x"]) + abs(e.y_root - d["y"]) > 6:
            d["moved"] = True
        if d["moved"]:
            self._place(d["wx"] + e.x_root - d["x"], d["wy"] + e.y_root - d["y"])

    def _release(self, e) -> None:
        name, d = self.pressed, self._drag
        self.pressed, self._drag = None, None
        if name is None or self._hit(e.x, e.y) != name:
            return
        if name == "rev":
            if d and d["moved"]:
                self._snap()
            else:
                self.expanded, self.menu = not self.expanded, False
        elif name in ("accept", "resume"):
            self._send({"type": name})
        elif name == "mute":
            self._send({"type": "toggle_mute"})
        elif name.startswith("m_"):
            self.menu = False
            {"m_qr": lambda: self._qr_now(), "m_new": lambda: self._send({"type": "new_pairing"}),
             "m_pedals": lambda: self._send({"type": "pedal_source", "source": "toggle"}),
             "m_mute": lambda: self._send({"type": "toggle_mute"}), "m_card": lambda: setattr(self, "expanded", True),
             "m_quit": self.quit}[name]()

    def _right_click(self, e) -> None:
        if self._hit(e.x, e.y) == "rev":
            self.menu, self.menu_at, self.expanded = True, time.monotonic(), False

    def _send(self, msg: dict) -> None:
        if self.client:
            self.client.send(msg)

    def _qr_now(self) -> None:
        """Show the pairing code again, even for a phone that paired before."""
        m = self.model
        m.phone_ever_live = False
        m.first_health_at = time.monotonic() - 10
        self.expanded = False
