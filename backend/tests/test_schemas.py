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
