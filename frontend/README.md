# Blog to Podcast — Frontend

Next.js frontend for the [blog-to-podcast backend](../backend). Paste a blog URL, pick a narrator voice, and watch live progress as the backend scrapes/summarizes/narrates it, then play the finished episode. Full architecture: `docs/superpowers/specs/2026-07-27-frontend-design.md`.

## Setup

Prerequisites:
- Node.js 18+
- The backend running locally (see `../backend/README.md`) - default `http://localhost:8000`

```bash
npm install
cp .env.local.example .env.local
# edit .env.local if your backend runs somewhere other than http://localhost:8000

npm run dev
```

Open http://localhost:3000.

## Tests

```bash
npm run test
```

Vitest + React Testing Library. `fetch` and `WebSocket` are mocked in every test - no running backend is required to run the suite.

## Project structure

| Path | Responsibility |
|---|---|
| `lib/types.ts` | TypeScript types mirroring the backend's API schemas |
| `lib/api.ts` | REST calls to the backend |
| `hooks/useJobSocket.ts` | WebSocket + polling-fallback logic for one job |
| `components/UrlForm.tsx` | URL input + voice dropdown |
| `components/JobStatus.tsx` | Step-by-step "production log" progress display |
| `components/AudioPlayer.tsx` | Audio playback + download link |
| `components/HistoryPanel.tsx` | Past episodes list |
| `app/page.tsx` | Wires all of the above together |
