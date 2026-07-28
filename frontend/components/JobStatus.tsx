import type { JobStatus as JobStatusValue } from "@/lib/types";

const STEPS: { status: JobStatusValue; label: string }[] = [
  { status: "scraping", label: "Scraping the blog" },
  { status: "summarizing", label: "Writing the script" },
  { status: "generating_audio", label: "Narrating the episode" },
  { status: "done", label: "Done" },
];

const STEP_ORDER: JobStatusValue[] = [
  "pending",
  "scraping",
  "summarizing",
  "generating_audio",
  "done",
];

type JobStatusProps = {
  status: JobStatusValue | null;
  errorMessage: string | null;
};

export function JobStatus({ status, errorMessage }: JobStatusProps) {
  if (status === null) {
    return null;
  }

  if (status === "failed") {
    return (
      <div role="alert">
        <p>Something went wrong.</p>
        <p>{errorMessage}</p>
      </div>
    );
  }

  const currentIndex = STEP_ORDER.indexOf(status);

  return (
    <div>
      {errorMessage && <p role="alert">{errorMessage}</p>}
      <ol>
        {STEPS.map((step) => {
          const stepIndex = STEP_ORDER.indexOf(step.status);
          const isComplete =
            stepIndex < currentIndex || (status === "done" && stepIndex === currentIndex);
          const isActive = stepIndex === currentIndex && status !== "done";

          return (
            <li
              key={step.status}
              data-state={isComplete ? "complete" : isActive ? "active" : "pending"}
            >
              {isActive && <span aria-hidden="true" className="waveform" />}
              {step.label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
