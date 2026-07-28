type AudioPlayerProps = {
  audioUrl: string;
};

export function AudioPlayer({ audioUrl }: AudioPlayerProps) {
  return (
    <div>
      <audio controls src={audioUrl}>
        Your browser does not support the audio element.
      </audio>
      <a href={audioUrl} download>
        Download episode
      </a>
    </div>
  );
}
