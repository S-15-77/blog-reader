import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useJobSocket } from "./useJobSocket";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  url: string;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  close() {}

  emitMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useJobSocket", () => {
  it("connects to the derived ws URL for the given job id", () => {
    renderHook(() => useJobSocket("abc123"));

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0].url).toBe(
      "ws://localhost:8000/ws/jobs/abc123"
    );
  });

  it("does not connect when jobId is null", () => {
    renderHook(() => useJobSocket(null));

    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it("updates state from incoming WebSocket messages", async () => {
    const { result } = renderHook(() => useJobSocket("abc123"));

    act(() => {
      FakeWebSocket.instances[0].emitMessage({
        job_id: "abc123",
        status: "summarizing",
        summary_text: null,
        audio_url: null,
        error_message: null,
      });
    });

    await waitFor(() => expect(result.current.status).toBe("summarizing"));
  });

  it("normalizes a WS audio_url into a full backend URL", async () => {
    const { result } = renderHook(() => useJobSocket("abc123"));

    act(() => {
      FakeWebSocket.instances[0].emitMessage({
        job_id: "abc123",
        status: "done",
        summary_text: "script",
        audio_url: "/audio/abc123.wav",
        error_message: null,
      });
    });

    await waitFor(() =>
      expect(result.current.audioUrl).toBe(
        "http://localhost:8000/audio/abc123.wav"
      )
    );
  });

  it("falls back to polling GET /jobs/{id} when the socket errors", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "abc123",
        url: "https://example.com/post",
        voice_id: "Samantha",
        status: "done",
        summary_text: "script",
        audio_filename: "abc123.wav",
        error_message: null,
        created_at: "2026-07-27T00:00:00Z",
        updated_at: "2026-07-27T00:01:00Z",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useJobSocket("abc123"));

    act(() => {
      FakeWebSocket.instances[0].onerror?.();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/jobs/abc123");
    expect(result.current.status).toBe("done");
    expect(result.current.audioUrl).toBe(
      "http://localhost:8000/audio/abc123.wav"
    );
  });

  it("shows a connectivity error after repeated polling failures", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useJobSocket("abc123"));

    act(() => {
      FakeWebSocket.instances[0].onerror?.();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000 * 3);
    });

    expect(result.current.errorMessage).toBe("Can't reach the server. Retrying...");
  });
});
