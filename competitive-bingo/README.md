# Competitive Bingo (競技ビンゴ)

A web-based implementation of "競技ビンゴ" — a competitive speed variant of standard Bingo where players race against the clock.

## Rules

1. **Card selection** — At the start, 5 bingo cards are generated. Pick the one you want to play with.
2. **Non-stop calling** — Once the game begins, numbers 1–75 are called one after another without pause, announced as Japanese speech and displayed on screen.
3. **Declare bingo** — The moment you believe your card has a completed line (row, column, or diagonal), press the **ビンゴ申告！** button.
   - **Correct** → your elapsed time from the start of the game is recorded as your score. Lower is better.
   - **Incorrect** → you are disqualified (失格).

## Bingo Card Format

Standard bingo card rules apply:

| Column | Range  |
|--------|--------|
| B      | 1–15   |
| I      | 16–30  |
| N      | 31–45  |
| G      | 46–60  |
| O      | 61–75  |

The center cell (N3) is always a FREE space.

## Prerequisites

- A modern web browser (Chrome, Edge, Firefox, Safari)
- For speech synthesis: a Japanese (`ja-JP`) TTS voice installed on your OS (Chrome on Windows/macOS typically includes one by default)

## How to Run

Open `index.html` directly in a browser — no server or build step required.

```bash
# Example (macOS / Linux)
open competitive-bingo/index.html
# or
xdg-open competitive-bingo/index.html
```

Alternatively, serve the directory with any static file server:

```bash
npx serve competitive-bingo
```

## Notes

- Speech synthesis depends on the browser's Web Speech API. If no Japanese voice is available, numbers are still shown visually but may be read in a non-Japanese voice.
- The calling interval is driven by the speech engine: the next number is called ~350 ms after the current number finishes being spoken.
