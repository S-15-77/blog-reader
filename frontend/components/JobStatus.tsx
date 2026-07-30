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
      <div className="animate-fade-in-up rounded-2xl bg-surface p-6 shadow-md shadow-sky-900/5">
        <div
          role="alert"
          className="flex flex-col gap-1 rounded-xl border border-danger/30 bg-danger/10 p-4"
        >
          <p className="text-sm font-semibold text-danger">Something went wrong.</p>
          <p className="text-sm text-danger/90">{errorMessage}</p>
        </div>
      </div>
    );
  }

  const currentIndex = STEP_ORDER.indexOf(status);
  const completedCount = status === "done" ? STEPS.length : Math.max(currentIndex - 1, 0);

  return (
    <div className="animate-fade-in-up flex flex-col gap-4 rounded-2xl bg-surface p-6 shadow-md shadow-sky-900/5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {completedCount} of {STEPS.length} steps complete
      </p>

      {errorMessage && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-muted-foreground"
        >
          <svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none">
            <path
              d="M10 6v5m0 3h.01M2 10a8 8 0 1116 0 8 8 0 01-16 0z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          {errorMessage}
        </p>
      )}

      <ol className="flex flex-col gap-2">
        {STEPS.map((step, index) => {
          const stepIndex = STEP_ORDER.indexOf(step.status);
          const isComplete =
            stepIndex < currentIndex || (status === "done" && stepIndex === currentIndex);
          const isActive = stepIndex === currentIndex && status !== "done";
          const state = isComplete ? "complete" : isActive ? "active" : "pending";

          return (
            <li
              key={step.status}
              data-state={state}
              aria-current={isActive ? "step" : undefined}
              className={`flex items-center gap-3 rounded-full border px-4 py-2.5 transition-colors duration-300 ${
                isComplete
                  ? "border-green-200 bg-green-50 text-green-700"
                  : isActive
                    ? "border-sky-200 bg-sky-50 text-sky-700 shadow-sm"
                    : "border-border bg-background text-muted-foreground"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                  isComplete
                    ? "bg-green-500 text-white"
                    : isActive
                      ? "bg-accent text-white"
                      : "bg-border text-muted-foreground"
                }`}
              >
                {isComplete && (
                  <svg
                    aria-hidden="true"
                    className="h-3.5 w-3.5 animate-pop-in"
                    viewBox="0 0 20 20"
                    fill="none"
                  >
                    <path
                      d="M5 10l3 3 7-7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                {isActive && <span aria-hidden="true" className="waveform" />}
                {!isComplete && !isActive && index + 1}
              </span>
              <span className="text-sm font-medium">{step.label}</span>
              {isActive && <span className="ml-auto text-xs text-sky-600">In progress…</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
