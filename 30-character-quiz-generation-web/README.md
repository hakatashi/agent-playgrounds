# 30-Character Quiz Generation Web App

A web application for generating 30-character Japanese 早押し (buzzer quiz) questions using LLMs. Based on a 6-step prompting procedure, the app generates questions that are exactly 30 characters long (including the trailing question mark).

## Features

- **Web UI** with genre (大ジャンル/小ジャンル) and answer format inputs
- **Dual LLM backends**: local Ollama (port 11434) or cloud Claude API
- **SSE streaming** — LLM output is streamed in real-time to the browser
- **MongoDB-backed history** with filtering and TSV export
- **Wikipedia grounding** — optionally fetches a Wikipedia article to ground the prompt
- **Batch generation** — run generation across a list of sub-genres in the background

## Prerequisites

- Node.js 20+
- MongoDB (local or remote)
- [Ollama](https://ollama.com/) running on `localhost:11434` (for local LLM backend)
- Anthropic API key (for Claude backend)

## Setup

### 1. Server

```bash
cd server
cp .env.example .env
# Edit .env and fill in ANTHROPIC_API_KEY and MONGODB_URI
npm install
npm run dev
```

Server runs on `http://localhost:3000`.

### 2. Client

```bash
cd client
npm install
npm run dev
```

Client runs on `http://localhost:5173`. API requests to `/api/*` are proxied to the server.

## Usage

### Generate Page (`/`)

Enter a 大ジャンル (major genre), 小ジャンル (minor genre), and 答えの形式 (answer format). Select the LLM backend and model. Optionally enable Wikipedia grounding to provide article context to the LLM. Click **生成開始** to start generation.

The LLM output is streamed in real-time. When generation finishes, parsed quizzes are displayed in a table. Quizzes with exactly 30 characters are highlighted in green.

### History Page (`/history`)

Browse all generated quizzes. Filter by major/minor genre. Export filtered results as a TSV file.

### Batch Page (`/batch`)

Configure batch generation: enter a list of sub-genres (one per line). The server processes each sub-genre sequentially in the background. Progress is updated every 2 seconds.

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/generate` | SSE stream: generate quizzes and save to DB |
| GET | `/api/generate/models?backend=` | List available models |
| GET | `/api/quizzes` | List quizzes (page/limit/majorGenre/minorGenre) |
| DELETE | `/api/quizzes/:id` | Delete a quiz |
| GET | `/api/export/tsv` | Download TSV export |
| POST | `/api/batch` | Create and start a batch job |
| GET | `/api/batch` | List batch jobs |
| GET | `/api/batch/:id` | Get job details |
| GET | `/api/batch/:id/stream` | SSE progress stream |
| DELETE | `/api/batch/:id` | Abort a running job |

## Architecture

```
client/  (React 19 + TypeScript + Vite)
  └── src/
      ├── pages/        GeneratePage, HistoryPage, BatchPage
      ├── components/   GenForm, StreamViewer, QuizTable, BatchControl, ExportButton
      └── hooks/        useSSE, useQuizHistory

server/  (Express + TypeScript + MongoDB/Mongoose)
  └── src/
      ├── routes/       generate, quizzes, export, batch
      └── services/
          ├── llm/      ollama.ts, claude.ts
          ├── wikipedia.ts
          ├── promptBuilder.ts
          └── quizParser.ts
```

SSE streaming uses `POST + fetch + ReadableStream` (not `EventSource`, which only supports GET).
