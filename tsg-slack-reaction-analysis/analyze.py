#!/usr/bin/env python3
"""
TSG Slack Reaction Analyzer
Analyzes who gave what reactions in the TSG Slack workspace.
Downloads Slack export ZIPs, deduplicates messages, and generates an HTML report.
"""

import json
import os
import re
import subprocess
import sys
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import requests

# ─── Files providing full coverage (Apr 2015 – May 2026) with minimal overlap ───
FILES = [
    ("1XHeYCazTN1j9SjtBomRN3sNU6mPn3eNB", "Apr 2015 – Feb 2023"),
    ("1xgsTVowQl1UERoWauWK5fVgf4Fyje-8l", "Jan 2023 – Sep 2023"),
    ("16a3YprsBjR3QaliGPjl2LXnm-Tf1ZqWJ", "Jul 2023 – Jan 2024"),
    ("19pjWNRg4t1ac633O3Nhp43y7yD_DDR6e", "Jan 2024 – Jan 2025"),
    ("1f1ezZSCroybZG18C_IcO-q0C-rNPqiZC", "Jan 2025 – Jan 2026"),
    ("1BWHt9y0LYJ3IlXGXA3SyGboZStUVl_kq", "May 2025 – May 2026"),
]

DOWNLOAD_DIR = Path(__file__).parent / "data" / "downloads"
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)


def get_token() -> str:
    result = subprocess.run(
        ["gcloud", "auth", "print-access-token"],
        capture_output=True, text=True, check=True,
    )
    return result.stdout.strip()


def download_zip(file_id: str, label: str, token: str) -> Path:
    path = DOWNLOAD_DIR / f"{file_id}.zip"
    if path.exists():
        print(f"  [skip] {label} (already downloaded)")
        return path

    print(f"  Downloading {label} …", flush=True)
    url = f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media"
    headers = {"Authorization": f"Bearer {token}"}

    with requests.get(url, headers=headers, stream=True, timeout=600) as r:
        r.raise_for_status()
        total = int(r.headers.get("content-length", 0))
        done = 0
        with open(path, "wb") as f:
            for chunk in r.iter_content(chunk_size=2 * 1024 * 1024):
                f.write(chunk)
                done += len(chunk)
                if total:
                    pct = done * 100 / total
                    mb = done // 1024 // 1024
                    tot_mb = total // 1024 // 1024
                    print(f"\r    {pct:5.1f}%  {mb}/{tot_mb} MB", end="", flush=True)
    print()
    return path


def process_zip(
    zip_path: Path,
    seen: set,
    user_map: dict,
    user_emoji: "defaultdict[tuple, int]",
    user_total: "defaultdict[str, int]",
    emoji_total: "defaultdict[str, int]",
    monthly: "defaultdict[str, int]",
):
    new_msgs = 0
    dup_msgs = 0

    with zipfile.ZipFile(zip_path) as zf:
        names = set(zf.namelist())

        # Load users
        for candidate in ("users.json", "Users.json"):
            if candidate in names:
                with zf.open(candidate) as f:
                    try:
                        users = json.load(f)
                    except Exception:
                        users = []
                for u in users:
                    uid = u.get("id", "")
                    if not uid:
                        continue
                    profile = u.get("profile", {})
                    display = (
                        profile.get("display_name_normalized")
                        or profile.get("real_name_normalized")
                        or profile.get("real_name")
                        or u.get("name", uid)
                    )
                    if uid not in user_map and display:
                        user_map[uid] = display
                break

        # Process message files
        for name in sorted(names):
            if not name.endswith(".json"):
                continue
            parts = name.split("/")
            if len(parts) < 2:
                continue
            channel = parts[0]
            # Skip top-level metadata files
            if channel in ("users", "channels", "integration_logs", "dms", "mpims", "groups"):
                continue

            with zf.open(name) as f:
                try:
                    messages = json.load(f)
                except Exception:
                    continue
            if not isinstance(messages, list):
                continue

            for msg in messages:
                ts = msg.get("ts", "")
                if not ts:
                    continue
                key = (channel, ts)
                if key in seen:
                    dup_msgs += 1
                    continue
                seen.add(key)
                new_msgs += 1

                reactions = msg.get("reactions", [])
                if not reactions:
                    continue

                try:
                    dt = datetime.fromtimestamp(float(ts), tz=timezone.utc)
                    month_key = dt.strftime("%Y-%m")
                except (ValueError, OSError):
                    month_key = "unknown"

                for reaction in reactions:
                    emoji = reaction.get("name", "")
                    if not emoji:
                        continue
                    for uid in reaction.get("users", []):
                        user_emoji[(uid, emoji)] += 1
                        user_total[uid] += 1
                        emoji_total[emoji] += 1
                        monthly[month_key] += 1

    print(f"    new={new_msgs}, dup={dup_msgs}")


