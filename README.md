# Blog to Podcast — Backend

FastAPI backend that turns a blog URL into a narrated podcast episode: scrape it (Firecrawl), summarize it into a script with a local LLM (Ollama), and narrate it with the local macOS `say` TTS engine. Full architecture and design rationale: `docs/superpowers/specs/2026-07-27-blog-to-podcast-backend-design.md`.

Narration originally used ElevenLabs, but ElevenLabs' free tier blocks API access to any voice you didn't create yourself via voice cloning. Rather than pay for a plan, audio generation now shells out to macOS's built-in `say` command - free, offline, no API key. This is macOS-only; see the `ponytail:` comment in `app/pipeline.py` for the cross-platform swap-out point.

## Setup

Prerequisites:
- macOS (for the `say` command)
- Python 3.10+
- [Ollama](https://ollama.com) installed and running locally
- A Firecrawl API key

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

ollama pull llama3.2:latest

cp .env.example .env
# edit .env: set FIRECRAWL_API_KEY

uvicorn app.main:app --reload --port 8000
```

Visit http://localhost:8000/docs for interactive Swagger docs.

## Manual Testing

The server needs to already be running (see Setup above) before any of this works. Two ways to poke at it: the Swagger UI, or `curl`.

### Option A: Swagger UI

1. Open http://localhost:8000/docs
2. `POST /jobs` -> "Try it out" -> body:
   ```json
   {"url": "https://www.paulgraham.com/vb.html", "voice_id": "Samantha"}
   ```
   (voice options: `Samantha`, `Daniel`, `Karen`, `Moira` - see `GET /voices`)
   Execute -> copy the returned `job_id`.
3. `GET /jobs/{job_id}` -> paste the `job_id` -> Execute repeatedly every few seconds. Status moves `pending -> scraping -> summarizing -> generating_audio -> done` (usually 30-60s, mostly the Ollama step). A failure lands on `failed` with a real error in `error_message`.
4. Once `status` is `done`, open `http://localhost:8000/audio/<audio_filename>` in the browser to play/download the result.

Swagger's UI can't test `WS /ws/jobs/{job_id}` - browsers don't expose raw WebSocket testing there. That endpoint only gets exercised once the frontend exists (or via `curl`'s experimental WebSocket support in newer curl versions, or a tool like `websocat`).

### Option B: curl

```bash
# 1. Health check
curl http://localhost:8000/health

# 2. List available voices
curl http://localhost:8000/voices

# 3. Create a job (save the job_id it returns)
curl -s -X POST http://localhost:8000/jobs \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.paulgraham.com/vb.html", "voice_id": "Samantha"}'

# 4. Poll until status is "done" or "failed" (replace JOB_ID)
JOB_ID="paste-the-job-id-here"
watch -n 3 "curl -s http://localhost:8000/jobs/$JOB_ID"

# 5. Once done, download/play the audio (replace the filename from step 4's response)
open http://localhost:8000/audio/JOB_ID.wav

# 6. See job history
curl http://localhost:8000/jobs
```

(`watch` isn't installed on macOS by default - `brew install watch`, or just re-run the `curl` in step 4 by hand every few seconds.)

### Stopping the server

`Ctrl+C` in the terminal it's running in, or if it's running in the background:
```bash
lsof -ti tcp:8000 | xargs kill
```

## Tests

```bash
pytest -v
```

All external calls (Firecrawl, Ollama, and the `say` subprocess) are mocked in tests — no live credentials, no running Ollama instance, and no macOS-specific behavior are required to run the suite.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | /health | Liveness check |
| GET | /voices | List preset narrator voices (macOS system voice names) |
| POST | /jobs | Create a job: `{url, voice_id}` -> `{job_id, status}` |
| GET | /jobs | List past jobs (`limit`, `offset`) |
| GET | /jobs/{job_id} | Full current state of one job |
| WS | /ws/jobs/{job_id} | Live status updates; sends current state on connect |
| GET | /audio/{filename} | Static serving of generated audio |
