# unicode-emoji-enumeration

Enumerate and catalog every emoji defined in the Unicode standard (Emoji 17.0 / Unicode 17.0) by parsing the official Unicode data files.

## Overview

`enumerate-emoji.mjs` fetches the canonical Unicode emoji data files directly from unicode.org and builds a comprehensive JSON database that covers:

- Basic emoji characters
- Emoji with modifier bases (skin-tone variants)
- Keycap sequences (`#️⃣`, `1️⃣`, …)
- Regional indicator flag sequences (`🇯🇵`, `🇺🇸`, …)
- ZWJ sequences (`👨‍💻`, `🏳️‍🌈`, …)
- Variation sequences (text vs. emoji presentation)

`random-emoji.mjs` selects and prints a random emoji from the generated database.

## Prerequisites

- Node.js 18+ (uses the built-in `fetch` API)

No npm packages are required.

## Usage

Generate `emoji.json`:

```sh
node enumerate-emoji.mjs
```

Print a random emoji:

```sh
node random-emoji.mjs
```

## Output

`emoji.json` is an array of emoji objects. Each entry includes at minimum the emoji string and its Unicode sequence. The file is excluded from version control; regenerate it by running the script.

## Data Sources

The script fetches the following files from `unicode.org`:

- `emoji-data.txt`
- `emoji-sequences.txt`
- `emoji-zwj-sequences.txt`
- `emoji-test.txt`
- `emoji-variation-sequences.txt`