# ─── HTML generation ────────────────────────────────────────────────────────────

def esc(s: str) -> str:
    import html
    return html.escape(str(s))


def gen_html(
    user_map: dict,
    user_emoji: dict,
    user_total: dict,
    emoji_total: dict,
    monthly: dict,
) -> str:
    def uid_to_name(uid: str) -> str:
        name = user_map.get(uid, uid)
        return name if name else uid

    top_n_users = 30
    top_n_emoji = 40

    top_users = sorted(user_total.items(), key=lambda x: -x[1])[:top_n_users]
    top_emoji = sorted(emoji_total.items(), key=lambda x: -x[1])[:top_n_emoji]

    top_user_ids = [u for u, _ in top_users]
    top_emoji_names = [e for e, _ in top_emoji]

    # Heatmap data: top users × top emoji
    heatmap_rows = []
    max_heat = 1
    for uid in top_user_ids:
        row = []
        for ename in top_emoji_names:
            v = user_emoji.get((uid, ename), 0)
            row.append(v)
            if v > max_heat:
                max_heat = v
        heatmap_rows.append(row)

    # Monthly labels / data
    all_months = sorted(m for m in monthly if m != "unknown")
    monthly_labels = json.dumps(all_months)
    monthly_values = json.dumps([monthly[m] for m in all_months])

    # Chart.js datasets
    top_users_labels = json.dumps([uid_to_name(u) for u, _ in top_users])
    top_users_data   = json.dumps([c for _, c in top_users])
    top_emoji_labels = json.dumps([f":{e}:" for e, _ in top_emoji])
    top_emoji_data   = json.dumps([c for _, c in top_emoji])

    # Per-user top-5 emoji breakdown (for detail table)
    user_details = []
    for uid, total in top_users[:20]:
        name = uid_to_name(uid)
        emojis_used = {e: user_emoji.get((uid, e), 0) for e in emoji_total}
        top5 = sorted(emojis_used.items(), key=lambda x: -x[1])[:5]
        user_details.append((name, total, top5))

    # Heatmap HTML
    heat_header = "".join(
        f'<th title=":{esc(e)}:" style="transform:rotate(-45deg);white-space:nowrap;font-size:11px">{esc(e)}</th>'
        for e in top_emoji_names
    )
    heat_rows_html = ""
    for i, uid in enumerate(top_user_ids):
        name = uid_to_name(uid)
        cells = ""
        for j, ename in enumerate(top_emoji_names):
            v = heatmap_rows[i][j]
            if v == 0:
                bg = "#1a1a2e"
                fg = "#333"
            else:
                intensity = min(1.0, v / (max_heat * 0.5))
                r = int(20 + intensity * 235)
                g = int(20 + intensity * 100)
                b = int(100 + intensity * 55)
                bg = f"rgb({r},{g},{b})"
                fg = "#fff" if intensity > 0.4 else "#ccc"
            title = f"{name} : :{ename}: = {v}"
            cells += f'<td style="background:{bg};color:{fg};text-align:center;font-size:11px;padding:2px 4px" title="{esc(title)}">{v if v else ""}</td>'
        heat_rows_html += f'<tr><td style="white-space:nowrap;padding:2px 8px;font-size:12px">{esc(name)}</td>{cells}</tr>\n'

    # User detail table
    detail_rows = ""
    for name, total, top5 in user_details:
        emoji_str = "  ".join(f":{e}: ({c})" for e, c in top5)
        detail_rows += f"""
        <tr>
          <td>{esc(name)}</td>
          <td style="text-align:right">{total:,}</td>
          <td style="font-family:monospace;font-size:12px">{esc(emoji_str)}</td>
        </tr>"""

    total_reactions = sum(user_total.values())
    unique_users = len(user_total)
    unique_emoji = len(emoji_total)

    html_str = f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TSG Slack リアクション分析レポート</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  :root {{
    --bg: #0f0f1a;
    --card: #16162a;
    --border: #2a2a4a;
    --text: #e0e0f0;
    --accent: #7c6af7;
    --accent2: #4fc3f7;
    --muted: #888;
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    background: var(--bg);
    color: var(--text);
    font-family: 'Segoe UI', system-ui, sans-serif;
    padding: 24px;
    line-height: 1.6;
  }}
  h1 {{ font-size: 1.8rem; margin-bottom: 4px; color: #fff; }}
  h2 {{ font-size: 1.2rem; margin: 0 0 16px; color: var(--accent2); border-bottom: 1px solid var(--border); padding-bottom: 8px; }}
  .subtitle {{ color: var(--muted); margin-bottom: 32px; font-size: 0.9rem; }}
  .stats {{ display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 32px; }}
  .stat-card {{
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px 28px;
    min-width: 160px;
    text-align: center;
  }}
  .stat-card .value {{ font-size: 2rem; font-weight: 700; color: var(--accent); }}
  .stat-card .label {{ font-size: 0.8rem; color: var(--muted); margin-top: 4px; }}
  .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(480px, 1fr)); gap: 24px; margin-bottom: 32px; }}
  .card {{
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 24px;
  }}
  .full-width {{ grid-column: 1 / -1; }}
  .chart-container {{ position: relative; height: 320px; }}
  .chart-tall {{ position: relative; height: 480px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 13px; }}
  th, td {{ padding: 8px 12px; border-bottom: 1px solid var(--border); text-align: left; }}
  th {{ color: var(--muted); font-weight: 600; font-size: 11px; text-transform: uppercase; }}
  tr:hover td {{ background: rgba(124,106,247,0.08); }}
  .heatmap-wrapper {{ overflow-x: auto; }}
  .heatmap-wrapper table {{ width: auto; }}
  .heatmap-wrapper th {{ padding: 4px 2px; width: 30px; }}
  .generated {{ color: var(--muted); font-size: 0.75rem; margin-top: 40px; text-align: center; }}
