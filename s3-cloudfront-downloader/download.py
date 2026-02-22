#!/usr/bin/env python3
"""
hakataarchive S3 → CloudFront downloader

Downloads all objects from s3://hakataarchive via CloudFront CDN
to /mnt/cache/hakataarchive/. Resumable: re-run safely.

- Files at ~/Images/hakataarchive/twitter/ are copied locally
  (no CloudFront transfer cost) instead of re-downloading.
- Stops automatically if cumulative CloudFront transfer >= 500 GiB.
- Delete s3_file_list.tsv to force a fresh S3 listing.
- Delete cf_transferred_bytes.txt to reset the transfer counter.
"""

import os
import shutil
import subprocess
import sys
import urllib.parse
from pathlib import Path
from datetime import datetime

# ── Configuration ────────────────────────────────────────────────
BUCKET = "hakataarchive"
CF_DOMAIN = "d2xfumxn08rkz3.cloudfront.net"
DEST_DIR = Path("/mnt/cache/hakataarchive")
TWITTER_LOCAL = Path.home() / "Images" / "hakataarchive" / "twitter"
MAX_CF_BYTES = 500 * 1024 * 1024 * 1024  # 500 GiB

SCRIPT_DIR = Path(__file__).parent.resolve()
FILE_LIST = SCRIPT_DIR / "s3_file_list.tsv"
COUNTER_FILE = SCRIPT_DIR / "cf_transferred_bytes.txt"
LOG_FILE = SCRIPT_DIR / "download.log"

# ── Helpers ──────────────────────────────────────────────────────
def log(msg: str) -> None:
    line = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line)
    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(line + "\n")

def human_bytes(n: int) -> str:
    for unit in ("B", "KiB", "MiB", "GiB", "TiB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} PiB"

def load_counter() -> int:
    if COUNTER_FILE.exists():
        return int(COUNTER_FILE.read_text().strip())
    return 0

def save_counter(value: int) -> None:
    COUNTER_FILE.write_text(str(value))

# ── S3 file list ─────────────────────────────────────────────────
def build_file_list() -> None:
    """Fetch S3 object list and save as TSV: size\tencoded_key\toriginal_key"""
    log(f"Fetching S3 object list from s3://{BUCKET}/ …")
    result = subprocess.run(
        ["aws", "s3", "ls", f"s3://{BUCKET}/", "--recursive"],
        capture_output=True, text=True, encoding="utf-8"
    )
    if result.returncode != 0:
        log(f"ERROR: aws s3 ls failed:\n{result.stderr}")
        sys.exit(1)

    count = 0
    with FILE_LIST.open("w", encoding="utf-8") as f:
        for line in result.stdout.splitlines():
            parts = line.split(None, 3)
            if len(parts) < 4:
                continue
            size = parts[2]
            key = parts[3]
            encoded = urllib.parse.quote(key, safe="/")
            f.write(f"{size}\t{encoded}\t{key}\n")
            count += 1
    log(f"Saved {count} entries to {FILE_LIST}")

def load_file_list() -> list[tuple[int, str, str]]:
    """Return list of (size, encoded_key, original_key)."""
    entries = []
    with FILE_LIST.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line:
                continue
            parts = line.split("\t", 2)
            if len(parts) != 3:
                continue
            size, encoded_key, key = parts
            entries.append((int(size), encoded_key, key))
    return entries

# ── Download via curl ─────────────────────────────────────────────
def curl_download(url: str, dest: Path) -> bool:
    """Download url to dest using curl. Returns True on success."""
    tmp = Path(str(dest) + ".tmp")
    result = subprocess.run(
        [
            "curl",
            "--fail",
            "--silent",
            "--show-error",
            "--location",
            "--retry", "5",
            "--retry-delay", "10",
            "--retry-max-time", "300",
            "--connect-timeout", "30",
            "--max-time", "3600",
            "-o", str(tmp),
            url,
        ],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        log(f"ERROR curl exited {result.returncode}: {result.stderr.strip()}")
        tmp.unlink(missing_ok=True)
        return False
    return True

# ── Main ─────────────────────────────────────────────────────────
def main() -> None:
    DEST_DIR.mkdir(parents=True, exist_ok=True)

    total_cf_bytes = load_counter()

    log("=== hakataarchive downloader started ===")
    log(f"  Destination    : {DEST_DIR}")
    log(f"  CloudFront     : {CF_DOMAIN}")
    log(f"  Twitter cache  : {TWITTER_LOCAL}")
    log(f"  CF transferred : {human_bytes(total_cf_bytes)} / {human_bytes(MAX_CF_BYTES)}")

    # Build file list if not cached
    if not FILE_LIST.exists():
        build_file_list()

    entries = load_file_list()
    total_files = len(entries)
    log(f"Total S3 objects: {total_files}")

    skipped = copied = downloaded = errors = 0

    for i, (size, encoded_key, key) in enumerate(entries, 1):
        dest_file = DEST_DIR / key

        # ── Already complete? ──
        if dest_file.exists() and dest_file.stat().st_size == size:
            skipped += 1
            if skipped % 5000 == 0:
                log(f"Skipped {skipped} files so far…")
            continue

        # ── Transfer cap check ──
        if total_cf_bytes >= MAX_CF_BYTES:
            log(f"⚠ CloudFront transfer cap reached ({human_bytes(total_cf_bytes)}). Stopping.")
            break

        # ── Twitter: try local cache first (no CF cost) ──
        if key.startswith("twitter/"):
            rel = key[len("twitter/"):]
            local_src = TWITTER_LOCAL / rel
            if local_src.exists() and local_src.stat().st_size == size:
                dest_file.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(str(local_src), str(dest_file))
                copied += 1
                log(f"[{i}/{total_files}] COPY  {key}")
                continue

        # ── Download from CloudFront ──
        cf_url = f"https://{CF_DOMAIN}/{encoded_key}"
        dest_file.parent.mkdir(parents=True, exist_ok=True)
        tmp_file = Path(str(dest_file) + ".tmp")

        if curl_download(cf_url, dest_file):
            if tmp_file.exists() and tmp_file.stat().st_size == size:
                tmp_file.rename(dest_file)
                total_cf_bytes += size
                save_counter(total_cf_bytes)
                downloaded += 1
                log(f"[{i}/{total_files}] DL    {key}  ({human_bytes(size)}, CF total: {human_bytes(total_cf_bytes)})")
            else:
                actual = tmp_file.stat().st_size if tmp_file.exists() else 0
                log(f"ERROR size mismatch {key}: expected {size}, got {actual}")
                tmp_file.unlink(missing_ok=True)
                errors += 1
        else:
            log(f"ERROR failed to download: {cf_url}")
            errors += 1

    log("=== Summary ===")
    log(f"  Total objects          : {total_files}")
    log(f"  Skipped (already done) : {skipped}")
    log(f"  Copied  (local cache)  : {copied}")
    log(f"  Downloaded (CF)        : {downloaded}")
    log(f"  Errors                 : {errors}")
    log(f"  CF transfer total      : {human_bytes(total_cf_bytes)}")
    log("=== Done ===")


if __name__ == "__main__":
    main()
