#!/usr/bin/env python3
"""
Playwright を使用して GlyphWiki から SVG を取得する
"""

import os
import time
import asyncio
from playwright.async_api import async_playwright

KANJI = '㳲 㴢 㴣 㴺 㵈 㵉 㵜 㵪 㶂 㶃 㶙 㶝 𣴘 𣿬 𤂕 𤄃 𥶎 𪷳 𭳣 𭳭 𱨸 𲪱 𲫁'.split()
CACHE_DIR = 'svg_cache'
os.makedirs(CACHE_DIR, exist_ok=True)

def get_glyph_name(char):
    return f'u{ord(char):x}'

async def fetch_all():
    missing = []
    for char in KANJI:
        name = get_glyph_name(char)
        cache_path = os.path.join(CACHE_DIR, f'{name}.svg')
        if not os.path.exists(cache_path):
            missing.append(char)

    if not missing:
        print('All SVGs already cached.')
        return

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = await context.new_page()

        for char in missing:
            name = get_glyph_name(char)
            cache_path = os.path.join(CACHE_DIR, f'{name}.svg')
            url = f'https://glyphwiki.org/glyph/{name}.svg'
            print(f'  Fetching {char} ({name}) ...')
            try:
                response = await page.goto(url, wait_until='networkidle', timeout=30000)
                content = await response.body()
                if b'<svg' in content:
                    with open(cache_path, 'wb') as f:
                        f.write(content)
                    print(f'    OK ({len(content)} bytes)')
                else:
                    print(f'    WARN: not SVG ({content[:80]})')
                await asyncio.sleep(0.5)
            except Exception as e:
                print(f'    ERROR: {e}')

        await browser.close()

if __name__ == '__main__':
    asyncio.run(fetch_all())
    cached = [f for f in os.listdir(CACHE_DIR) if f.endswith('.svg')]
    print(f'\nCached: {len(cached)}/{len(KANJI)} SVGs')
