# Blog-to-Podcast Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working, tested FastAPI backend that accepts a blog URL, runs it through a scrape → summarize → generate-audio pipeline in the background, persists every state transition to SQLite, and pushes live status over a WebSocket — testable end to end via `pytest` and `/docs` without live API keys or a running Ollama instance.

**Architecture:** Single FastAPI app (`app/main.py`) with a SQLAlchemy/SQLite `jobs` table as the sole source of truth. `POST /jobs` inserts a row and schedules a `BackgroundTasks` coroutine (`app/pipeline.py`) that walks the job through `scraping → summarizing → generating_audio → done/failed`, writing to the DB and broadcasting over a WebSocket `ConnectionManager` (`app/websockets.py`) at every step. External SDK calls (Firecrawl, Ollama, ElevenLabs) are isolated behind three plain functions so tests can monkeypatch them.

**Tech Stack:** Python 3.10+, FastAPI, Uvicorn, SQLAlchemy (SQLite), Pydantic v2 / pydantic-settings, pytest + httpx (TestClient), firecrawl-py, ollama (official client), elevenlabs (official client).

## Global Constraints

- Python 3.10+.
- Persistence is SQLite only — no Postgres, no Alembic migrations (spec: explicitly out of scope this phase).
- No auth (spec: explicitly out of scope this phase).
- Background work uses FastAPI `BackgroundTasks` only — no Celery/RQ/Arq (spec: explicitly out of scope this phase).
- `JobStatus` values are exactly: `pending`, `scraping`, `summarizing`, `generating_audio`, `done`, `failed` — no others.
- API surface is exactly: `GET /health`, `GET /voices`, `POST /jobs`, `GET /jobs`, `GET /jobs/{job_id}`, `WS /ws/jobs/{job_id}`, `GET /audio/{filename}`.
- Every test must pass with no live Firecrawl/ElevenLabs credentials and no running Ollama instance — the three external calls are mocked in tests via monkeypatching `app.pipeline.scrape_blog` / `summarize_content` / `generate_audio`.
- Working directory for all commands: `/Users/santhosh/Desktop/PesonalProjects/blog-to-podcast`.

---

### Task 1: Project scaffolding, settings, and `GET /health`

**Files:**
- Create: `requirements.txt`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `app/__init__.py`
- Create: `app/config.py`
- Create: `app/main.py`
- Create: `audio_generations/.gitkeep`
- Create: `tests/__init__.py`
- Create: `tests/test_health.py`

**Interfaces:**
- Produces: `app.config.settings` (a `Settings` instance with attributes `firecrawl_api_key: str`, `eleven_labs_api_key: str`, `ollama_model: str`, `ollama_host: str`, `database_url: str`, `audio_dir: str`, `cors_origins: list[str]`)
- Produces: `app.main.app` (the FastAPI instance), with `GET /health` already registered

- [ ] **Step 1: Create a virtual environment**

```bash
cd /Users/santhosh/Desktop/PesonalProjects/blog-to-podcast
python3 -m venv .venv
source .venv/bin/activate
```

Expected: no errors; `(.venv)` shows in the prompt.

- [ ] **Step 2: Write `requirements.txt`**

```
fastapi
uvicorn[standard]
sqlalchemy
pydantic
pydantic-settings
firecrawl-py
ollama
elevenlabs
pytest
httpx
```

- [ ] **Step 3: Install dependencies**

```bash
pip install -r requirements.txt
```

Expected: all packages install with no errors.

- [ ] **Step 4: Write the failing test**

`tests/__init__.py` (empty file).

`tests/test_health.py`:
```python
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 5: Run test to verify it fails**

```bash
pytest tests/test_health.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app'` (or `'app.main'`).

- [ ] **Step 6: Write the implementation**

`app/__init__.py` (empty file).

`app/config.py`:
```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    firecrawl_api_key: str = ""
    eleven_labs_api_key: str = ""
    ollama_model: str = "llama3.2:latest"
    ollama_host: str = "http://localhost:11434"
    database_url: str = "sqlite:///./podcast_agent.db"
    audio_dir: str = "audio_generations"
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
```

`app/main.py`:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings

app = FastAPI(title="Blog to Podcast Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/audio", StaticFiles(directory=settings.audio_dir), name="audio")


