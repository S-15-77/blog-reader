import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryPanel } from "./HistoryPanel";
import { listJobs } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  listJobs: vi.fn(),
}));

const mockedListJobs = vi.mocked(listJobs);

describe("HistoryPanel", () => {
  beforeEach(() => {
    mockedListJobs.mockReset();
  });

  it("shows a placeholder when there is no history yet", async () => {
    mockedListJobs.mockResolvedValue([]);

    render(<HistoryPanel refreshSignal={0} />);

    await waitFor(() =>
      expect(screen.getByText("No episodes yet.")).toBeInTheDocument()
    );
  });

  it("renders fetched jobs", async () => {
    mockedListJobs.mockResolvedValue([
      {
        id: "abc123",
        url: "https://example.com/post",
        voice_id: "Samantha",
        status: "done",
        summary_text: "script",
        audio_filename: "abc123.wav",
        error_message: null,
        created_at: "2026-07-27T00:00:00Z",
        updated_at: "2026-07-27T00:01:00Z",
      },
    ]);

    render(<HistoryPanel refreshSignal={0} />);

    await waitFor(() =>
      expect(screen.getByText("https://example.com/post")).toBeInTheDocument()
    );
  });

  it("refetches when refreshSignal changes", async () => {
    mockedListJobs.mockResolvedValue([]);

    const { rerender } = render(<HistoryPanel refreshSignal={0} />);
    await waitFor(() => expect(mockedListJobs).toHaveBeenCalledTimes(1));

    rerender(<HistoryPanel refreshSignal={1} />);
    await waitFor(() => expect(mockedListJobs).toHaveBeenCalledTimes(2));
  });
});
