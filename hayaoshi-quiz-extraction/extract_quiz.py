#!/usr/bin/env python3
"""
Extract quiz questions from abc2026.pdf (abc the24th/EQIDEN 2026 公式問題集)
and save as structured JSON.

Sections:
  - 4択問題 (100 questions with 4 choices)      : pages idx 2-5
  - 筆記問題 (100 written questions)             : pages idx 7-10
  - 4択 answers                                  : pages idx 11-12
  - 筆記 answers                                 : pages idx 13-14
  - 早押し問題 800問 (2nd Round ~ 決勝)          : pages idx 16-55
  - Extra Round 筆答問題 20問                    : page  idx 57
  - EQIDEN 早押し問題 270問                      : pages idx 59-72
"""

import json
import re
import pdfplumber

PDF_PATH = "abc2026.pdf"
OUTPUT_PATH = "questions.json"

# ──────────────────────────────────────────────
# Coordinate boundaries (points, page width ~516)
# ──────────────────────────────────────────────
# 早押し / 筆答 format
HA_NUM_X1 = 76      # question-number column right edge
HA_Q_X0   = 77      # question text left edge
HA_Q_X1   = 365     # question text right edge (answer column starts here)
HA_ANS_X0 = 365     # answer column left edge

# 4択 format
Y4_NUM_X1 = 68      # question-number column right edge
Y4_Q_X0   = 70      # question text left edge


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def is_furigana(text: str) -> bool:
    """Return True if *text* looks like a furigana annotation (short hiragana/katakana)."""
    clean = re.sub(r'[・ー\s]', '', text)
    return bool(re.match(r'^[ぁ-んァ-ン]+$', clean)) and len(clean) <= 14


def group_words_by_row(words, y_tol: float = 2.5):
    """
    Group *words* (pdfplumber word dicts) into rows.
    Words whose 'top' values differ by ≤ y_tol are in the same row.
    """
    if not words:
        return []
    sorted_words = sorted(words, key=lambda w: (w["top"], w["x0"]))
    rows = []
    cur = [sorted_words[0]]
    for w in sorted_words[1:]:
        if abs(w["top"] - cur[0]["top"]) <= y_tol:
            cur.append(w)
        else:
            rows.append(cur)
            cur = [w]
    rows.append(cur)
    return rows


def join_words(words) -> str:
    """
    Concatenate word texts.  Insert a space between consecutive words when the
    horizontal gap between them is larger than ~4 pt (indicates an actual space
    in the original PDF — common for English words or titled with spaces).
    Japanese words typically have no gap and need no separator.
    """
    if not words:
        return ""
    result = words[0]["text"]
    for prev, cur in zip(words, words[1:]):
        gap = cur["x0"] - prev["x1"]
        if gap > 4:
            result += " "
        result += cur["text"]
    return result


# ──────────────────────────────────────────────
# Parser: 早押し / 筆答 two-column format
# ──────────────────────────────────────────────

def parse_hayaoshi_pages(pdf, page_indices, section: str):
    """
    Pages use a two-column layout:
      left  (x < HA_Q_X1): question number + question text
      right (x ≥ HA_ANS_X0): answer
    Furigana appears as small hiragana/katakana in its own row, slightly
    above the corresponding kanji row.  We skip furigana rows.
    """
    questions = []
    cur = None

    for idx in page_indices:
        page = pdf.pages[idx]
        words = page.extract_words(x_tolerance=3, y_tolerance=2)
        rows = group_words_by_row(words, y_tol=2.5)

        for row in rows:
            row_s = sorted(row, key=lambda w: w["x0"])

            num_words = [w for w in row_s if w["x1"] <= HA_NUM_X1]
            q_words   = [w for w in row_s if w["x0"] >= HA_Q_X0 and w["x1"] <= HA_Q_X1]
            ans_words  = [w for w in row_s if w["x0"] >= HA_ANS_X0]

            num_text = join_words(num_words).strip()
            q_text   = join_words(q_words).strip()
            ans_text = join_words(ans_words).strip()

            # ---- skip furigana rows ----
            # A row that has only furigana-like text in the answer column
            if not num_text and not q_text and ans_text and is_furigana(ans_text):
                continue
            # A row that has only furigana-like text in the question column
            if not num_text and q_text and is_furigana(q_text) and not ans_text:
                continue
            # Both columns are furigana
            if is_furigana(q_text + ans_text) and not num_text:
                continue

            # ---- question number? ----
            num_match = re.match(r'^(\d+)\.?$', num_text) if num_text else None
            if num_match:
                if cur:
                    questions.append(cur)
                cur = {
                    "section": section,
                    "number": int(num_match.group(1)),
                    "question": q_text,
                    "answer": ans_text,
                }
                continue

            # ---- continuation of question text ----
            if cur and q_text:
                cur["question"] += q_text

    if cur:
        questions.append(cur)
    return questions


