#!/usr/bin/env python3
"""Slice the Mise reference boards into individual screens and build
side-by-side composites against the captured app screenshots.

    python3 scripts/design-compare.py --shots docs/design/screenshots/before \
        --out docs/design/screenshots/compare

Reference panels are detected from the board background rather than
hardcoded, so re-exported boards keep working.
"""

import argparse
import os

from PIL import Image, ImageDraw

REFERENCE_DIR = "docs/design/references"

# The boards are hand-laid mockups, not a uniform grid — panel widths differ
# per column and the two rows of the primary board are at different scales.
# These bounds were measured off the supplied PNGs and verified by eye.
CLEAN_PANELS = {
    "01-home": (56, 4, 311, 551),
    "02-today": (373, 4, 690, 551),
    "03-inventory": (752, 4, 1031, 551),
    "04-orders": (1092, 4, 1381, 551),
    "05-task-detail": (56, 566, 311, 1018),
    "06-ask-mise": (373, 566, 690, 1018),
    "07-more": (752, 566, 1031, 1018),
    "08-settings": (1092, 566, 1381, 1018),
}
WARM_PANELS = {
    "ref2-today": (72, 88, 486, 946),
    "09-setup": (566, 88, 985, 946),
    "ref2-orders": (1060, 88, 1479, 946),
}


def scale_to_height(image, height):
    width = max(1, round(image.width * height / image.height))
    return image.resize((width, height), Image.LANCZOS)


def compose(reference, shot, title, path):
    height = 1100
    gap, pad, header = 28, 24, 52
    left = scale_to_height(reference, height)
    right = scale_to_height(shot, height)

    width = pad * 2 + left.width + gap + right.width
    canvas = Image.new("RGB", (width, header + height + pad + 26), "#FFFFFF")
    draw = ImageDraw.Draw(canvas)
    draw.text((pad, 16), f"{title}    REFERENCE  |  MISE (current)", fill="#171715")

    canvas.paste(left, (pad, header))
    canvas.paste(right, (pad + left.width + gap, header))
    draw.line(
        [(pad + left.width + gap // 2, header), (pad + left.width + gap // 2, header + height)],
        fill="#D6D1C9",
        width=2,
    )
    draw.text((pad, header + height + 6), "reference", fill="#6A6965")
    draw.text((pad + left.width + gap, header + height + 6), "current build", fill="#6A6965")
    canvas.save(path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--shots", default="docs/design/screenshots/current")
    parser.add_argument("--out", default="docs/design/screenshots/compare")
    parser.add_argument("--slice-only", action="store_true")
    args = parser.parse_args()

    sliced_dir = os.path.join(REFERENCE_DIR, "screens")
    os.makedirs(sliced_dir, exist_ok=True)
    os.makedirs(args.out, exist_ok=True)

    saved = {}
    for board, layout in (("ui-clean-mobile.png", CLEAN_PANELS), ("ui-warm-mobile.png", WARM_PANELS)):
        image = Image.open(os.path.join(REFERENCE_DIR, board)).convert("RGB")
        for name, box in layout.items():
            crop = image.crop(box)
            crop.save(os.path.join(sliced_dir, f"{name}.png"))
            saved.setdefault(name, crop)
            print(f"reference {name}: {crop.size}")

    if args.slice_only:
        return

    for name, reference in saved.items():
        shot_path = os.path.join(args.shots, f"{name}.png")
        if not os.path.exists(shot_path):
            continue
        compose(reference, Image.open(shot_path).convert("RGB"), name, os.path.join(args.out, f"{name}.png"))
        print(f"composite {name}")


if __name__ == "__main__":
    main()
