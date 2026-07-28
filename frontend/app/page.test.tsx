import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";
import { createJob, getVoices, listJobs } from "@/lib/api";
import { useJobSocket } from "@/hooks/useJobSocket";

vi.mock("@/lib/api", () => ({
  getVoices: vi.fn(),
  createJob: vi.fn(),
  listJobs: vi.fn(),
}));

vi.mock("@/hooks/useJobSocket", () => ({
  useJobSocket: vi.fn(),
}));

const mockedGetVoices = vi.mocked(getVoices);
const mockedCreateJob = vi.mocked(createJob);
const mockedListJobs = vi.mocked(listJobs);
const mockedUseJobSocket = vi.mocked(useJobSocket);

describe("Home", () => {
  beforeEach(() => {
    mockedGetVoices.mockResolvedValue([{ id: "Samantha", name: "Samantha (US)" }]);
    mockedListJobs.mockResolvedValue([]);
    mockedUseJobSocket.mockReturnValue({
      status: null,
      summaryText: null,
      audioUrl: null,
      errorMessage: null,
    });
  });

  it("renders the heading and loads voices into the form", async () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Blog to Podcast" })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Samantha (US)" })).toBeInTheDocument()
    );
  });

  it("creates a job when the form is submitted", async () => {
    mockedCreateJob.mockResolvedValue({ job_id: "abc123", status: "pending" });
    const user = userEvent.setup();
    render(<Home />);

    await waitFor(() => expect(screen.getByLabelText("Blog URL")).toBeEnabled());
    await user.type(screen.getByLabelText("Blog URL"), "https://example.com/post");
    await user.click(screen.getByRole("button", { name: "Make a podcast" }));

    await waitFor(() =>
      expect(mockedCreateJob).toHaveBeenCalledWith(
        "https://example.com/post",
        "Samantha"
      )
    );
  });

  it("shows the audio player once the job is done", async () => {
    mockedUseJobSocket.mockReturnValue({
      status: "done",
      summaryText: "script",
      audioUrl: "http://localhost:8000/audio/abc123.wav",
      errorMessage: null,
    });

    render(<Home />);

    await waitFor(() =>
      expect(document.querySelector("audio")).toHaveAttribute(
        "src",
        "http://localhost:8000/audio/abc123.wav"
      )
    );
  });

  it("shows a submit error inline if job creation fails", async () => {
    mockedCreateJob.mockRejectedValue(new Error("Unknown voice_id"));
    const user = userEvent.setup();
    render(<Home />);

    await waitFor(() => expect(screen.getByLabelText("Blog URL")).toBeEnabled());
    await user.type(screen.getByLabelText("Blog URL"), "https://example.com/post");
    await user.click(screen.getByRole("button", { name: "Make a podcast" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Unknown voice_id")
    );
  });
});