# ──────────────────────────────────────────────
# Parser: 4択問題 questions (choose-one format)
# ──────────────────────────────────────────────

CIRCLE_DIGITS = {"①": 1, "②": 2, "③": 3, "④": 4}
CIRCLE_START_RE = re.compile(r'^([①②③④])(.*)')


def parse_yontaku_questions(pdf, page_indices):
    """
    Each question block:
      - question text row(s)   (x0 ~ 72)
      - question number        (x0 ~ 44-62, y slightly below text)
      - choices row            (①…  ②…  ③…  ④…)
    Returns list of dicts with number, question, choices (list of 4 texts).

    Note: question text appears slightly ABOVE the question-number box,
    so we may see text before we see the corresponding number.
    """
    questions = []
    cur = None  # {number, question, choices}

    for idx in page_indices:
        page = pdf.pages[idx]
        words = page.extract_words(x_tolerance=3, y_tolerance=2)
        rows = group_words_by_row(words, y_tol=2.5)

        for row in rows:
            row_s = sorted(row, key=lambda w: w["x0"])

            # Detect a choices row: first word starts with a circle digit
            first_text = row_s[0]["text"] if row_s else ""
            if CIRCLE_START_RE.match(first_text):
                choices = ["", "", "", ""]
                current_idx = None
                prev_x1 = None
                for w in row_s:
                    parts = re.split(r'([①②③④])', w["text"])
                    word_start = True  # True for the first non-circle part of each word
                    for part in parts:
                        if part in CIRCLE_DIGITS:
                            current_idx = CIRCLE_DIGITS[part] - 1
                            # Don't count the circle itself as consuming the word_start
                        elif part and current_idx is not None:
                            if choices[current_idx] and word_start and prev_x1 is not None:
                                # Gap to this word implies a space in the original PDF
                                if (w["x0"] - prev_x1) > 1.0:
                                    choices[current_idx] += " "
                            choices[current_idx] += part
                            word_start = False
                    prev_x1 = w["x1"]
                if cur is not None:
                    cur["choices"] = choices
                continue

            # Detect question-number / question-text rows
            num_words = [w for w in row_s if w["x1"] <= Y4_NUM_X1]
            q_words   = [w for w in row_s if w["x0"] >= Y4_Q_X0]
            num_text  = join_words(num_words).strip()
            q_text    = join_words(q_words).strip()

            # Skip page-number-only rows (single number, no other text)
            if re.match(r'^\d{1,2}$', q_text) and not num_text and len(row_s) == 1:
                continue

            if num_text and re.match(r'^\d+$', num_text) and not q_words:
                # Pure number row (question number without accompanying text).
                # The question text was already seen in the PREVIOUS row (it appears
                # slightly above the number box in the PDF).
                if cur is not None and cur.get("number") is None:
                    # Assign number to the current pending question
                    cur["number"] = int(num_text)
                elif cur is not None and cur.get("choices") is not None:
                    # Previous question is complete; start a new one
                    questions.append(cur)
                    cur = {"number": int(num_text), "question": "", "choices": None}
                else:
                    if cur is not None:
                        questions.append(cur)
                    cur = {"number": int(num_text), "question": "", "choices": None}
                continue

            if q_text:
                if cur is None:
                    cur = {"number": None, "question": q_text, "choices": None}
                elif cur.get("choices") is not None:
                    # Previous question complete; begin new (number will follow)
                    questions.append(cur)
                    cur = {"number": None, "question": q_text, "choices": None}
                else:
                    # Continuation or same-row number+text
                    if num_text and re.match(r'^\d+$', num_text):
                        if cur.get("question"):
                            questions.append(cur)
                        cur = {"number": int(num_text), "question": q_text, "choices": None}
                    else:
                        cur["question"] += q_text

    if cur and cur.get("choices") is not None:
        questions.append(cur)

    return questions


# ──────────────────────────────────────────────
# Parser: answer grid (5-column table)
# ──────────────────────────────────────────────

