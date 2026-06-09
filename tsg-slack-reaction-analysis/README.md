# TSG Slack Reaction Analysis

Analyzes who gave what emoji reactions in the TSG Slack workspace across the full history of Slack export archives, and generates an HTML report.

## Purpose

Downloads multiple overlapping Slack export ZIP files from Google Drive, deduplicates messages across archives, and produces a ranked HTML report of:

- Which users gave the most reactions
- Which emoji each user used most often
- Monthly reaction activity over time

## Prerequisites

- Python 3.10+
- `gcloud` CLI authenticated (`gcloud auth login`)
- `requests` library (`pip install requests`)

## How to Run

```bash
cd tsg-slack-reaction-analysis
python3 -m venv venv
venv/bin/pip install requests
venv/bin/python3 analyze.py
```

The script downloads the Slack export ZIPs into `data/downloads/` (excluded from git) and writes `report.html` (also excluded from git) when finished.

Open `report.html` in a browser to view the results.

## Notes

- Already-downloaded ZIPs are skipped on subsequent runs.
- The script covers Apr 2015 – May 2026 using six overlapping export files.
