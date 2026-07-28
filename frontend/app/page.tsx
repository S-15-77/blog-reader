"use client";

import { useCallback, useEffect, useState } from "react";
import { createJob, getVoices } from "@/lib/api";
import { useJobSocket } from "@/hooks/useJobSocket";
import { UrlForm } from "@/components/UrlForm";
import { JobStatus } from "@/components/JobStatus";
import { AudioPlayer } from "@/components/AudioPlayer";
import { HistoryPanel } from "@/components/HistoryPanel";
import type { Voice } from "@/lib/types";

export default function Home() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  useEffect(() => {
    getVoices()
      .then(setVoices)
      .catch(() => setVoices([]));
  }, []);

  const jobSocketState = useJobSocket(jobId);

  useEffect(() => {
    if (jobSocketState.status === "done" || jobSocketState.status === "failed") {
      setRefreshSignal((n) => n + 1);
    }
  }, [jobSocketState.status]);

  const handleSubmit = useCallback(async (url: string, voiceId: string) => {
    setSubmitError(null);
    try {
      const { job_id } = await createJob(url, voiceId);
      setJobId(job_id);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create job.");
    }
  }, []);

  const isBusy =
    jobSocketState.status !== null &&
    jobSocketState.status !== "done" &&
    jobSocketState.status !== "failed";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-16">
      <h1 className="text-4xl font-semibold">Blog to Podcast</h1>

      <UrlForm voices={voices} onSubmit={handleSubmit} disabled={isBusy} />
      {submitError && <p role="alert">{submitError}</p>}

      <JobStatus status={jobSocketState.status} errorMessage={jobSocketState.errorMessage} />

      {jobSocketState.status === "done" && jobSocketState.audioUrl && (
        <AudioPlayer audioUrl={jobSocketState.audioUrl} />
      )}

      <HistoryPanel refreshSignal={refreshSignal} />
    </main>
  );
}
