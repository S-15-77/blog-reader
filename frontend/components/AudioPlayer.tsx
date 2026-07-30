type AudioPlayerProps = {
  audioUrl: string;
};

export function AudioPlayer({ audioUrl }: AudioPlayerProps) {
  return (
    <div className="animate-fade-in-up flex flex-col gap-4 rounded-2xl border border-green-200 bg-surface p-6 shadow-md shadow-sky-900/5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500 text-white shadow-sm">
          <span aria-hidden="true" className="waveform" />
        </span>
        <div className="flex flex-col">
          <p className="text-sm font-semibold text-foreground">Your episode is ready</p>
          <p className="text-xs text-muted-foreground">Listen below or download the file</p>
        </div>
      </div>
      <audio controls src={audioUrl} className="w-full">
        Your browser does not support the audio element.
      </audio>
      <a
        href={audioUrl}
        download
        className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-all duration-150 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="none">
          <path
            d="M10 3v10m0 0l-4-4m4 4l4-4M4 16h12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Download episode
      </a>
    </div>
  );
}
