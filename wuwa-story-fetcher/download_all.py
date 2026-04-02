#!/usr/bin/env python3
"""
鳴潮ストーリー一括ダウンロード
ストーリーID 100001〜100038 を順番に取得し、output/ ディレクトリに保存します。
存在しないIDは404/エラーをスキップします。

Usage:
    python3 download_all.py
"""

import time
import urllib.error
from pathlib import Path

from fetch_story import fetch_story, format_story

START_ID = 100001
END_ID = 100038
OUTPUT_DIR = Path("output")
INTERVAL_SEC = 0.5  # リクエスト間隔（サーバー負荷軽減）


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)

    total = END_ID - START_ID + 1
    success = 0
    skipped = 0

    for story_id in range(START_ID, END_ID + 1):
        output_path = OUTPUT_DIR / f"story_{story_id}.md"

        print(f"[{story_id - START_ID + 1}/{total}] ID:{story_id} 取得中...", end=" ", flush=True)

        try:
            data = fetch_story(story_id)
        except urllib.error.HTTPError as e:
            print(f"スキップ (HTTP {e.code})")
            skipped += 1
            time.sleep(INTERVAL_SEC)
            continue
        except urllib.error.URLError as e:
            print(f"スキップ (接続失敗: {e.reason})")
            skipped += 1
            time.sleep(INTERVAL_SEC)
            continue

        markdown = format_story(data)
        output_path.write_text(markdown, encoding="utf-8")
        print(f"保存 → {output_path}")
        success += 1

        time.sleep(INTERVAL_SEC)

    print(f"\n完了: {success} 件保存, {skipped} 件スキップ")


if __name__ == "__main__":
    main()
