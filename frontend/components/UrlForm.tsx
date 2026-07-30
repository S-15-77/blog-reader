"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Voice } from "@/lib/types";

type UrlFormProps = {
  voices: Voice[];
  onSubmit: (url: string, voiceId: string) => void;
  disabled?: boolean;
};

const fieldClass =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-base text-foreground placeholder:text-muted-foreground transition-colors duration-150 focus:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60";

export function UrlForm({ voices, onSubmit, disabled }: UrlFormProps) {
  const [url, setUrl] = useState("");
  const [voiceId, setVoiceId] = useState(voices[0]?.id ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!voiceId && voices.length > 0) {
      setVoiceId(voices[0].id);
    }
  }, [voices, voiceId]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!url.trim()) {
      setValidationError("Enter a blog URL.");
      return;
    }
    setValidationError(null);
    onSubmit(url.trim(), voiceId);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-2xl bg-surface p-6 shadow-xl shadow-sky-900/10 transition-shadow duration-200 hover:shadow-2xl sm:p-8"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="blog-url" className="text-sm font-medium text-foreground">
          Blog URL
        </label>
        <div className="relative">
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            viewBox="0 0 20 20"
            fill="none"
          >
            <path
              d="M7.5 12.5l5-5M8.5 5.5l.53-.53a3 3 0 114.24 4.24l-1.5 1.5m-3.5 3.5l-.53.53a3 3 0 11-4.24-4.24l1.5-1.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <input
            id="blog-url"
            type="text"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            disabled={disabled}
            placeholder="https://example.com/article"
            className={`${fieldClass} pl-9`}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="voice" className="text-sm font-medium text-foreground">
          Narrator voice
        </label>
        <div className="relative">
          <select
            id="voice"
            value={voiceId}
            onChange={(event) => setVoiceId(event.target.value)}
            disabled={disabled}
            className={`${fieldClass} appearance-none pr-9`}
          >
            {voices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name}
              </option>
            ))}
          </select>
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            viewBox="0 0 20 20"
            fill="none"
          >
            <path
              d="M5 7.5l5 5 5-5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {validationError && (
        <p role="alert" className="animate-shake text-sm text-danger">
          {validationError}
        </p>
      )}

      <button
        type="submit"
        disabled={disabled}
        className="mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md active:translate-y-0 active:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:translate-y-0 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
      >
        {disabled && (
          <svg
            aria-hidden="true"
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeOpacity="0.25"
            />
            <path
              d="M22 12a10 10 0 0 0-10-10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        )}
        Make a podcast
      </button>
    </form>
  );
}
