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
