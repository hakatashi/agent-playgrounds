#!/usr/bin/env python3
"""
4文字を2x2グリッドのPNGに配置する
"""

import os
import io
import cairosvg
from PIL import Image, ImageDraw

KANJI = ['𢕩', '𡨫', '𫳄', '𦼉']
CELL_SIZE = 200
GLYPH_SIZE = 160
PADDING = (CELL_SIZE - GLYPH_SIZE) // 2
BG_COLOR = (255, 255, 255)
BORDER_COLOR = (200, 200, 200)
CACHE_DIR = 'svg_cache'

def get_glyph_name(char):
    return f'u{ord(char):x}'

def load_svg(char):
    path = os.path.join(CACHE_DIR, f'{get_glyph_name(char)}.svg')
    with open(path, 'rb') as f:
        return f.read()

def svg_to_image(svg_data, size):
    png_data = cairosvg.svg2png(bytestring=svg_data, output_width=size, output_height=size)
    img = Image.open(io.BytesIO(png_data)).convert('RGBA')
    bg = Image.new('RGBA', img.size, (255, 255, 255, 255))
    bg.paste(img, mask=img.split()[3])
    return bg.convert('RGB')

def main():
    W = H = CELL_SIZE * 2
    canvas = Image.new('RGB', (W, H), BG_COLOR)
    draw = ImageDraw.Draw(canvas)

    for x in range(0, W + 1, CELL_SIZE):
        draw.line([(x, 0), (x, H)], fill=BORDER_COLOR, width=1)
    for y in range(0, H + 1, CELL_SIZE):
        draw.line([(0, y), (W, y)], fill=BORDER_COLOR, width=1)

    for i, char in enumerate(KANJI):
        col, row = i % 2, i // 2
        x, y = col * CELL_SIZE, row * CELL_SIZE
        print(f'{char} (U+{ord(char):04X})')
        svg_data = load_svg(char)
        glyph_img = svg_to_image(svg_data, GLYPH_SIZE)
        canvas.paste(glyph_img, (x + PADDING, y + PADDING))

    out_path = 'kanji_grid_2x2.png'
    canvas.save(out_path)
    print(f'\n保存しました: {out_path}  ({W}x{H}px)')

if __name__ == '__main__':
    main()
