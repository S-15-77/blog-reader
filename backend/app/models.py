import enum
import uuid
from datetime import datetime, timezone

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
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
