import { afterEach, describe, expect, it, vi } from "vitest";
import {
  audioUrlFromFilename,
  createJob,
  getJob,
  getVoices,
  listJobs,
} from "./api";

describe("api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getVoices fetches /voices and returns parsed JSON", async () => {
    const voices = [{ id: "Samantha", name: "Samantha (US)" }];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => voices,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getVoices();

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/voices");
    expect(result).toEqual(voices);
  });

  it("createJob posts url and voice_id as JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ job_id: "abc123", status: "pending" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createJob("https://example.com/post", "Samantha");

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/post",
        voice_id: "Samantha",
      }),
    });
    expect(result).toEqual({ job_id: "abc123", status: "pending" });
  });

  it("createJob throws with the backend's error detail on failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ detail: "Unknown voice_id" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createJob("https://example.com/post", "bogus")
    ).rejects.toThrow("Unknown voice_id");
  });

  it("getJob fetches /jobs/{id}", async () => {
    const job = {
      id: "abc123",
      url: "https://example.com/post",
      voice_id: "Samantha",
      status: "done",
      summary_text: "script",
      audio_filename: "abc123.wav",
      error_message: null,
      created_at: "2026-07-27T00:00:00Z",
      updated_at: "2026-07-27T00:01:00Z",
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => job });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getJob("abc123");

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/jobs/abc123");
    expect(result).toEqual(job);
  });

  it("listJobs fetches /jobs with limit and offset query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);

    await listJobs(10, 5);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/jobs?limit=10&offset=5"
    );
  });

  it("audioUrlFromFilename prefixes the API base URL", () => {
    expect(audioUrlFromFilename("abc123.wav")).toBe(
      "http://localhost:8000/audio/abc123.wav"
    );
  });
});
