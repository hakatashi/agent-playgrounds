# Esolangs Category Query

Queries the [esolangs.org](https://esolangs.org) MediaWiki API to find pages that belong to the intersection of two categories.

## Purpose

The default configuration finds all esoteric programming languages that are both tagged as created in 2025 (`Category:2025`) and confirmed to be implemented (`Category:Implemented`).

## Prerequisites

- Python 3.6+
- No third-party packages required (uses `urllib` from the standard library)

## How to Run

```bash
python3 query.py
```

Results are printed to stdout and also saved to `result.txt` in the same directory.

## Configuration

Edit the `get_category_intersection()` call in `query.py` to query different category pairs:

```python
pages = get_category_intersection(cat1="Category:2025", cat2="Category:Implemented")
```
