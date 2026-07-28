"use client";

import { useEffect, useState } from "react";
import { API_URL, audioUrlFromFilename, getJob } from "@/lib/api";
import type { JobStatus } from "@/lib/types";

const POLL_INTERVAL_MS = 3000;
const TERMINAL_STATUSES: JobStatus[] = ["done", "failed"];

export type JobSocketState = {
  status: JobStatus | null;
  summaryText: string | null;
  audioUrl: string | null;
  errorMessage: string | null;
};

const IDLE_STATE: JobSocketState = {
  status: null,
  summaryText: null,
  audioUrl: null,
  errorMessage: null,
};

function isTerminal(status: JobStatus | null): boolean {
  return status !== null && TERMINAL_STATUSES.includes(status);
}

export function useJobSocket(jobId: string | null): JobSocketState {
  const [state, setState] = useState<JobSocketState>(IDLE_STATE);

  useEffect(() => {
    if (!jobId) {
      setState(IDLE_STATE);
      return;
    }

    setState(IDLE_STATE);
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let terminal = false;

    const startPolling = () => {
      if (pollTimer || terminal) return;
      let consecutiveFailures = 0;
      pollTimer = setInterval(async () => {
        try {
          const job = await getJob(jobId);
          consecutiveFailures = 0;
          terminal = isTerminal(job.status);
          setState({
            status: job.status,
            summaryText: job.summary_text,
            audioUrl: job.audio_filename
              ? audioUrlFromFilename(job.audio_filename)
              : null,
            errorMessage: job.error_message,
          });
          if (terminal && pollTimer) {
            clearInterval(pollTimer);
            pollTimer = undefined;
          }
        } catch {
          consecutiveFailures += 1;
          if (consecutiveFailures >= 3) {
            setState((prev) => ({
              ...prev,
              errorMessage: "Can't reach the server. Retrying...",
            }));
          }
        }
      }, POLL_INTERVAL_MS);
    };

    const wsUrl = `${API_URL.replace(/^http/, "ws")}/ws/jobs/${jobId}`;
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event: { data: string }) => {
      const message = JSON.parse(event.data) as {
        status: JobStatus;
        summary_text: string | null;
        audio_url: string | null;
        error_message: string | null;
      };
      terminal = isTerminal(message.status);
      setState({
        status: message.status,
        summaryText: message.summary_text,
        audioUrl: message.audio_url ? `${API_URL}${message.audio_url}` : null,
        errorMessage: message.error_message,
      });
    };

    socket.onerror = () => {
      startPolling();
    };

    socket.onclose = () => {
      if (!terminal) {
        startPolling();
      }
    };

    return () => {
      socket.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [jobId]);

  return state;
}
