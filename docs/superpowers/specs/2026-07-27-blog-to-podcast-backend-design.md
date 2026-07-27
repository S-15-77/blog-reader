# Blog-to-Podcast Backend — Design Spec

Status: approved pending user sign-off
Scope: backend only (`podcast-agent-backend`, this repo). Frontend (`podcast-agent-frontend`) is a separate spec, built after this backend works end-to-end.

## Purpose

Turn a blog URL into a narrated podcast episode: scrape it, summarize it into a script with a local LLM, generate narration audio, and expose live progress over a job API so a frontend can show step-by-step status. This is a system-design learning project — the point is the architecture (job queue, WebSocket-over-DB-truth, explicit pipeline), not shipping a product.

## Source of truth for architecture

The user supplied a complete architecture writeup (already reviewed and endorsed by the user) covering:
- Two-tier split: FastAPI backend / Next.js frontend, talking only over HTTP + WebSocket
- Job queue pattern: `POST /jobs` returns immediately, work happens via FastAPI `BackgroundTasks`
- SQLite as the single source of truth; WebSocket is a notification layer on top, not where state lives — every status change is a DB write first, then a broadcast
- On WebSocket connect, the server immediately sends the job's current DB state before listening for further broadcasts (closes the common "broadcast fires into an empty room" race)
- Direct SDK calls to Firecrawl / Ollama / ElevenLabs — no agent framework, because the pipeline is fixed and linear (scrape → summarize → generate_audio), no branching, no agentic decision points
- Documented, deliberate known limitations (no task queue/Celery, no auth, SQLite not Postgres, no migrations, race window not fully gap-proof, offset pagination, unverified preset voice IDs)

All of this is treated as settled architecture for this build — it is not being re-derived, only implemented. Full detail lives in the pasted README (reproduced in this conversation); this spec translates it into what gets built and in what order for the backend phase.

## Build context / constraints (from user, this session)

- This directory (`blog-to-podcast`) becomes the backend repo. A sibling directory `../podcast-agent-frontend` will later hold the frontend as its own git repo — not built in this phase.
- No Firecrawl/ElevenLabs API keys and no local Ollama install exist yet. The backend must:
  - Scaffold real integration code against the real SDKs (`firecrawl-py`, `elevenlabs`, `ollama`), configured via `.env` (with `.env.example` committed, real `.env` gitignored).
  - Be structured so pipeline logic (status transitions, DB writes, WebSocket broadcasts) is testable via mocks/fakes for the three external calls, without requiring live credentials or a running Ollama server.
  - A live end-to-end run (real scrape → real Ollama summary → real ElevenLabs audio) is deferred until the user installs Ollama and supplies keys — that's expected, not a gap in this phase.
- Backend must be fully working and testable (via `/docs` Swagger UI, and the automated test suite) before the frontend repo is started.

## What gets built

### Data model
Single `jobs` table (SQLAlchemy + SQLite):

| Column | Type | Notes |
|---|---|---|
| id | string (UUID) | primary key |
| url | string | submitted blog URL |
| voice_id | string | selected ElevenLabs voice |
| status | enum | pending / scraping / summarizing / generating_audio / done / failed |
| summary_text | text, nullable | set once summarization completes |
| audio_filename | string, nullable | set once audio generation completes |
| error_message | text, nullable | set only on failure |
| created_at / updated_at | datetime | |

`status` is a real Python/SQL enum, not a free string.

### API surface

| Method | Path | Purpose |
|---|---|---|
| GET | /health | liveness check |
| GET | /voices | list preset narrator voices |
| POST | /jobs | create job → `{job_id, status}` |
| GET | /jobs | list past jobs, most recent first (`limit`, `offset`) |
| GET | /jobs/{job_id} | full current state of one job |
| WS | /ws/jobs/{job_id} | current state on connect, then push on every change |
| GET | /audio/{filename} | static serving of generated audio |

### Pipeline (`app/pipeline.py`)

Runs as a `BackgroundTasks` callback after `POST /jobs` returns:

```
status -> scraping          (DB write + WS broadcast)
  Firecrawl.scrape(url)
status -> summarizing       (DB write + WS broadcast)
  Ollama summarize (local llama3.2)
status -> generating_audio  (DB write + WS broadcast, includes summary_text)
  ElevenLabs TTS -> saved to audio_generations/
status -> done               (DB write + WS broadcast, includes audio_url)
```
Any exception at any step → `status -> failed`, `error_message` set, job never left stuck in a prior status.

### Project structure

```
podcast-agent-backend/
├── app/
│   ├── main.py          FastAPI app, CORS, static file serving, route registration
│   ├── config.py        Settings from .env (pydantic-settings)
│   ├── database.py      SQLAlchemy engine/session
│   ├── models.py        Job table
│   ├── schemas.py       Pydantic request/response shapes
│   ├── voices.py        Preset voice list + validation
│   ├── websockets.py    ConnectionManager + message-building helper
│   ├── pipeline.py       scrape -> summarize -> generate_audio orchestration
│   └── routers/
│       └── jobs.py       /jobs, /voices, /ws/jobs/{id}
├── audio_generations/    generated .mp3 files (gitignored, dir kept via .gitkeep)
├── tests/                pytest suite (see Testing below)
├── requirements.txt
├── .env.example
└── .gitignore
```

### Testing approach

- `pytest` + FastAPI `TestClient`.
- Firecrawl, Ollama, and ElevenLabs calls are each wrapped in a thin function so tests monkeypatch/mock them — verifies status transitions, DB persistence, WebSocket broadcast ordering, and failure handling without needing live services or credentials.
- One test proves the connect-race fix: a client that connects to `/ws/jobs/{id}` after the job has already reached a terminal state still receives that state immediately.

### Explicitly out of scope for this phase (per the README's own "known limitations")

No Celery/task queue, no auth, no Postgres, no Alembic migrations, no sequence numbers on WS messages, no cursor pagination. These are documented as deliberate, not missing.

## Open items resolved this session

- Repo layout: this directory → backend; frontend deferred to a sibling repo later.
- Credentials/Ollama: none available yet — build against real SDKs behind mockable seams; defer live end-to-end run.
- Sequencing: backend fully working (incl. tests, `/docs`) before any frontend work starts.
