#!/usr/bin/env python3
"""
鳴潮 (Wuthering Waves) ストーリーデータフェッチャー
指定されたストーリーIDのデータをAPIから取得し、Markdown形式で保存します。

Usage:
    python3 fetch_story.py <story_id> [output_file]

Examples:
    python3 fetch_story.py 100003
    python3 fetch_story.py 100038 output.md
"""

import sys
import re
import json
import urllib.request
import urllib.error
from pathlib import Path


API_BASE = "https://api-v2.encore.moe/api/ja/story"


def fetch_story(story_id: int) -> dict:
    url = f"{API_BASE}/{story_id}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "application/json",
    })
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise
    except urllib.error.URLError as e:
        raise


def strip_ano_tags(text: str) -> str:
    """<ano=...>inner</ano> タグを除去し、内部テキストのみ残す"""
    return re.sub(r"<ano=[^>]*>(.*?)</ano>", r"\1", text)


def expand_gender_text(text: str) -> str:
    """{Male=...;Female=...} パターンを「男性版/女性版」形式に展開する"""
    def replacer(m):
        parts = m.group(1).split(";")
        male = parts[0].replace("Male=", "", 1) if len(parts) > 0 else ""
        female = parts[1].replace("Female=", "", 1) if len(parts) > 1 else ""
        if male == female:
            return male
        return f"{male}/{female}"
    return re.sub(r"\{([^}]+)\}", replacer, text)


def clean_text(text: str) -> str:
    return expand_gender_text(strip_ano_tags(text))


def format_story(data: dict) -> str:
    lines = []

    # ヘッダー
    lines.append(f"# {data['Name']}")
    lines.append("")
    if data.get("Description"):
        lines.append(f"**{data['Description']}**")
        lines.append("")
    if data.get("QuestDesc"):
        lines.append(f"> {clean_text(data['QuestDesc'])}")
        lines.append("")

    # アンロック情報
    unlocks = data.get("Unlock", [])
    if unlocks:
        lines.append("## アンロック情報")
        for u in unlocks:
            kind = {1: "ストーリー", 2: "コンテンツ"}.get(u.get("Type"), "不明")
            lines.append(f"- [{kind}] {u['Name']} (ID: {u['Id']})")
        lines.append("")

    # 章・ダイアログ
    lines.append("## ストーリー")
    lines.append("")

    chapters = data.get("Chapters", [])
    for chapter in chapters:
        title = chapter.get("Title", "").strip()
        if title:
            lines.append(f"### {title}")
            lines.append("")

        dialogues = chapter.get("Dialogues", [])
        for dlg in dialogues:
            speaker = dlg.get("Speaker", "") or ""
            text = clean_text(dlg.get("PlotLineKey", "") or "")
            options = dlg.get("Options", [])
            dlg_type = dlg.get("Type", "")

            # 選択肢のみ（Speaker が未定義）: 選択肢だけ表示
            is_undefined_speaker = speaker.lower() in ("", "speaker_undefined")

            # Outline タイプ（章の要約・地の文）
            if dlg_type == "Outline":
                if text:
                    lines.append(f"*{text}*")
                    lines.append("")
                continue

            if is_undefined_speaker and not text:
                # 選択肢だけのノード
                pass
            elif speaker == "Narrator" or is_undefined_speaker:
                if text:
                    lines.append(f"*{text}*")
                    lines.append("")
            else:
                lines.append(f"**{speaker}**")
                lines.append(f"{text}")
                lines.append("")

            # 選択肢
            if options:
                real_options = [o for o in options if o.get("Type") != "Outline"]
                if real_options:
                    lines.append("*選択肢:*")
                    for opt in real_options:
                        opt_text = clean_text(opt.get("PlotLineKey", "") or "")
                        jump = opt.get("JumpToId")
                        if jump:
                            lines.append(f"- {opt_text}  → (→ ID:{jump})")
                        else:
                            lines.append(f"- {opt_text}")
                    lines.append("")

    return "\n".join(lines)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    try:
        story_id = int(sys.argv[1])
    except ValueError:
        print(f"Error: ストーリーIDは整数で指定してください: {sys.argv[1]}", file=sys.stderr)
        sys.exit(1)

    if len(sys.argv) >= 3:
        output_path = Path(sys.argv[2])
    else:
        output_path = Path(f"story_{story_id}.md")

    print(f"取得中: {API_BASE}/{story_id} ...")
    try:
        data = fetch_story(story_id)
    except urllib.error.HTTPError as e:
        print(f"Error: HTTPエラー {e.code}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"Error: 接続失敗 - {e.reason}", file=sys.stderr)
        sys.exit(1)

    markdown = format_story(data)
    output_path.write_text(markdown, encoding="utf-8")
    print(f"保存完了: {output_path}")


if __name__ == "__main__":
    main()
