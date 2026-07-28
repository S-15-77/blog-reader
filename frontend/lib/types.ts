export type JobStatus =
  | "pending"
  | "scraping"
  | "summarizing"
  | "generating_audio"
  | "done"
  | "failed";

export type Voice = {
  id: string;
  name: string;
};

export type Job = {
  id: string;
  url: string;
  voice_id: string;
  status: JobStatus;
  summary_text: string | null;
  audio_filename: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type JobCreateResponse = {
  job_id: string;
  status: JobStatus;
};

export type JobSocketMessage = {
  job_id: string;
  status: JobStatus;
  summary_text: string | null;
  audio_url: string | null;
  error_message: string | null;
};
