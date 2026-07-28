import app.pipeline as pipeline

VALID_VOICE_ID = "Samantha"


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


def test_get_job_returns_full_state(client, monkeypatch):
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
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == job_id
    assert body["url"] == "https://example.com/post"
    assert body["status"] == "done"


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
