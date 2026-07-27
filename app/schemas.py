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
