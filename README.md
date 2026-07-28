# Blog to Podcast

Paste a blog URL, get back a narrated podcast episode. A system-design learning project - see each subproject's own README for setup and architecture:

- [`backend/`](backend/README.md) - FastAPI + SQLite + WebSocket job pipeline (Firecrawl scrape → local Ollama summary → local `say` narration)
- [`frontend/`](frontend/README.md) - Next.js UI (URL form → live progress → audio player → history)

Both live in this one repo but talk to each other only over HTTP/WebSocket - no shared code, no monorepo build tooling.