@app.get("/health")
def health():
    return {"status": "ok"}
```

`audio_generations/.gitkeep` (empty file — the directory must exist before `StaticFiles` mounts it).

`.env.example`:
```
FIRECRAWL_API_KEY=
ELEVEN_LABS_API_KEY=
OLLAMA_MODEL=llama3.2:latest
OLLAMA_HOST=http://localhost:11434
DATABASE_URL=sqlite:///./podcast_agent.db
AUDIO_DIR=audio_generations
CORS_ORIGINS=["http://localhost:3000"]
```

`.gitignore`:
```
.venv/
__pycache__/
*.pyc
.env
*.db
audio_generations/*.mp3
```

- [ ] **Step 7: Run test to verify it passes**

```bash
pytest tests/test_health.py -v
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app requirements.txt .gitignore .env.example audio_generations tests
git commit -m "Scaffold FastAPI app with health check"
```

---

### Task 2: Database engine, `Job` model, `JobStatus` enum

**Files:**
- Create: `app/database.py`
- Create: `app/models.py`
- Create: `tests/conftest.py`
- Create: `tests/test_models.py`
- Modify: `app/main.py`

**Interfaces:**
- Consumes: `app.config.settings.database_url` (Task 1)
- Produces: `app.database.engine`, `app.database.SessionLocal`, `app.database.Base`, `app.database.get_db()` (generator dependency yielding a `Session`)
- Produces: `app.models.JobStatus` (str enum: `pending`, `scraping`, `summarizing`, `generating_audio`, `done`, `failed`)
- Produces: `app.models.Job` (SQLAlchemy model, table `jobs`, columns: `id: str`, `url: str`, `voice_id: str`, `status: JobStatus`, `summary_text: str | None`, `audio_filename: str | None`, `error_message: str | None`, `created_at: datetime`, `updated_at: datetime`)

- [ ] **Step 1: Write the failing test**

`tests/conftest.py`:
```python
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_podcast_agent.db")
os.environ.setdefault("FIRECRAWL_API_KEY", "test-firecrawl-key")
os.environ.setdefault("ELEVEN_LABS_API_KEY", "test-elevenlabs-key")

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app


@pytest.fixture(autouse=True)
def reset_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)
```

`tests/test_models.py`:
```python
from app.database import SessionLocal
from app.models import Job, JobStatus


def test_job_defaults(reset_db):
    db = SessionLocal()
    job = Job(url="https://example.com/post", voice_id="21m00Tcm4TlvDq8ikWAM")
    db.add(job)
    db.commit()
    db.refresh(job)

    assert job.id is not None
    assert job.status == JobStatus.pending
    assert job.created_at is not None
    assert job.summary_text is None

    db.close()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_models.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.database'`.

- [ ] **Step 3: Write the implementation**

`app/database.py`:
```python
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings

engine = create_engine(
    settings.database_url, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

`app/models.py`:
```python
import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, String, Text

from app.database import Base


class JobStatus(str, enum.Enum):
    pending = "pending"
    scraping = "scraping"
    summarizing = "summarizing"
    generating_audio = "generating_audio"
    done = "done"
    failed = "failed"


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    url = Column(String, nullable=False)
    voice_id = Column(String, nullable=False)
    status = Column(Enum(JobStatus), nullable=False, default=JobStatus.pending)
    summary_text = Column(Text, nullable=True)
    audio_filename = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
```

Modify `app/main.py` (full file):
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import Base, engine

app = FastAPI(title="Blog to Podcast Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/audio", StaticFiles(directory=settings.audio_dir), name="audio")


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest -v
```

Expected: PASS (both `test_health.py` and `test_models.py`).

- [ ] **Step 5: Commit**

```bash
git add app tests
git commit -m "Add SQLite Job model and JobStatus enum"
```

---

### Task 3: Pydantic schemas

**Files:**
- Create: `app/schemas.py`
- Create: `tests/test_schemas.py`

**Interfaces:**
- Consumes: `app.models.Job`, `app.models.JobStatus` (Task 2)
- Produces: `app.schemas.JobCreate` (`url: str`, `voice_id: str`), `app.schemas.JobCreateResponse` (`job_id: str`, `status: JobStatus`), `app.schemas.JobResponse` (`id, url, voice_id, status, summary_text, audio_filename, error_message, created_at, updated_at`), `app.schemas.VoiceOut` (`id: str`, `name: str`)

- [ ] **Step 1: Write the failing test**

`tests/test_schemas.py`:
```python
from app.database import SessionLocal
from app.models import Job, JobStatus
from app.schemas import JobResponse, VoiceOut


def test_job_response_from_orm(reset_db):
    db = SessionLocal()
    job = Job(url="https://example.com/post", voice_id="21m00Tcm4TlvDq8ikWAM")
    db.add(job)
    db.commit()
    db.refresh(job)

    response = JobResponse.model_validate(job)

    assert response.id == job.id
    assert response.status == JobStatus.pending
    assert response.summary_text is None

    db.close()


def test_voice_out_shape():
    voice = VoiceOut(id="21m00Tcm4TlvDq8ikWAM", name="Rachel")
    assert voice.id == "21m00Tcm4TlvDq8ikWAM"
    assert voice.name == "Rachel"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_schemas.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.schemas'`.

- [ ] **Step 3: Write the implementation**

`app/schemas.py`:
```python
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models import JobStatus


class JobCreate(BaseModel):
    url: str
    voice_id: str


class JobCreateResponse(BaseModel):
    job_id: str
    status: JobStatus


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    url: str
    voice_id: str
    status: JobStatus
    summary_text: Optional[str] = None
    audio_filename: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class VoiceOut(BaseModel):
    id: str
    name: str
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/schemas.py tests/test_schemas.py
git commit -m "Add Pydantic request/response schemas"
```

---

### Task 4: Preset voices and `GET /voices`

**Files:**
- Create: `app/voices.py`
- Create: `app/routers/__init__.py`
- Create: `app/routers/jobs.py`
- Create: `tests/test_voices.py`
- Modify: `app/main.py`

**Interfaces:**
- Consumes: `app.schemas.VoiceOut` (Task 3)
- Produces: `app.voices.PRESET_VOICES` (`list[dict]`, each `{"id": str, "name": str}`), `app.voices.is_valid_voice_id(voice_id: str) -> bool`
- Produces: `app.routers.jobs.router` (an `APIRouter`, mounted on `app.main.app`)

- [ ] **Step 1: Write the failing test**

`tests/test_voices.py`:
```python
def test_list_voices_returns_presets(client):
    response = client.get("/voices")
    assert response.status_code == 200
    body = response.json()
    assert len(body) > 0
    assert all({"id", "name"} <= set(voice.keys()) for voice in body)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_voices.py -v
```

Expected: FAIL — 404 Not Found (route doesn't exist yet).

- [ ] **Step 3: Write the implementation**

`app/voices.py`:
```python
PRESET_VOICES = [
    {"id": "21m00Tcm4TlvDq8ikWAM", "name": "Rachel"},
    {"id": "pNInz6obpgDQGcFmaJgB", "name": "Adam"},
    {"id": "EXAVITQu4vr4xnSDxMaL", "name": "Bella"},
    {"id": "ErXwobaYiN019PkySvjV", "name": "Antoni"},
]


def is_valid_voice_id(voice_id: str) -> bool:
    return any(voice["id"] == voice_id for voice in PRESET_VOICES)
```

`app/routers/__init__.py` (empty file).

`app/routers/jobs.py`:
```python
from fastapi import APIRouter

from app.schemas import VoiceOut
from app.voices import PRESET_VOICES

router = APIRouter()


@router.get("/voices", response_model=list[VoiceOut])
def list_voices():
    return PRESET_VOICES
```

Modify `app/main.py` (full file):
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import Base, engine
from app.routers.jobs import router as jobs_router

app = FastAPI(title="Blog to Podcast Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/audio", StaticFiles(directory=settings.audio_dir), name="audio")
app.include_router(jobs_router)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app tests/test_voices.py
git commit -m "Add preset voices and GET /voices"
```

---

### Task 5: `POST /jobs`, `GET /jobs`, `GET /jobs/{job_id}` (pipeline not wired yet)

**Files:**
- Modify: `app/routers/jobs.py`
- Create: `tests/test_jobs_api.py`

**Interfaces:**
- Consumes: `app.database.get_db`, `app.models.Job`, `app.schemas.JobCreate/JobCreateResponse/JobResponse`, `app.voices.is_valid_voice_id` (Tasks 2-4)
- Produces: `POST /jobs` → `JobCreateResponse`; `GET /jobs` → `list[JobResponse]`; `GET /jobs/{job_id}` → `JobResponse` or 404

- [ ] **Step 1: Write the failing test**

`tests/test_jobs_api.py`:
```python
VALID_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"


def test_create_job_returns_pending(client):
    response = client.post(
        "/jobs", json={"url": "https://example.com/post", "voice_id": VALID_VOICE_ID}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "pending"
    assert "job_id" in body


def test_create_job_rejects_unknown_voice(client):
    response = client.post(
        "/jobs", json={"url": "https://example.com/post", "voice_id": "not-a-voice"}
    )
    assert response.status_code == 400


def test_get_job_returns_full_state(client):
    create_response = client.post(
        "/jobs", json={"url": "https://example.com/post", "voice_id": VALID_VOICE_ID}
    )
    job_id = create_response.json()["job_id"]

    response = client.get(f"/jobs/{job_id}")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == job_id
    assert body["url"] == "https://example.com/post"
    assert body["status"] == "pending"


def test_get_job_404_for_unknown_id(client):
    response = client.get("/jobs/does-not-exist")
    assert response.status_code == 404


def test_list_jobs_most_recent_first(client):
    client.post("/jobs", json={"url": "https://example.com/a", "voice_id": VALID_VOICE_ID})
    client.post("/jobs", json={"url": "https://example.com/b", "voice_id": VALID_VOICE_ID})

    response = client.get("/jobs")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    assert body[0]["url"] == "https://example.com/b"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_jobs_api.py -v
```

Expected: FAIL — 404 Not Found (routes don't exist yet).

- [ ] **Step 3: Write the implementation**

Modify `app/routers/jobs.py` (full file):
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Job
from app.schemas import JobCreate, JobCreateResponse, JobResponse, VoiceOut
from app.voices import PRESET_VOICES, is_valid_voice_id

router = APIRouter()


@router.get("/voices", response_model=list[VoiceOut])
def list_voices():
    return PRESET_VOICES


@router.post("/jobs", response_model=JobCreateResponse)
def create_job(payload: JobCreate, db: Session = Depends(get_db)):
    if not is_valid_voice_id(payload.voice_id):
        raise HTTPException(status_code=400, detail="Unknown voice_id")

    job = Job(url=payload.url, voice_id=payload.voice_id)
    db.add(job)
    db.commit()
    db.refresh(job)

    return JobCreateResponse(job_id=job.id, status=job.status)


@router.get("/jobs", response_model=list[JobResponse])
def list_jobs(limit: int = 20, offset: int = 0, db: Session = Depends(get_db)):
    return (
        db.query(Job)
        .order_by(Job.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/routers/jobs.py tests/test_jobs_api.py
git commit -m "Add POST /jobs, GET /jobs, GET /jobs/{job_id}"
```

---

### Task 6: WebSocket `ConnectionManager` and `/ws/jobs/{job_id}`

**Files:**
- Create: `app/websockets.py`
- Modify: `app/routers/jobs.py`
- Create: `tests/test_websocket.py`

**Interfaces:**
- Consumes: `app.models.Job`, `app.models.JobStatus` (Task 2)
- Produces: `app.websockets.manager` (a `ConnectionManager` instance with `async connect(job_id: str, websocket: WebSocket)`, `disconnect(job_id: str, websocket: WebSocket)`, `async broadcast(job_id: str, message: dict)`), `app.websockets.build_job_message(job: Job) -> dict` (keys: `job_id, status, summary_text, audio_url, error_message`)
- Produces: `WS /ws/jobs/{job_id}` route, sends current DB state as the first message on connect

- [ ] **Step 1: Write the failing test**

`tests/test_websocket.py`:
```python
VALID_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"


def test_ws_sends_current_state_immediately(client):
    create_response = client.post(
        "/jobs", json={"url": "https://example.com/post", "voice_id": VALID_VOICE_ID}
    )
    job_id = create_response.json()["job_id"]

    with client.websocket_connect(f"/ws/jobs/{job_id}") as websocket:
        message = websocket.receive_json()

    assert message["job_id"] == job_id
    assert message["status"] == "pending"
    assert message["audio_url"] is None


def test_ws_unknown_job_sends_error_and_closes(client):
    with client.websocket_connect("/ws/jobs/does-not-exist") as websocket:
        message = websocket.receive_json()

    assert message == {"error": "job not found"}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_websocket.py -v
```

Expected: FAIL — connection rejected / 404 (route doesn't exist yet).

- [ ] **Step 3: Write the implementation**

`app/websockets.py`:
```python
from fastapi import WebSocket

from app.models import Job


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, job_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.setdefault(job_id, []).append(websocket)

    def disconnect(self, job_id: str, websocket: WebSocket) -> None:
        connections = self._connections.get(job_id, [])
        if websocket in connections:
            connections.remove(websocket)
        if not connections:
            self._connections.pop(job_id, None)

    async def broadcast(self, job_id: str, message: dict) -> None:
        for websocket in list(self._connections.get(job_id, [])):
            await websocket.send_json(message)


def build_job_message(job: Job) -> dict:
    return {
        "job_id": job.id,
        "status": job.status.value,
        "summary_text": job.summary_text,
        "audio_url": f"/audio/{job.audio_filename}" if job.audio_filename else None,
        "error_message": job.error_message,
    }


manager = ConnectionManager()
```

Modify `app/routers/jobs.py` (full file):
```python
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
)
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Job
from app.schemas import JobCreate, JobCreateResponse, JobResponse, VoiceOut
from app.voices import PRESET_VOICES, is_valid_voice_id
from app.websockets import build_job_message, manager

router = APIRouter()


@router.get("/voices", response_model=list[VoiceOut])
def list_voices():
    return PRESET_VOICES


@router.post("/jobs", response_model=JobCreateResponse)
def create_job(payload: JobCreate, db: Session = Depends(get_db)):
    if not is_valid_voice_id(payload.voice_id):
        raise HTTPException(status_code=400, detail="Unknown voice_id")

    job = Job(url=payload.url, voice_id=payload.voice_id)
    db.add(job)
    db.commit()
    db.refresh(job)

    return JobCreateResponse(job_id=job.id, status=job.status)


@router.get("/jobs", response_model=list[JobResponse])
def list_jobs(limit: int = 20, offset: int = 0, db: Session = Depends(get_db)):
    return (
        db.query(Job)
        .order_by(Job.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.websocket("/ws/jobs/{job_id}")
async def job_status_ws(
    websocket: WebSocket, job_id: str, db: Session = Depends(get_db)
):
    await manager.connect(job_id, websocket)
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job is None:
            await websocket.send_json({"error": "job not found"})
            await websocket.close()
            manager.disconnect(job_id, websocket)
            return

        await websocket.send_json(build_job_message(job))

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(job_id, websocket)
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/websockets.py app/routers/jobs.py tests/test_websocket.py
git commit -m "Add WebSocket ConnectionManager and /ws/jobs/{job_id}"
```

---

### Task 7: Pipeline orchestration wired into job creation

**Files:**
- Create: `app/pipeline.py`
- Modify: `app/routers/jobs.py`
- Create: `tests/test_pipeline.py`

**Interfaces:**
- Consumes: `app.database.SessionLocal`, `app.models.Job/JobStatus`, `app.websockets.manager/build_job_message`, `app.config.settings` (Tasks 2, 6, 1)
- Produces: `app.pipeline.scrape_blog(url: str) -> str`, `app.pipeline.summarize_content(content: str) -> str`, `app.pipeline.generate_audio(text: str, voice_id: str, job_id: str) -> str` (each independently monkeypatchable), `app.pipeline.run_pipeline(job_id: str) -> None` (async, scheduled via `BackgroundTasks`)

- [ ] **Step 1: Write the failing test**

`tests/test_pipeline.py`:
```python
import app.pipeline as pipeline

VALID_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"


def test_pipeline_happy_path(client, monkeypatch):
    monkeypatch.setattr(pipeline, "scrape_blog", lambda url: "raw blog content")
    monkeypatch.setattr(
        pipeline, "summarize_content", lambda content: "a short podcast script"
    )
    monkeypatch.setattr(
        pipeline, "generate_audio", lambda text, voice_id, job_id: f"{job_id}.mp3"
    )

    create_response = client.post(
        "/jobs", json={"url": "https://example.com/post", "voice_id": VALID_VOICE_ID}
    )
    job_id = create_response.json()["job_id"]

    response = client.get(f"/jobs/{job_id}")
    body = response.json()

    assert body["status"] == "done"
    assert body["summary_text"] == "a short podcast script"
    assert body["audio_filename"] == f"{job_id}.mp3"
    assert body["error_message"] is None


def test_pipeline_failure_sets_failed_status(client, monkeypatch):
    def boom(url):
        raise RuntimeError("scrape blew up")

    monkeypatch.setattr(pipeline, "scrape_blog", boom)

    create_response = client.post(
        "/jobs", json={"url": "https://example.com/post", "voice_id": VALID_VOICE_ID}
    )
    job_id = create_response.json()["job_id"]

    response = client.get(f"/jobs/{job_id}")
    body = response.json()

    assert body["status"] == "failed"
    assert body["error_message"] == "scrape blew up"


def test_ws_connect_after_completion_gets_final_state(client, monkeypatch):
    monkeypatch.setattr(pipeline, "scrape_blog", lambda url: "raw blog content")
    monkeypatch.setattr(
        pipeline, "summarize_content", lambda content: "a short podcast script"
    )
    monkeypatch.setattr(
        pipeline, "generate_audio", lambda text, voice_id, job_id: f"{job_id}.mp3"
    )

    create_response = client.post(
        "/jobs", json={"url": "https://example.com/post", "voice_id": VALID_VOICE_ID}
    )
    job_id = create_response.json()["job_id"]

    with client.websocket_connect(f"/ws/jobs/{job_id}") as websocket:
        message = websocket.receive_json()

    assert message["status"] == "done"
    assert message["audio_url"] == f"/audio/{job_id}.mp3"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_pipeline.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.pipeline'`.

- [ ] **Step 3: Write the implementation**

`app/pipeline.py`:
```python
from pathlib import Path

import ollama
from elevenlabs.client import ElevenLabs
from firecrawl import FirecrawlApp
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.database import SessionLocal
from app.models import Job, JobStatus
from app.websockets import build_job_message, manager

PODCAST_PROMPT_TEMPLATE = (
    "You are writing a short podcast narration script based on the blog post "
    "content below. Summarize it into a natural, spoken-style script a narrator "
    "could read aloud in 2-3 minutes. Do not include any headers, bullet points, "
    "or markdown formatting - just the spoken script text.\n\n"
    "Blog content:\n{content}"
)


def scrape_blog(url: str) -> str:
    client = FirecrawlApp(api_key=settings.firecrawl_api_key)
    result = client.scrape_url(url, params={"formats": ["markdown"]})
    return result["markdown"]


def summarize_content(content: str) -> str:
    client = ollama.Client(host=settings.ollama_host)
    response = client.chat(
        model=settings.ollama_model,
        messages=[
            {
                "role": "user",
                "content": PODCAST_PROMPT_TEMPLATE.format(content=content),
            }
        ],
    )
    return response["message"]["content"]


def generate_audio(text: str, voice_id: str, job_id: str) -> str:
    client = ElevenLabs(api_key=settings.eleven_labs_api_key)
    audio = client.text_to_speech.convert(
        voice_id=voice_id, text=text, model_id="eleven_multilingual_v2"
    )
    filename = f"{job_id}.mp3"
    filepath = Path(settings.audio_dir) / filename
    with open(filepath, "wb") as f:
        for chunk in audio:
            f.write(chunk)
    return filename


async def update_job_status(db: Session, job: Job, status: JobStatus, **fields) -> None:
    job.status = status
    for key, value in fields.items():
        setattr(job, key, value)
    db.commit()
    db.refresh(job)
    await manager.broadcast(job.id, build_job_message(job))


async def run_pipeline(job_id: str) -> None:
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job is None:
            return

        try:
            await update_job_status(db, job, JobStatus.scraping)
            content = await run_in_threadpool(scrape_blog, job.url)

            await update_job_status(db, job, JobStatus.summarizing)
            summary = await run_in_threadpool(summarize_content, content)

            await update_job_status(
                db, job, JobStatus.generating_audio, summary_text=summary
            )
            filename = await run_in_threadpool(
                generate_audio, summary, job.voice_id, job.id
            )

            await update_job_status(db, job, JobStatus.done, audio_filename=filename)
        except Exception as exc:
            await update_job_status(db, job, JobStatus.failed, error_message=str(exc))
    finally:
        db.close()
```

Modify `app/routers/jobs.py` — add the import and wire `create_job` to schedule the pipeline (full file):
```python
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
)
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Job
from app.pipeline import run_pipeline
from app.schemas import JobCreate, JobCreateResponse, JobResponse, VoiceOut
from app.voices import PRESET_VOICES, is_valid_voice_id
from app.websockets import build_job_message, manager

router = APIRouter()


@router.get("/voices", response_model=list[VoiceOut])
def list_voices():
    return PRESET_VOICES


@router.post("/jobs", response_model=JobCreateResponse)
def create_job(
    payload: JobCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if not is_valid_voice_id(payload.voice_id):
        raise HTTPException(status_code=400, detail="Unknown voice_id")

    job = Job(url=payload.url, voice_id=payload.voice_id)
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(run_pipeline, job.id)

    return JobCreateResponse(job_id=job.id, status=job.status)


@router.get("/jobs", response_model=list[JobResponse])
def list_jobs(limit: int = 20, offset: int = 0, db: Session = Depends(get_db)):
    return (
        db.query(Job)
        .order_by(Job.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.websocket("/ws/jobs/{job_id}")
async def job_status_ws(
    websocket: WebSocket, job_id: str, db: Session = Depends(get_db)
):
    await manager.connect(job_id, websocket)
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job is None:
            await websocket.send_json({"error": "job not found"})
            await websocket.close()
            manager.disconnect(job_id, websocket)
            return

        await websocket.send_json(build_job_message(job))

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(job_id, websocket)
```

Note: `test_create_job_returns_pending` (Task 5) posts a job and immediately asserts `status == "pending"` — once the pipeline is wired, `BackgroundTasks` still only *runs* after the response is constructed, so the returned `JobCreateResponse` body (captured before the background task executes) still reports `pending`. The *later* `GET /jobs/{job_id}` calls in Task 7's own tests see `done`/`failed` because by then the background task (awaited by the ASGI test transport before the HTTP response cycle completes) has already finished.

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest -v
```

Expected: PASS — full suite (all prior tasks' tests plus the three new pipeline tests).

- [ ] **Step 5: Commit**

```bash
git add app/pipeline.py app/routers/jobs.py tests/test_pipeline.py
git commit -m "Add scrape/summarize/generate_audio pipeline wired into POST /jobs"
```

---

### Task 8: Backend README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the README**

`README.md`:
```markdown
# Blog to Podcast — Backend

FastAPI backend that turns a blog URL into a narrated podcast episode: scrape it (Firecrawl), summarize it into a script with a local LLM (Ollama), and narrate it (ElevenLabs). Full architecture and design rationale: `docs/superpowers/specs/2026-07-27-blog-to-podcast-backend-design.md`.

## Setup

Prerequisites:
- Python 3.10+
- [Ollama](https://ollama.com) installed and running locally
- A Firecrawl API key
- An ElevenLabs API key (Text to Speech permission only)

\`\`\`bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

ollama pull llama3.2:latest

cp .env.example .env
# edit .env: set FIRECRAWL_API_KEY and ELEVEN_LABS_API_KEY

uvicorn app.main:app --reload --port 8000
\`\`\`

Visit http://localhost:8000/docs for interactive Swagger docs.

## Tests

\`\`\`bash
pytest -v
\`\`\`

All external calls (Firecrawl, Ollama, ElevenLabs) are mocked in tests — no live credentials or a running Ollama instance are required to run the suite.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | /health | Liveness check |
| GET | /voices | List preset narrator voices |
| POST | /jobs | Create a job: `{url, voice_id}` -> `{job_id, status}` |
| GET | /jobs | List past jobs (`limit`, `offset`) |
| GET | /jobs/{job_id} | Full current state of one job |
| WS | /ws/jobs/{job_id} | Live status updates; sends current state on connect |
| GET | /audio/{filename} | Static serving of generated audio |
```
(Write the file without the escaped backtick fences above — those are just to show the code block boundaries in this plan.)

- [ ] **Step 2: Run full test suite one more time**

```bash
pytest -v
```

Expected: PASS — full suite green.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Add backend README with setup and API reference"
```