def parse_answer_grid_4択(pdf, page_indices):
    """
    Parse the 4択 answer grid.
    Structure per 5-question block:
      row A: 5 question numbers
      row B: 5 correct-choice indices (1-4)
      row C: 5 answer texts (may be multi-word)
    Returns dict: question_number → {index: int, text: str}
    """
    # We use text extraction for this page (easier than word positions)
    answers = {}
    for idx in page_indices:
        page = pdf.pages[idx]
        words = page.extract_words(x_tolerance=3, y_tolerance=2)
        rows = group_words_by_row(words, y_tol=3)

        i = 0
        while i < len(rows):
            row = sorted(rows[i], key=lambda w: w["x0"])
            texts = [w["text"] for w in row]

            # Detect question-number row: 5 integers
            if len(texts) == 5 and all(re.match(r'^\d+$', t) for t in texts):
                nums = [int(t) for t in texts]
                col_x = [w["x0"] for w in row]
                # Next row: 5 choice indices (1-4)
                if i + 1 < len(rows):
                    row2 = sorted(rows[i + 1], key=lambda w: w["x0"])
                    idx_texts = [w["text"] for w in row2]
                    if len(idx_texts) == 5 and all(re.match(r'^[1-4]$', t) for t in idx_texts):
                        indices = [int(t) for t in idx_texts]
                        # Next row(s): answer texts — one per column
                        ans_cols = [""] * 5
                        prev_x1 = {}
                        j = i + 2
                        while j < len(rows):
                            row3 = sorted(rows[j], key=lambda w: w["x0"])
                            texts3 = [w["text"] for w in row3]
                            # Stop if this looks like another number row
                            if len(texts3) == 5 and all(re.match(r'^\d+$', t) for t in texts3):
                                break
                            # Skip page-number-only rows (single short number)
                            if len(texts3) == 1 and re.match(r'^\d{1,2}$', texts3[0]):
                                j += 1
                                continue
                            # Assign each word to the nearest column by x0
                            for w in row3:
                                col = min(range(5), key=lambda c: abs(col_x[c] - w["x0"]))
                                if ans_cols[col] and col in prev_x1 and (w["x0"] - prev_x1[col]) > 1.0:
                                    ans_cols[col] += " "
                                ans_cols[col] += w["text"]
                                prev_x1[col] = w["x1"]
                            j += 1
                        for k, (num, choice_idx) in enumerate(zip(nums, indices)):
                            answers[num] = {
                                "correct_index": choice_idx,
                                "answer": ans_cols[k].strip(),
                            }
                        i = j
                        continue
            i += 1

    return answers


def parse_answer_grid_筆記(pdf, page_indices):
    """
    Parse the 筆記 answer grid.
    Structure per 5-question block:
      row A: 5 question numbers
      row B+: 5 answer texts (may span multiple rows)
    Returns dict: question_number → answer_text
    Column positions are determined dynamically from each number row's x0 values.
    """
    answers = {}

    for idx in page_indices:
        page = pdf.pages[idx]
        words = page.extract_words(x_tolerance=3, y_tolerance=2)
        rows = group_words_by_row(words, y_tol=3)

        i = 0
        while i < len(rows):
            row = sorted(rows[i], key=lambda w: w["x0"])
            texts = [w["text"] for w in row]

            # Detect question-number row: 5 integers
            if len(texts) == 5 and all(re.match(r'^\d+$', t) for t in texts):
                nums = [int(t) for t in texts]
                # Use the x0 of each number word as the column anchor
                col_x = [w["x0"] for w in row]
                ans_cols = [""] * 5
                prev_x1 = {}
                j = i + 1
                while j < len(rows):
                    row2 = sorted(rows[j], key=lambda w: w["x0"])
                    texts2 = [w["text"] for w in row2]
                    if len(texts2) == 5 and all(re.match(r'^\d+$', t) for t in texts2):
                        break
                    # Skip page-number-only rows
                    if len(texts2) == 1 and re.match(r'^\d{1,2}$', texts2[0]):
                        j += 1
                        continue
                    for w in row2:
                        # Assign to nearest column by x0 distance
                        col = min(range(5), key=lambda c: abs(col_x[c] - w["x0"]))
                        if ans_cols[col] and col in prev_x1 and (w["x0"] - prev_x1[col]) > 1.0:
                            ans_cols[col] += " "
                        ans_cols[col] += w["text"]
                        prev_x1[col] = w["x1"]
                    j += 1
                for k, num in enumerate(nums):
                    answers[num] = ans_cols[k].strip()
                i = j
                continue
            i += 1

    return answers


# ──────────────────────────────────────────────
# Parser: 筆記問題 questions
# ──────────────────────────────────────────────

