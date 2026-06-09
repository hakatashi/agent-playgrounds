# 30-Character Quiz Generation

A prompt template for generating Japanese quiz questions that are exactly 30 characters long (including the trailing question mark).

## Purpose

`prompt.md` contains a detailed prompt (in Japanese) for instructing an AI to generate quiz questions matching a specific format:

- **Genre and answer type**: configurable (default: Southeast Asian geography, country names)
- **Exact length**: questions must be exactly 30 characters, verified using a Python character count
- **Output**: TSV with question and answer columns

The prompt enforces a strict step-by-step procedure to ensure accuracy, including mandatory Python-based character counting rather than manual estimation.

## How to Use

Copy the contents of `prompt.md` into a conversation with an AI assistant (e.g., Claude), adjusting the genre and answer type in the `# 指定内容` section as needed.
