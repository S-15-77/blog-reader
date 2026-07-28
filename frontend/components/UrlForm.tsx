"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Voice } from "@/lib/types";

type UrlFormProps = {
  voices: Voice[];
  onSubmit: (url: string, voiceId: string) => void;
  disabled?: boolean;
};

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
    <form onSubmit={handleSubmit}>
      <label htmlFor="blog-url">Blog URL</label>
      <input
        id="blog-url"
        type="text"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        disabled={disabled}
      />

      <label htmlFor="voice">Narrator voice</label>
      <select
        id="voice"
        value={voiceId}
        onChange={(event) => setVoiceId(event.target.value)}
        disabled={disabled}
      >
        {voices.map((voice) => (
          <option key={voice.id} value={voice.id}>
            {voice.name}
          </option>
        ))}
      </select>

      {validationError && <p role="alert">{validationError}</p>}

      <button type="submit" disabled={disabled}>
        Make a podcast
      </button>
    </form>
  );
}
