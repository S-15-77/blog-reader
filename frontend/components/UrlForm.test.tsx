import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UrlForm } from "./UrlForm";

const VOICES = [
  { id: "Samantha", name: "Samantha (US)" },
  { id: "Daniel", name: "Daniel (UK)" },
];

describe("UrlForm", () => {
  it("renders voice options from props", () => {
    render(<UrlForm voices={VOICES} onSubmit={vi.fn()} />);

    expect(screen.getByRole("option", { name: "Samantha (US)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Daniel (UK)" })).toBeInTheDocument();
  });

  it("calls onSubmit with the entered url and selected voice", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    render(<UrlForm voices={VOICES} onSubmit={handleSubmit} />);

    await user.type(screen.getByLabelText("Blog URL"), "https://example.com/post");
    await user.selectOptions(screen.getByLabelText("Narrator voice"), "Daniel");
    await user.click(screen.getByRole("button", { name: "Make a podcast" }));

    expect(handleSubmit).toHaveBeenCalledWith("https://example.com/post", "Daniel");
  });

  it("shows a validation message and does not submit for an empty URL", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    render(<UrlForm voices={VOICES} onSubmit={handleSubmit} />);

    await user.click(screen.getByRole("button", { name: "Make a podcast" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a blog URL.");
    expect(handleSubmit).not.toHaveBeenCalled();
  });
});
