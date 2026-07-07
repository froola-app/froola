import type { RefObject } from 'react';
import type { AudioEngine } from '../engine/audio/AudioEngine';
import { useVideoRecorder } from '../engine/recording/useVideoRecorder';

type Props = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  cameraVideoRef: RefObject<HTMLVideoElement | null>;
  engineRef: RefObject<AudioEngine | null>;
  maxDurationMs: number;
};

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function VideoRecordButton({ canvasRef, cameraVideoRef, engineRef, maxDurationMs }: Props) {
  const { state, elapsed, start, stop } = useVideoRecorder(canvasRef, cameraVideoRef, engineRef, maxDurationMs);

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
