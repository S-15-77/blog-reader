# Blog-to-Podcast Frontend — Design Spec

Status: approved pending user sign-off

**Addendum (2026-07-27):** shortly after this spec was approved, the user asked to combine the frontend and backend into a single repository. Everywhere below that says "sibling repo" / "no monorepo tooling" now means: `blog-to-podcast/frontend/` (this code) and `blog-to-podcast/backend/` (the backend), two folders in one git repo. The API contract, no-shared-code boundary, and every other decision in this spec are unchanged - only the repo layout changed.

Scope: frontend only (`podcast-agent-frontend` originally, now `blog-to-podcast/frontend/`). Talks to the already-built and already-tested backend (`blog-to-podcast/backend/`) purely over the HTTP/WebSocket contract below - no shared code between the two.

## Purpose

Single-page app: paste a blog URL, pick a narrator voice, submit, watch live step-by-step progress as the backend scrapes/summarizes/narrates it, then play the finished audio. A history panel lists past episodes. This is the presentation layer for the system-design learning project described in the backend's own README - the interesting engineering here is the WebSocket-with-polling-fallback client, not visual polish for its own sake.

## Source of truth: backend API contract

Verified against the actual running backend (not assumed):

**REST**
- `GET /health` -> `{ status: "ok" }`
- `GET /voices` -> `Voice[]` where `Voice = { id: string, name: string }` (e.g. `{"id": "Samantha", "name": "Samantha (US)"}`)
- `POST /jobs` body `{ url: string, voice_id: string }` -> `{ job_id: string, status: JobStatus }` (201-style 200 response; 400 if `voice_id` isn't a known preset)
- `GET /jobs?limit=&offset=` -> `Job[]`, most recent first
- `GET /jobs/{job_id}` -> `Job`, or 404
- `GET /audio/{filename}` -> static audio file bytes

```ts
type JobStatus = "pending" | "scraping" | "summarizing" | "generating_audio" | "done" | "failed"

type Job = {
  id: string
  url: string
  voice_id: string
  status: JobStatus
  summary_text: string | null
  audio_filename: string | null   // raw filename only - NOT a URL
  error_message: string | null
  created_at: string
  updated_at: string
}
```

**WebSocket**: `WS /ws/jobs/{job_id}` - on connect, immediately sends the job's current DB state (this is the backend's documented race-condition fix - the frontend must rely on this rather than assuming it only connects before any work starts). Same shape on every subsequent push:

```ts
type JobSocketMessage = {
  job_id: string
  status: JobStatus
  summary_text: string | null
  audio_url: string | null   // already a path, e.g. "/audio/xyz.wav" - NOT the same field name as Job.audio_filename
  error_message: string | null
}
```

**Important asymmetry to design around**: the REST `Job` type exposes `audio_filename` (a bare filename you must prefix with the API base URL yourself), while the WebSocket message exposes `audio_url` (already a `/audio/...` path). `lib/api.ts` and `hooks/useJobSocket.ts` must each produce a single normalized "playable audio URL or null" so components never have to know which shape they came from.

## Architecture

- Next.js 16 App Router, TypeScript, Tailwind v4 (CSS-based `@theme`, no `tailwind.config.js`), React 19 - as already scaffolded by `create-next-app`.
- One route (`/`, i.e. `app/page.tsx`), no other pages/routing needed.
- Backend base URL from `NEXT_PUBLIC_API_URL` (`.env.local`, default `http://localhost:8000`); the WebSocket URL is derived from it (`http`->`ws`) rather than a second env var.
- `app/page.tsx` is a Client Component (`"use client"`) - the whole app is one interactive tree, so there's no meaningful server/client split to exploit here beyond the root layout.

### File structure

