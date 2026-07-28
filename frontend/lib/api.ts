import type { Job, JobCreateResponse, Voice } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function getVoices(): Promise<Voice[]> {
  const response = await fetch(`${API_URL}/voices`);
  if (!response.ok) {
    throw new Error(`Failed to load voices: ${response.status}`);
  }
  return response.json();
}

export async function createJob(
  url: string,
  voiceId: string
): Promise<JobCreateResponse> {
  const response = await fetch(`${API_URL}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, voice_id: voiceId }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to create job: ${response.status}`);
  }
  return response.json();
}

export async function getJob(jobId: string): Promise<Job> {
  const response = await fetch(`${API_URL}/jobs/${jobId}`);
  if (!response.ok) {
    throw new Error(`Failed to load job: ${response.status}`);
  }
  return response.json();
}

export async function listJobs(limit = 20, offset = 0): Promise<Job[]> {
  const response = await fetch(`${API_URL}/jobs?limit=${limit}&offset=${offset}`);
  if (!response.ok) {
    throw new Error(`Failed to load jobs: ${response.status}`);
  }
  return response.json();
}

export function audioUrlFromFilename(filename: string): string {
  return `${API_URL}/audio/${filename}`;
}
