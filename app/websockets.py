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
