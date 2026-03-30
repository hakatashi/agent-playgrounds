#!/usr/bin/env python3
"""
Convert questions.json to a 3-column CSV: 問題, 解答, 解説
解説 format:
  4択問題          → abc四択 N
  筆記問題         → abc筆記 N
  早押し問題       → abc本戦 N
  Extra Round 筆答  → abcExtra N
  EQIDEN 早押し    → EQIDEN N
"""

import csv
import json

INPUT  = "questions.json"
OUTPUT = "questions.csv"

SECTION_PREFIX = {
    "4択問題":              "abc四択",
    "筆記問題":             "abc筆記",
    "早押し問題":           "abc本戦",
    "Extra Round 筆答問題": "abcExtra",
    "EQIDEN 早押し問題":    "EQIDEN",
}

with open(INPUT, encoding="utf-8") as f:
    questions = json.load(f)

with open(OUTPUT, "w", encoding="utf-8-sig", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["問題", "解答", "解説"])
    for q in questions:
        prefix = SECTION_PREFIX.get(q["section"], q["section"])
        explanation = f"{prefix} {q['number']}"
        writer.writerow([q["question"], q["answer"], explanation])

print(f"Saved {len(questions)} rows to {OUTPUT}")