</style>
</head>
<body>

<h1>TSG Slack リアクション分析レポート</h1>
<p class="subtitle">生成日時: {datetime.now().strftime('%Y年%m月%d日 %H:%M')} | データ期間: 2015年4月 〜 2026年5月</p>

<div class="stats">
  <div class="stat-card"><div class="value">{total_reactions:,}</div><div class="label">総リアクション数</div></div>
  <div class="stat-card"><div class="value">{unique_users:,}</div><div class="label">ユニークユーザー数</div></div>
  <div class="stat-card"><div class="value">{unique_emoji:,}</div><div class="label">ユニーク絵文字種類</div></div>
  <div class="stat-card"><div class="value">{len(all_months):,}</div><div class="label">集計月数</div></div>
</div>

<div class="grid">

  <div class="card">
    <h2>月別リアクション数推移</h2>
    <div class="chart-container">
      <canvas id="monthlyChart"></canvas>
    </div>
  </div>

  <div class="card">
    <h2>リアクション数 Top {top_n_users} ユーザー</h2>
    <div class="chart-tall">
      <canvas id="usersChart"></canvas>
    </div>
  </div>

  <div class="card">
    <h2>使用数 Top {top_n_emoji} 絵文字</h2>
    <div class="chart-tall">
      <canvas id="emojiChart"></canvas>
    </div>
  </div>

  <div class="card full-width">
    <h2>ユーザー × 絵文字 ヒートマップ (Top {top_n_users} × Top {top_n_emoji})</h2>
    <p style="font-size:12px;color:var(--muted);margin-bottom:12px">セルにマウスを乗せると詳細を表示。色が濃いほどリアクション数が多い。</p>
    <div class="heatmap-wrapper">
      <table>
        <thead>
          <tr>
            <th>ユーザー</th>
            {heat_header}
          </tr>
        </thead>
        <tbody>
          {heat_rows_html}
        </tbody>
      </table>
    </div>
  </div>

  <div class="card full-width">
    <h2>ユーザー別 Top 5 絵文字 (上位20名)</h2>
    <table>
      <thead>
        <tr>
          <th>ユーザー</th>
          <th style="text-align:right">総リアクション数</th>
          <th>よく使う絵文字 (Top 5)</th>
        </tr>
      </thead>
      <tbody>
        {detail_rows}
      </tbody>
    </table>
  </div>

