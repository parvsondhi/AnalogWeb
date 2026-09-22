#!/usr/bin/env python3
"""Draw the toolbar icon: an indigo tile with a cream handwritten Aa."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "icons"
TTF = Path("/tmp/handink-dancing.ttf")
SIZES = (16, 32, 48, 128)


def draw(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    pad = max(0, round(size * 0.04))
    radius = max(2, round(size * 0.22))
    draw.rounded_rectangle(
        [pad, pad, size - 1 - pad, size - 1 - pad],
        radius=radius,
        fill=(36, 48, 110, 255),
    )
    font = ImageFont.truetype(str(TTF), size=int(size * 0.5))
    # Script swashes sit high; nudge the word down so the tile doesn't crop it.
    draw.text((size / 2, size * 0.56), "Aa", font=font, fill=(247, 243, 234, 255), anchor="mm")
    return image


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        image = draw(size)
        image.save(OUT / f"icon{size}.png")
        print(f"wrote icon{size}.png")


if __name__ == "__main__":
    main()
