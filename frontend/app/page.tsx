"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { createJob, getVoices } from "@/lib/api";
import { useJobSocket } from "@/hooks/useJobSocket";
import { UrlForm } from "@/components/UrlForm";
import { JobStatus } from "@/components/JobStatus";
import { AudioPlayer } from "@/components/AudioPlayer";
import type { Voice } from "@/lib/types";

export default function Home() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    getVoices()
      .then(setVoices)
      .catch(() => setVoices([]));
  }, []);

  const jobSocketState = useJobSocket(jobId);

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
    <main className="flex flex-col">
      <section className="relative isolate flex min-h-dvh flex-col overflow-hidden">
        <Image
          src="/assest/pixel-art-bg.jpeg"
          alt=""
          fill
          priority
          className="-z-10 object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-linear-to-b from-sky-950/15 via-transparent to-transparent" />

        <div className="mx-auto flex w-full max-w-2xl items-center gap-2.5 px-6 pt-6">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-accent shadow-sm">
            <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="none">
              <path
                d="M4 8v4M8 5v10M12 5v10M16 8v4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="text-sm font-semibold text-white">Blog to Podcast</span>
        </div>

        <div className="animate-fade-in-up mx-auto flex w-full max-w-2xl flex-col gap-2 px-6 pt-8 pb-6">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Blog to Podcast
          </h1>
          <p className="max-w-md text-base text-white/90">
            Paste a link, get back a narrated episode.
          </p>
        </div>

        <div
          className="animate-fade-in-up relative z-10 mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 pb-10"
          style={{ animationDelay: "80ms" }}
        >
          <UrlForm voices={voices} onSubmit={handleSubmit} disabled={isBusy} />
          {submitError && (
            <p
              role="alert"
              className="rounded-lg border border-danger/30 bg-white px-4 py-3 text-sm text-danger shadow-sm"
            >
              {submitError}
            </p>
          )}

          {jobSocketState.status !== null && (
            <JobStatus status={jobSocketState.status} errorMessage={jobSocketState.errorMessage} />
          )}

          {jobSocketState.status === "done" && jobSocketState.audioUrl && (
            <AudioPlayer audioUrl={jobSocketState.audioUrl} />
          )}
        </div>
      </section>
    </main>
  );
}
