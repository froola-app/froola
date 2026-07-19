import type { RefObject } from 'react';
import type { AudioEngine } from '../../engine/audio/AudioEngine';
import { useVideoRecorder } from '../../engine/recording/useVideoRecorder';
import LockBadge from '../LockBadge';

type Props = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  cameraVideoRef: RefObject<HTMLVideoElement | null>;
  engineRef: RefObject<AudioEngine | null>;
  maxDurationMs: number;
  /** Plan-gated: free downloads get "made with froola" burned in. */
  watermark?: boolean;
  /** Locked keeps the button visible as a teaser. */
  locked?: boolean;
  onLockedClick?: () => void;
};

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function VideoRecordButton({ canvasRef, cameraVideoRef, engineRef, maxDurationMs, watermark = false, locked, onLockedClick }: Props) {
  const { state, elapsed, start, stop } = useVideoRecorder(canvasRef, cameraVideoRef, engineRef, maxDurationMs, watermark);

  // Locked plans still see the control — it advertises what Plus unlocks and
  // opens the upgrade sheet instead of recording.
  if (locked) {
    return (
      <button className="vid-record-btn vid-record-btn--idle" onClick={onLockedClick}>
        <span className="rec-dot" /> Record video <LockBadge />
      </button>
    );
  }

  if (state === 'idle') {
    return (
      <button className="vid-record-btn vid-record-btn--idle" onClick={start}>
        <span className="rec-dot" /> Record video
      </button>
    );
  }

  if (state === 'requesting') {
    return (
      <button className="vid-record-btn vid-record-btn--requesting" disabled>
        Allow mic…
      </button>
    );
  }

  // recording — no progress bar when the plan has no length cap (Infinity)
  const pct = Number.isFinite(maxDurationMs)
    ? Math.min((elapsed / (maxDurationMs / 1000)) * 100, 100)
    : 0;
  return (
    <>
      {pct > 0 && <div className="record-progress record-progress--video" style={{ width: `${pct}%` }} />}
      <button className="vid-record-btn vid-record-btn--recording" onClick={stop}>
        <span className="rec-dot rec-dot--live" /> {formatTime(elapsed)} · Stop video
      </button>
    </>
  );
}
