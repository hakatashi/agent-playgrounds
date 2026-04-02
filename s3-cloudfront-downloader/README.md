# s3-cloudfront-downloader

Download all objects from an S3 bucket via CloudFront CDN with smart local caching, resumability, and a bandwidth cap.

## Overview

`download.py` fetches the full object listing from an S3 bucket using the AWS CLI, then downloads each file through a CloudFront distribution. It keeps a running total of transferred bytes and stops before exceeding a configurable CloudFront data-transfer limit to control costs. Already-downloaded files are skipped automatically, making interrupted runs safe to restart.

A local Twitter media cache is also integrated: if the file already exists in a local directory, it is copied instead of downloaded.

## Prerequisites

- Python 3.x
- AWS CLI configured with appropriate credentials (`aws s3 ls` must work)
- `curl` available in `PATH`

No Python packages beyond the standard library are required.

## Usage

```sh
python3 download.py
```

On first run the script populates `s3_file_list.tsv` with the bucket contents. Subsequent runs reuse the cached list.

## Configuration

Edit the constants at the top of `download.py`:

| Constant | Default | Description |
|----------|---------|-------------|
| `BUCKET` | `hakataarchive` | S3 bucket name |
| `CLOUDFRONT_BASE` | — | CloudFront distribution URL |
| `LOCAL_CACHE_DIR` | — | Path to local media cache |
| `MAX_CF_BYTES` | 500 GiB | CloudFront transfer cap |

## Tracking Files

| File | Description |
|------|-------------|
| `s3_file_list.tsv` | Cached S3 object list (size, URL-encoded key, original key) |
| `cf_transferred_bytes.txt` | Running total of CloudFront bytes transferred |
| `download.log` | Timestamped operation log |

> **Note:** All tracking files and downloaded content are excluded from version control.
