import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JobStatus } from "./JobStatus";

describe("JobStatus", () => {
  it("renders nothing when there is no status yet", () => {
    const { container } = render(<JobStatus status={null} errorMessage={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("marks the current step active and earlier steps complete", () => {
    render(<JobStatus status="summarizing" errorMessage={null} />);

    expect(screen.getByText("Scraping the blog").closest("li")).toHaveAttribute(
      "data-state",
      "complete"
    );
    expect(screen.getByText("Writing the script").closest("li")).toHaveAttribute(
      "data-state",
      "active"
    );
    expect(screen.getByText("Narrating the episode").closest("li")).toHaveAttribute(
      "data-state",
      "pending"
    );
  });

  it("marks every step complete once done", () => {
    render(<JobStatus status="done" errorMessage={null} />);

    expect(screen.getByText("Done").closest("li")).toHaveAttribute(
      "data-state",
      "complete"
    );
  });

  it("renders the error message when failed", () => {
    render(<JobStatus status="failed" errorMessage="scrape blew up" />);

    expect(screen.getByRole("alert")).toHaveTextContent("scrape blew up");
  });

  it("shows a connectivity warning banner without losing the step list", () => {
    render(
      <JobStatus
        status="summarizing"
        errorMessage="Can't reach the server. Retrying..."
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Can't reach the server. Retrying..."
    );
    expect(screen.getByText("Writing the script")).toBeInTheDocument();
  });
});