def parse_筆記_questions(pdf, page_indices):
    """
    Each question:
      - question number (x0 ~ 50-66)
      - question text   (x0 ~ 72, may wrap)
    No answers on these pages.
    """
    questions = []
    cur = None

    for idx in page_indices:
        page = pdf.pages[idx]
        words = page.extract_words(x_tolerance=3, y_tolerance=2)
        rows = group_words_by_row(words, y_tol=2.5)

        for row in rows:
            row_s = sorted(row, key=lambda w: w["x0"])
            num_words = [w for w in row_s if w["x1"] <= 68]
            q_words   = [w for w in row_s if w["x0"] >= 68]

            num_text = join_words(num_words).strip()
            q_text   = join_words(q_words).strip()

            # Skip page numbers (single 1-2 digit number with nothing else)
            if re.match(r'^\d{1,2}$', q_text) and not num_text and len(row_s) == 1:
                continue

            if num_text and re.match(r'^\d+$', num_text) and not q_words:
                # pure number row
                if cur is not None:
                    questions.append(cur)
                cur = {"section": "筆記問題", "number": int(num_text), "question": ""}
                continue

            if q_text:
                # Check if number is embedded at left of same row
                if num_text and re.match(r'^\d+$', num_text):
                    if cur:
                        questions.append(cur)
                    cur = {"section": "筆記問題", "number": int(num_text), "question": q_text}
                else:
                    if cur:
                        cur["question"] += q_text
                    else:
                        cur = {"section": "筆記問題", "number": None, "question": q_text}

    if cur:
        questions.append(cur)
    return questions


# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────

def main():
    print(f"Opening {PDF_PATH} …")
    pdf = pdfplumber.open(PDF_PATH)
    total_pages = len(pdf.pages)
    print(f"Total pages: {total_pages}")

    all_questions = []

    # ── 1. 4択問題 ──────────────────────────────
    print("Extracting 4択問題 questions …")
    raw_4択 = parse_yontaku_questions(pdf, range(2, 6))
    print(f"  {len(raw_4択)} raw question entries")

    print("Extracting 4択問題 answers …")
    ans_4択 = parse_answer_grid_4択(pdf, range(11, 13))
    print(f"  {len(ans_4択)} answer entries")

    for q in raw_4択:
        n = q.get("number")
        if n is None:
            continue
        a = ans_4択.get(n, {})
        all_questions.append({
            "section": "4択問題",
            "number": n,
            "question": q["question"],
            "choices": q.get("choices", []),
            "correct_index": a.get("correct_index"),
            "answer": a.get("answer", ""),
        })

    # ── 2. 筆記問題 ──────────────────────────────
    print("Extracting 筆記問題 questions …")
    raw_筆記 = parse_筆記_questions(pdf, range(7, 11))
    print(f"  {len(raw_筆記)} raw question entries")

    print("Extracting 筆記問題 answers …")
    ans_筆記 = parse_answer_grid_筆記(pdf, range(13, 15))
    print(f"  {len(ans_筆記)} answer entries")

    for q in raw_筆記:
        n = q.get("number")
        if n is None:
            continue
        all_questions.append({
            "section": "筆記問題",
            "number": n,
            "question": q["question"],
            "answer": ans_筆記.get(n, ""),
        })

    # ── 3. 早押し問題 (2nd Round ~ 決勝) ─────────
    print("Extracting 早押し問題 (2nd Round ~ 決勝) …")
    hayaoshi = parse_hayaoshi_pages(pdf, range(16, 56), "早押し問題")
    print(f"  {len(hayaoshi)} questions")
    all_questions.extend(hayaoshi)

    # ── 4. Extra Round 筆答問題 ──────────────────
    print("Extracting Extra Round 筆答問題 …")
    extra = parse_hayaoshi_pages(pdf, [57], "Extra Round 筆答問題")
    print(f"  {len(extra)} questions")
    all_questions.extend(extra)

    # ── 5. EQIDEN 早押し問題 ─────────────────────
    print("Extracting EQIDEN 早押し問題 …")
    eqiden = parse_hayaoshi_pages(pdf, range(59, 73), "EQIDEN 早押し問題")
    print(f"  {len(eqiden)} questions")
    all_questions.extend(eqiden)

    # ── Output ───────────────────────────────────
    print(f"\nTotal questions extracted: {len(all_questions)}")
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)
    print(f"Saved to {OUTPUT_PATH}")

    # Quick sanity check
    for section in ["4択問題", "筆記問題", "早押し問題", "Extra Round 筆答問題", "EQIDEN 早押し問題"]:
        count = sum(1 for q in all_questions if q["section"] == section)
        print(f"  {section}: {count}")


if __name__ == "__main__":
    main()
