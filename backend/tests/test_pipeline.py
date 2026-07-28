import app.pipeline as pipeline

VALID_VOICE_ID = "Samantha"


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
