import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AudioPlayer } from "./AudioPlayer";

describe("AudioPlayer", () => {
  it("renders an audio element with the given source", () => {
    render(<AudioPlayer audioUrl="http://localhost:8000/audio/abc123.wav" />);

    const audio = document.querySelector("audio");
    expect(audio).toHaveAttribute("src", "http://localhost:8000/audio/abc123.wav");
  });

  it("renders a download link pointing at the same URL", () => {
    render(<AudioPlayer audioUrl="http://localhost:8000/audio/abc123.wav" />);

    expect(screen.getByRole("link", { name: "Download episode" })).toHaveAttribute(
      "href",
      "http://localhost:8000/audio/abc123.wav"
    );
  });
});
