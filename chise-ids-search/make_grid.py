#!/usr/bin/env python3
"""
GlyphWiki から漢字SVGを取得し、5x5グリッドのPNGを生成する
"""

import os
import cairosvg
from PIL import Image, ImageDraw, ImageFont
import io

KANJI = '㳲 㴢 㴣 㴺 㵈 㵉 㵜 㵪 㶂 㶃 㶙 㶝 𣴘 𣿬 𤂕 𤄃 𥶎 𪷳 𭳣 𭳭 𱨸 𲪱 𲫁'.split()

CELL_SIZE = 120       # 各セルのピクセル数
GLYPH_SIZE = 96       # グリフの描画サイズ
PADDING = (CELL_SIZE - GLYPH_SIZE) // 2
COLS = 5
BG_COLOR = (255, 255, 255)
BORDER_COLOR = (220, 220, 220)
LABEL_COLOR = (120, 120, 120)

CACHE_DIR = 'svg_cache'
os.makedirs(CACHE_DIR, exist_ok=True)

def get_glyph_name(char):
    """GlyphWikiのグリフ名を生成 (例: u32ac1)"""
    cp = ord(char)
    return f'u{cp:x}'

def fetch_svg(char):
    """キャッシュ済みSVGを読み込む"""
    name = get_glyph_name(char)
    cache_path = os.path.join(CACHE_DIR, f'{name}.svg')
    with open(cache_path, 'rb') as f:
        return f.read()

def svg_to_image(svg_data, size):
    """SVGバイト列をPIL Imageに変換"""
    png_data = cairosvg.svg2png(bytestring=svg_data, output_width=size, output_height=size)
    img = Image.open(io.BytesIO(png_data)).convert('RGBA')
    # 白背景に合成
    bg = Image.new('RGBA', img.size, (255, 255, 255, 255))
    bg.paste(img, mask=img.split()[3])
    return bg.convert('RGB')

def main():
    rows = (len(KANJI) + COLS - 1) // COLS
    W = COLS * CELL_SIZE
    H = rows * CELL_SIZE

    canvas = Image.new('RGB', (W, H), BG_COLOR)
    draw = ImageDraw.Draw(canvas)

    # グリッド線
    for x in range(0, W + 1, CELL_SIZE):
        draw.line([(x, 0), (x, H)], fill=BORDER_COLOR, width=1)
    for y in range(0, H + 1, CELL_SIZE):
        draw.line([(0, y), (W, y)], fill=BORDER_COLOR, width=1)

    for i, char in enumerate(KANJI):
        col = i % COLS
        row = i // COLS
        x = col * CELL_SIZE
        y = row * CELL_SIZE

        print(f'[{i+1:2d}/{len(KANJI)}] {char} (U+{ord(char):04X})')
        try:
            svg_data = fetch_svg(char)
            glyph_img = svg_to_image(svg_data, GLYPH_SIZE)
            canvas.paste(glyph_img, (x + PADDING, y + PADDING))
        except Exception as e:
            print(f'  ERROR: {e}')
            # エラー時はXを描画
            draw.line([(x+4, y+4), (x+CELL_SIZE-4, y+CELL_SIZE-4)], fill=(200,80,80), width=2)
            draw.line([(x+CELL_SIZE-4, y+4), (x+4, y+CELL_SIZE-4)], fill=(200,80,80), width=2)

    out_path = 'kanji_grid.png'
    canvas.save(out_path)
    print(f'\n保存しました: {out_path}  ({W}x{H}px)')

if __name__ == '__main__':
    main()
