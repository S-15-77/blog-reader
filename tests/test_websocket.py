import app.pipeline as pipeline

VALID_VOICE_ID = "Samantha"


def test_ws_sends_current_state_immediately(client, monkeypatch):
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

    assert message["job_id"] == job_id
    assert message["status"] == "done"
    assert message["audio_url"] == f"/audio/{job_id}.mp3"


def test_ws_unknown_job_sends_error_and_closes(client):
    with client.websocket_connect("/ws/jobs/does-not-exist") as websocket:
        message = websocket.receive_json()

    assert message == {"error": "job not found"}
