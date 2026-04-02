# chise-ids-search

Analyze and visualize CJK (Chinese-Japanese-Korean) character decomposition using the [CHISE IDS database](https://github.com/cjkvi/cjkvi-ids).

## Overview

This toolkit searches the CHISE Ideographic Description Sequences (IDS) database to find kanji/hanzi characters that share specific structural components, then downloads their glyph images from GlyphWiki and renders them into PNG grids.

## Prerequisites

- Python 3.x
- Git (to initialize the `ids-data` submodule)

Initialize the IDS data submodule:

```sh
git submodule update --init ids-data
```

Install Python dependencies:

```sh
python3 -m venv venv
venv/bin/pip install playwright cairosvg Pillow
venv/bin/playwright install chromium
```

## Scripts

### `search_recursive.py`

Recursively searches the IDS database for all kanji that contain a given component (e.g., 水/氵) two or more times.

```sh
venv/bin/python3 search_recursive.py
```

### `search_aba.py`

Identifies "ABA-type" kanji — characters whose left and right radicals are identical (e.g., ⿲A B A patterns).

```sh
venv/bin/python3 search_aba.py
```

### `search_multi_targets.py`

Searches for kanji containing multiple specified target components simultaneously.

```sh
venv/bin/python3 search_multi_targets.py
```

### `fetch_svgs.py`

Downloads SVG glyph images from GlyphWiki for a given list of kanji using Playwright.

```sh
venv/bin/python3 fetch_svgs.py
```

### `make_grid.py` / `make_grid_2x2.py`

Converts downloaded SVG glyphs into a PNG grid image (5×5 or 2×2 layout).

```sh
venv/bin/python3 make_grid.py
venv/bin/python3 make_grid_2x2.py
```

## Data

The `ids-data/` directory is a Git submodule pointing to the CHISE IDS database. It contains `IDS-*.txt` files describing how each CJK unified ideograph decomposes into its constituent components using Unicode Ideographic Description Characters (IDCs).
