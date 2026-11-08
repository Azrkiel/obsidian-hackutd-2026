"""Rev's overlay sprites: 1 pixel per art pixel, so the overlay can zoom by whole numbers.

The design system ships Rev at 14x (src/). The overlay draws on a colour-keyed window, where a
half-transparent pixel would show as a muddy fringe, so the soft ground shadow is dropped and every
sprite is cropped to its opaque pixels. Nothing is smoothed or recoloured.

    uv run --no-project --with pillow python pitpal/tools/make_sprites.py
"""
from pathlib import Path

from PIL import Image

CELL = 14
ASSETS = Path(__file__).resolve().parent.parent / "assets" / "rev"


def reduce(src: Path, dst: Path) -> tuple[int, int]:
    im = Image.open(src).convert("RGBA")
    w, h = im.size[0] // CELL, im.size[1] // CELL
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for y in range(h):
        for x in range(w):
            p = im.getpixel((x * CELL + CELL // 2, y * CELL + CELL // 2))
            if p[3] == 255:
                out.putpixel((x, y), p)
    out = out.crop(out.getchannel("A").getbbox())
    out.save(dst)
    return out.size


if __name__ == "__main__":
    for f in sorted((ASSETS / "src").glob("rev_*.png")):
        print(f.name, reduce(f, ASSETS / f.name))
