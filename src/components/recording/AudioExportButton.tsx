import type { RefObject } from 'react';
import type { AudioEngine } from '../../engine/audio/AudioEngine';
import { useAudioExporter } from '../../engine/recording/useAudioExporter';
import LockBadge from '../LockBadge';

type Props = {
  engineRef: RefObject<AudioEngine | null>;
  maxDurationMs: number;
  /** Locked keeps the button visible as a teaser. */
  locked?: boolean;
  onLockedClick?: () => void;
};

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function AudioExportButton({ engineRef, maxDurationMs, locked, onLockedClick }: Props) {
  const { state, elapsed, start, stop } = useAudioExporter(engineRef, maxDurationMs);

  // Locked plans still see the control — it advertises what Plus unlocks and
  // opens the upgrade sheet instead of recording.
  if (locked) {
    return (
      <button className="audio-export-btn audio-export-btn--idle" onClick={onLockedClick}>
        ♪ MP3 <LockBadge />
      </button>
    );
  }

  if (state === 'idle') {
    return (
      <button className="audio-export-btn audio-export-btn--idle" onClick={start}>
        ♪ MP3
      </button>
    );
  }

  if (state === 'encoding') {
    return (
      <button className="audio-export-btn audio-export-btn--encoding" disabled>
        Encoding…
      </button>
    );
  }

  // recording
  const pct = Number.isFinite(maxDurationMs)
    ? Math.min((elapsed / (maxDurationMs / 1000)) * 100, 100)
    : 0;
  return (
    <>
      {pct > 0 && <div className="record-progress record-progress--audio" style={{ width: `${pct}%` }} />}
      <button className="audio-export-btn audio-export-btn--recording" onClick={stop}>
        <span className="rec-dot rec-dot--live" /> {formatTime(elapsed)} · Stop
      </button>
    </>
  );
}
