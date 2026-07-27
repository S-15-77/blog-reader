def test_list_voices_returns_presets(client):
    response = client.get("/voices")
    assert response.status_code == 200
    body = response.json()
    assert len(body) > 0
    assert all({"id", "name"} <= set(voice.keys()) for voice in body)
