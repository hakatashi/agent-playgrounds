# wuwa-story-fetcher

Fetch and export storyline data from *Wuthering Waves* (鳴潮) as Markdown documents.

## Overview

These scripts retrieve story data from an unofficial Wuthering Waves API, clean up in-game markup tags, format dialogue with speaker names and branch choices, and write each story as a self-contained Markdown file.

## Prerequisites

- Python 3.x

No third-party packages are required; the scripts use only the standard library (`urllib`, `json`).

## Usage

Fetch a single story by ID:

```sh
python3 fetch_story.py
```

Batch-download all available main stories (IDs 100001–100038):

```sh
python3 download_all.py
```

`download_all.py` waits 0.5 s between requests and silently skips story IDs that return no data.

## Output

Each story is written to a separate Markdown file (e.g., `story_100001.md`). The files contain:

- Chapter and section headings
- Dialogue lines prefixed with the speaker's name
- Player-choice branches
- Unlock condition notes (where present)

> **Note:** Generated Markdown files are excluded from version control.

## API

Data is sourced from `https://api-v2.encore.moe/api/ja/story/{id}` (Japanese locale).
