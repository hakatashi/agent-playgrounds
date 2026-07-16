#!/usr/bin/env python3
"""Crop all raw frames to the union bounding box of visible (non-transparent)
pixels across the whole animation loop, with a small padding margin, so the
exported video is tightly trimmed around the animated watermark."""
import os
import sys
from PIL import Image

FPS = int(os.environ.get("FPS", "30"))
RAW_DIR = os.path.join(os.path.dirname(__file__), f"frames_raw_{FPS}fps")
OUT_DIR = os.path.join(os.path.dirname(__file__), f"frames_{FPS}fps")
ALPHA_THRESHOLD = 4  # ignore near-invisible anti-aliasing fringe
PADDING = 12  # px, at capture resolution (2x CSS px)

def union_bbox():
    files = sorted(f for f in os.listdir(RAW_DIR) if f.endswith(".png"))
    if not files:
        sys.exit(f"no frames found in {RAW_DIR}/")
    min_x = min_y = None
    max_x = max_y = None
    size = None
    for name in files:
        im = Image.open(os.path.join(RAW_DIR, name))
        size = im.size
        alpha = im.getchannel("A")
        bbox = alpha.point(lambda p: 255 if p > ALPHA_THRESHOLD else 0).getbbox()
        if bbox is None:
            continue
        x0, y0, x1, y1 = bbox
        min_x = x0 if min_x is None else min(min_x, x0)
        min_y = y0 if min_y is None else min(min_y, y0)
        max_x = x1 if max_x is None else max(max_x, x1)
        max_y = y1 if max_y is None else max(max_y, y1)
    return files, size, (min_x, min_y, max_x, max_y)

def main():
    files, size, (min_x, min_y, max_x, max_y) = union_bbox()
    w, h = size
    min_x = max(0, min_x - PADDING)
    min_y = max(0, min_y - PADDING)
    max_x = min(w, max_x + PADDING)
    max_y = min(h, max_y + PADDING)
    # VP9 requires even width/height for yuv420-family pixel formats.
    crop_w = max_x - min_x
    crop_h = max_y - min_y
    if crop_w % 2:
        max_x = min(w, max_x + 1)
        crop_w += 1
    if crop_h % 2:
        max_y = min(h, max_y + 1)
        crop_h += 1
    print(f"source size: {w}x{h}")
    print(f"union bbox (padded, even): ({min_x},{min_y})-({max_x},{max_y}) -> {crop_w}x{crop_h}")

    os.makedirs(OUT_DIR, exist_ok=True)
    for name in files:
        im = Image.open(os.path.join(RAW_DIR, name))
        cropped = im.crop((min_x, min_y, max_x, max_y))
        cropped.save(os.path.join(OUT_DIR, name))
    print(f"wrote {len(files)} cropped frames to {OUT_DIR}")

if __name__ == "__main__":
    main()
