# colorize-manga-cells

A visual comparison tool that overlays AI-detected manga panel boundaries from multiple models onto the same source image.

## Overview

This project tests how well different AI vision models (ChatGPT, Claude, Gemini, Qwen) can identify panel boundaries in a manga page. Each model's predicted coordinates are scaled to the actual image dimensions and rendered as semi-transparent colored overlays, making it easy to compare their accuracy side by side.

## Prerequisites

- Python 3.x

Install dependencies:

```sh
python3 -m venv venv
venv/bin/pip install Pillow
```

## Usage

```sh
venv/bin/python3 overlay.py
```

The script reads panel coordinate predictions from `*-p1.txt` files (one per AI model) and the source manga image `p1.png`, then writes an overlay image for each model.

## Files

| File | Description |
|------|-------------|
| `p1.png` | Source manga page (2223 × 3109 px) |
| `chatgpt-p1.txt` | ChatGPT panel coordinate predictions |
| `claude-p1.txt` | Claude panel coordinate predictions |
| `gemini-p1.txt` | Gemini panel coordinate predictions |
| `qwen-p1.txt` | Qwen panel coordinate predictions |
| `overlay-*.png` | Output images with colored overlays per model |

## Output

Each output image shows the source manga page with semi-transparent colored rectangles marking the panels detected by that model, allowing direct visual comparison of each AI's spatial understanding.
