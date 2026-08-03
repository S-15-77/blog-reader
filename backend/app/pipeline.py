import subprocess
from pathlib import Path

import ollama
from firecrawl import Firecrawl
from openai import OpenAI
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.database import SessionLocal
from app.models import Job, JobStatus
from app.websockets import build_job_message, manager

PODCAST_PROMPT_TEMPLATE = (
    "You are an expert podcast scriptwriter. Your task is to transform the blog post "
    "below into a highly engaging, natural-sounding narration script"
    "to read aloud.\n\n"
    "Strictly adhere to the following rules:\n"
    "1. Keyword Retention: You must identify and seamlessly integrate the exact keywords "
    "and core terminology used in the original text.\n"
    "2. Strict Accuracy: Do not hallucinate or add outside information. The script must "
    "perfectly match the facts, claims, and core message of the original blog post.\n"
    "3. Listener-Friendly: Write for the ear, not the eye. Use accessible, conversational "
    "language that is easy for a general audience to understand immediately.\n"
    "4. Pure Audio Format: Output ONLY the spoken words. Absolutely no headers, bullet "
    "points, markdown formatting, speaker labels, or sound effect cues. Provide plain "
    "text that is ready for a Text-to-Speech engine.\n\n"
    "Blog content:\n{content}"
)

NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"


def scrape_blog(url: str) -> str:
    client = Firecrawl(api_key=settings.firecrawl_api_key)
    document = client.scrape(url, formats=["markdown"])
    return document.markdown


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


def summarize_content_nvidia(content: str) -> str:
    client = OpenAI(base_url=NVIDIA_BASE_URL, api_key=settings.nvidia_api_key)
    response = client.chat.completions.create(
        model=settings.nvidia_model,
        messages=[
            {
                "role": "user",
                "content": PODCAST_PROMPT_TEMPLATE.format(content=content),
            }
        ],
    )
    return response.choices[0].message.content


# ponytail: macOS `say` command only - free, offline, no API key, but
# Mac-specific. Swap for a cross-platform TTS (e.g. Coqui, edge-tts) if this
# ever needs to run on Linux/Windows.
def generate_audio(text: str, voice_id: str, job_id: str) -> str:
    filename = f"{job_id}.wav"
    filepath = Path(settings.audio_dir) / filename
    subprocess.run(
        ["say", "-v", voice_id, "-o", str(filepath), "--data-format=LEI16@22050", text],
        check=True,
    )
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
            if settings.llm_provider == "nvidia":
                summary = await run_in_threadpool(summarize_content_nvidia, content)
            else:
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
