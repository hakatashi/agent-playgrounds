#!/usr/bin/env python3
"""Overlay semi-transparent polygons on p1.png to verify AI-detected manga panel coordinates."""

from PIL import Image, ImageDraw
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMG_PATH = os.path.join(BASE_DIR, "p1.png")

# Actual image size: 2223 x 3109
img_base = Image.open(IMG_PATH)
ACTUAL_W, ACTUAL_H = img_base.size

# Colors for each panel (RGBA, semi-transparent)
COLORS = [
    (255, 0, 0, 80),      # red
    (0, 255, 0, 80),      # green
    (0, 0, 255, 80),      # blue
    (255, 255, 0, 80),    # yellow
    (255, 0, 255, 80),    # magenta
]

# Each AI's results: (name, assumed_width, assumed_height, list of polygon coordinate lists)
ai_results = {
    "chatgpt": {
        "assumed_size": (1464, 2048),
        "panels": [
            [(0, 0), (1464, 0), (1464, 1080), (0, 1080)],
            [(0, 1080), (980, 1080), (980, 2048), (0, 2048)],
            [(980, 1080), (1464, 1080), (1464, 1580), (980, 1580)],
            [(980, 1580), (1464, 1580), (1464, 2048), (980, 2048)],
        ],
    },
    "claude": {
        "assumed_size": (1430, 2000),
        "panels": [
            [(0, 0), (1430, 0), (1430, 710), (0, 710)],
            [(0, 710), (538, 710), (538, 2000), (0, 2000)],
            [(538, 710), (1430, 710), (1430, 2000), (538, 2000)],
        ],
    },
    "gemini": {
        "assumed_size": (732, 1024),
        "panels": [
            [(0, 0), (555, 0), (555, 565), (0, 565)],
            [(565, 0), (732, 0), (732, 395), (565, 395)],
            [(0, 575), (425, 575), (425, 1024), (0, 1024)],
            [(435, 575), (732, 575), (732, 695), (435, 695)],
            [(435, 705), (732, 705), (732, 1024), (435, 1024)],
        ],
    },
    "qwen": {
        "assumed_size": (1200, 1600),
        "panels": [
            [(0, 0), (1000, 0), (1000, 800), (0, 800)],
            [(1000, 0), (1200, 0), (1200, 800), (1000, 800)],
            [(0, 800), (800, 800), (800, 1600), (0, 1600)],
            [(800, 800), (1200, 800), (1200, 1200), (800, 1200)],
            [(800, 1200), (1200, 1200), (1200, 1600), (800, 1600)],
        ],
    },
}


def scale_polygon(polygon, assumed_w, assumed_h, actual_w, actual_h):
    """Scale polygon coordinates from assumed image size to actual image size."""
    sx = actual_w / assumed_w
    sy = actual_h / assumed_h
    return [(int(x * sx), int(y * sy)) for x, y in polygon]


for ai_name, data in ai_results.items():
    img = img_base.copy().convert("RGBA")
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    assumed_w, assumed_h = data["assumed_size"]

    for i, panel in enumerate(data["panels"]):
        scaled = scale_polygon(panel, assumed_w, assumed_h, ACTUAL_W, ACTUAL_H)
        color = COLORS[i % len(COLORS)]
        draw.polygon(scaled, fill=color, outline=(color[0], color[1], color[2], 200))

    result = Image.alpha_composite(img, overlay)
    out_path = os.path.join(BASE_DIR, f"overlay-{ai_name}-p1.png")
    result.save(out_path)
    print(f"Saved: {out_path}")

print("Done.")
