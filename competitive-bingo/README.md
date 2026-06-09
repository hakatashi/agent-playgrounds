# 競技ビンゴ

A competitive speed-bingo web app played in the browser.

## What is 競技ビンゴ?

競技ビンゴ (Competitive Bingo) is a bingo variant that adds speed and skill elements:

1. At the start, five bingo cards are shown — pick one.
2. Numbers are announced non-stop in Japanese via text-to-speech.
3. When you believe you have a bingo, press **ビンゴ！** to declare it.
4. If bingo is confirmed, your elapsed time is recorded. If not, you are disqualified.

Players compete on the accuracy and speed of their declaration, as well as their ability to track called numbers mentally.

## Features

- Standard bingo card generation (B 1–15 / I 16–30 / N 31–45 / G 46–60 / O 61–75)
- Japanese text-to-speech via the Web Speech API
- Scrolling number history with the latest number shown prominently
- Configurable call interval (1–10 s) and speech rate (×0.5–×2.0)
- Optional manual highlight mode — click cells to mark them during play
- Result screen showing elapsed time, first-bingo-possible call index, and highlight accuracy

## Prerequisites

- Node.js 18+
- A browser with Web Speech API support (Chrome / Edge recommended for best Japanese TTS voice availability)

## Getting Started

```bash
cd competitive-bingo
npm install
npm run dev
```

Then open the URL shown in the terminal (typically `http://localhost:5173`).

## Build for Production

```bash
npm run build
# Output is in dist/
```
