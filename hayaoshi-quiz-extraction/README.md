# hayaoshi-quiz-extraction

Extract quiz questions and answers from the official PDF of the **abc the 24th / EQIDEN 2026** Japanese quiz competition problem set.

## Overview

The PDF contains roughly 1,290 questions across five sections. This toolkit parses the PDF using column-based text extraction, filters out furigana annotations, and exports the questions to structured JSON and CSV formats.

## Prerequisites

- Python 3.x
- The source PDF file (`abc2026.pdf`) placed in this directory

Install dependencies:

```sh
python3 -m venv venv
venv/bin/pip install pdfplumber
```

## Usage

Extract all questions to `questions.json`:

```sh
venv/bin/python3 extract_quiz.py
```

Convert JSON to `questions.csv`:

```sh
venv/bin/python3 make_csv.py
```

## Output

### `questions.json`

A JSON array where each object has the following fields:

| Field | Description |
|-------|-------------|
| `section` | Section identifier (e.g., `4択`, `筆記`, `早押し`, ...) |
| `question` | Question text |
| `answer` | Answer text |
| `note` | Supplementary explanation (if present) |

### `questions.csv`

Comma-separated file with columns: `問題`, `解答`, `解説` (question, answer, explanation).

## Sections Extracted

| Section | Count |
|---------|-------|
| 4択問題 (multiple choice) | 100 |
| 筆記問題 (written) | 100 |
| 早押し問題 (quick-answer) | ~800 |
| Extra Round 筆答問題 | 20 |
| EQIDEN 早押し問題 | ~270 |

> **Note:** `abc2026.pdf` and the generated output files (`questions.json`, `questions.csv`) are excluded from version control.