```
podcast-agent-frontend/
├── app/
│   ├── layout.tsx        Root layout: fonts, <html>/<body>, metadata
│   ├── page.tsx          Orchestrates: form -> create job -> useJobSocket -> status/audio/history
│   └── globals.css       Tailwind v4 theme tokens: warm paper background, serif headline font
├── lib/
│   ├── types.ts          Voice, JobStatus, Job, JobSocketMessage (mirrors backend exactly)
│   └── api.ts            getVoices(), createJob(), getJob(), listJobs() - fetch wrappers
├── hooks/
│   └── useJobSocket.ts   WebSocket-with-polling-fallback for one job_id
└── components/
    ├── UrlForm.tsx        URL input + voice <select>, calls onSubmit(url, voiceId)
    ├── JobStatus.tsx      Numbered "production log" step list + active-step waveform + error state
    ├── AudioPlayer.tsx    <audio controls> + download link, given a normalized audio URL
    └── HistoryPanel.tsx   Past jobs list (GET /jobs), refetches when a job reaches done/failed
```

### Data flow

1. On mount, `page.tsx` fetches `GET /voices` and passes them to `UrlForm`.
2. User submits URL + voice -> `page.tsx` calls `createJob()` -> stores the returned `job_id` in state.
3. `page.tsx` calls `useJobSocket(jobId)`, which:
   - Opens `WS /ws/jobs/{jobId}` and updates state on every message (the very first message is the current state, per the backend's connect-time send).
   - If the socket errors or closes before a terminal status (`done`/`failed`), falls back to polling `GET /jobs/{jobId}` every 3s until terminal, so a dropped/blocked WebSocket degrades to "still works, just slower" rather than "stuck forever" - mirroring the resilience the backend's own README calls out as a design goal.
   - Exposes one normalized shape: `{ status, summaryText, audioUrl, errorMessage }` where `audioUrl` is already resolved to a full playable URL or `null`, regardless of whether it arrived via WS (`audio_url`) or REST fallback (`audio_filename` + base URL).
4. `page.tsx` renders `JobStatus` from that hook's state; once `status === "done"`, renders `AudioPlayer` with the normalized `audioUrl`.
5. When `status` becomes `done` or `failed`, `page.tsx` triggers `HistoryPanel` to refetch `GET /jobs`.

### Error handling

- `createJob()` rejecting (network error, or backend 400 for a bad `voice_id`) surfaces as an inline error in `UrlForm`, not a crash.
- A job that reaches `status: "failed"` renders its `error_message` in `JobStatus` instead of the audio player.
- If the WebSocket never connects and polling also fails repeatedly (backend down), `JobStatus` shows a generic "can't reach the server" state rather than spinning forever silently.

### Design language

Matches the direction already described for this project: a warm paper background and serif headline (print/manuscript feel, not generic "AI product" styling), the pipeline's progress shown as a numbered production log instead of a generic progress bar, and the currently-active step rendered as a small animated waveform - the one deliberate signature visual tying the UI to the product's actual function (text becoming sound). Implemented via Tailwind v4's `@theme` block in `globals.css` (custom color/font tokens), not a separate config file. Exact colors/spacing are refined visually against the running dev server rather than specified pixel-by-pixel here.

## Testing

Component tests via Vitest + React Testing Library (already-decided choice), colocated as `*.test.tsx` next to each file:
- `lib/api.ts`: mock global `fetch`, assert each function hits the right method/URL/body and parses the response.
- `hooks/useJobSocket.ts`: mock the global `WebSocket` constructor to simulate (a) normal message delivery, (b) a socket that errors/closes early -> assert it falls back to polling `fetch`.
- `components/UrlForm.tsx`: renders voice options from props, calls `onSubmit` with the right args, shows a validation message for an empty URL.
- `components/JobStatus.tsx`: given each `JobStatus` value as a prop, asserts the right step is marked active/done and that `failed` renders the error message.
- `components/AudioPlayer.tsx`: renders an `<audio>` with the given `src` and a download link pointing at the same URL.
- `components/HistoryPanel.tsx`: renders a list of jobs passed in (fetch itself mocked).

`app/page.tsx` wiring is verified by running the actual dev server against the actual backend (per the project's own convention for UI work) rather than a heavy integration test - the pieces it composes are already unit-tested individually.

## Out of scope for this phase

No routing beyond `/`, no auth, no dark-mode toggle beyond `prefers-color-scheme` (matches backend's own "no auth" scope decision), no deployment config - this is a local personal tool, same as the backend.
