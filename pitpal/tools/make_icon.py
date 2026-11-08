"""Build the Windows icon (pitpal.ico) for the Pit Pal shortcut from the design system's monogram.

The design system ships `icon-pit-pal-monogram` (the P on red) at 512 and 32 px. Pixel art is scaled
nearest-neighbour only, like Rev's sprites; the 32 px size uses the designers' own 32 px export.

    uv run --no-project --with pillow python pitpal/tools/make_icon.py
"""
from pathlib import Path

from PIL import Image

ICON = Path(__file__).resolve().parent.parent / "assets" / "icon"
SIZES = (16, 24, 32, 48, 64, 128, 256)

if __name__ == "__main__":
    big = Image.open(ICON / "icon-pit-pal-monogram-512.png").convert("RGBA")
    own32 = Image.open(ICON / "icon-pit-pal-monogram-32.png").convert("RGBA")
    frames = [own32 if s == 32 else big.resize((s, s), Image.NEAREST) for s in SIZES]
    out = ICON / "pitpal.ico"
    frames[-1].save(out, format="ICO", sizes=[(s, s) for s in SIZES], append_images=frames[:-1])
    print(out, out.stat().st_size, "bytes", SIZES)