</div>

<p class="generated">生成: TSG Slack Reaction Analyzer | データソース: Google Drive TSG Slack export ZIPs</p>

<script>
const CHART_DEFAULTS = {{
  color: '#e0e0f0',
  plugins: {{
    legend: {{ labels: {{ color: '#e0e0f0' }} }},
  }},
  scales: {{
    x: {{ ticks: {{ color: '#888' }}, grid: {{ color: '#2a2a4a' }} }},
    y: {{ ticks: {{ color: '#888' }}, grid: {{ color: '#2a2a4a' }} }},
  }},
}};

// Monthly
new Chart(document.getElementById('monthlyChart'), {{
  type: 'bar',
  data: {{
    labels: {monthly_labels},
    datasets: [{{
      label: 'リアクション数',
      data: {monthly_values},
      backgroundColor: 'rgba(124,106,247,0.7)',
      borderColor: 'rgba(124,106,247,1)',
      borderWidth: 1,
    }}],
  }},
  options: {{
    ...CHART_DEFAULTS,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {{ legend: {{ display: false }} }},
  }},
}});

// Top users
new Chart(document.getElementById('usersChart'), {{
  type: 'bar',
  data: {{
    labels: {top_users_labels},
    datasets: [{{
      label: 'リアクション数',
      data: {top_users_data},
      backgroundColor: 'rgba(79,195,247,0.7)',
      borderColor: 'rgba(79,195,247,1)',
      borderWidth: 1,
    }}],
  }},
  options: {{
    ...CHART_DEFAULTS,
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {{ legend: {{ display: false }} }},
    scales: {{
      x: {{ ticks: {{ color: '#888' }}, grid: {{ color: '#2a2a4a' }} }},
      y: {{ ticks: {{ color: '#e0e0f0', font: {{ size: 11 }} }}, grid: {{ color: '#2a2a4a' }} }},
    }},
  }},
}});

// Top emoji
new Chart(document.getElementById('emojiChart'), {{
  type: 'bar',
  data: {{
    labels: {top_emoji_labels},
    datasets: [{{
      label: '使用回数',
      data: {top_emoji_data},
      backgroundColor: 'rgba(255,167,38,0.7)',
      borderColor: 'rgba(255,167,38,1)',
      borderWidth: 1,
    }}],
  }},
  options: {{
    ...CHART_DEFAULTS,
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {{ legend: {{ display: false }} }},
    scales: {{
      x: {{ ticks: {{ color: '#888' }}, grid: {{ color: '#2a2a4a' }} }},
      y: {{ ticks: {{ color: '#e0e0f0', font: {{ size: 11 }} }}, grid: {{ color: '#2a2a4a' }} }},
    }},
  }},
}});
</script>
</body>
</html>
"""
    return html_str


# ─── Main ───────────────────────────────────────────────────────────────────────

def main():
    print("=== TSG Slack Reaction Analyzer ===\n")

    seen: set = set()
    user_map: dict = {}
    user_emoji: defaultdict = defaultdict(int)
    user_total: defaultdict = defaultdict(int)
    emoji_total: defaultdict = defaultdict(int)
    monthly: defaultdict = defaultdict(int)

    for file_id, label in FILES:
        print(f"\n[{label}]")
        token = get_token()
        zip_path = download_zip(file_id, label, token)
        print(f"  Processing …")
        process_zip(zip_path, seen, user_map, user_emoji, user_total, emoji_total, monthly)

    print(f"\n=== Summary ===")
    print(f"  Unique messages processed : {len(seen):,}")
    print(f"  Total reactions           : {sum(user_total.values()):,}")
    print(f"  Unique reactors           : {len(user_total):,}")
    print(f"  Unique emoji              : {len(emoji_total):,}")

    print("\nGenerating HTML report …")
    html_out = gen_html(user_map, dict(user_emoji), dict(user_total), dict(emoji_total), dict(monthly))

    out_path = Path(__file__).parent / "report.html"
    out_path.write_text(html_out, encoding="utf-8")
    print(f"  Report written to: {out_path}")


if __name__ == "__main__":
    main()
