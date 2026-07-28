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
