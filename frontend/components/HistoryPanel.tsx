"use client";

import { useEffect, useState } from "react";
import { listJobs } from "@/lib/api";
import type { Job } from "@/lib/types";

type HistoryPanelProps = {
  refreshSignal: number;
};

export function HistoryPanel({ refreshSignal }: HistoryPanelProps) {
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    let cancelled = false;
    listJobs().then((fetched) => {
      if (!cancelled) setJobs(fetched);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshSignal]);

  if (jobs.length === 0) {
    return <p>No episodes yet.</p>;
  }

  return (
    <ul>
      {jobs.map((job) => (
        <li key={job.id}>
          <span>{job.url}</span>
          <span data-state={job.status}>{job.status}</span>
        </li>
      ))}
    </ul>
  );
}
