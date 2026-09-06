import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { AudioEngine } from '../engine/audio/AudioEngine';
import { useVideoRecorder, type VideoTake } from '../engine/recording/useVideoRecorder';
import { saveVideoRecording, watchUrl } from '../engine/recording/videoRecordingStore';
import { copyToClipboard } from '../utils/clipboard';

type Props = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  cameraVideoRef: RefObject<HTMLVideoElement | null>;
  engineRef: RefObject<AudioEngine | null>;
  /** Technical ceiling, not a plan one (capabilities.maxVideoRecordMs). */
  maxDurationMs: number;
};

// What happened to the finished take. "Saving" isn't a phase — it's derived
// from having a take with no phase yet.
type SavePhase =
  | { kind: 'shared'; url: string }
  | { kind: 'kept' }
  | { kind: 'downloaded' };

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function downloadTake(take: VideoTake) {
  const url = URL.createObjectURL(take.blob);
  const a = document.createElement('a');
  a.href = url;
  const ext = take.mime === 'video/mp4' ? 'mp4' : 'webm';
  a.download = `froola-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function VideoRecordButton({
  canvasRef, cameraVideoRef, engineRef, maxDurationMs,
}: Props) {
  const { state, elapsed, take, start, stop, clearTake } =
    useVideoRecorder(canvasRef, cameraVideoRef, engineRef, maxDurationMs);
  const [phase, setPhase] = useState<SavePhase | null>(null);
  const [copied, setCopied] = useState(false);
  // Latch so StrictMode's double effect run can't save the same take twice.
  const processedTakeRef = useRef<VideoTake | null>(null);

  // A finished take heads straight to storage: the cloud when signed in, this
  // device otherwise. If neither works the file still gets downloaded, so
  // nobody ever loses a take. Nothing is capped and nothing is overwritten.
  useEffect(() => {
    if (!take || processedTakeRef.current === take) return;
    processedTakeRef.current = take;
    void (async () => {
      const rec = await saveVideoRecording(take.blob, take.mime, take.durationMs);
      if (rec?.userId) setPhase({ kind: 'shared', url: watchUrl(rec.id) });
      else if (rec) setPhase({ kind: 'kept' });
      else {
        downloadTake(take);
        setPhase({ kind: 'downloaded' });
      }
    })();
  }, [take]);

  // "Saved" is a receipt, not a state to get stuck in.
  useEffect(() => {
    if (phase?.kind !== 'downloaded' && phase?.kind !== 'kept') return;
    const t = setTimeout(() => { setPhase(null); clearTake(); }, 2500);
    return () => clearTimeout(t);
  }, [phase, clearTake]);

  const reset = () => { setPhase(null); clearTake(); setCopied(false); };

  if (take && !phase) {
    return (
      <button className="vid-record-btn vid-record-btn--requesting" disabled>
        Saving…
      </button>
    );
  }

  if (phase?.kind === 'shared') {
    return (
      <div className="vid-record-result">
        <button
          className="vid-record-btn vid-record-btn--done"
          onClick={async () => {
            await copyToClipboard(phase.url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? 'Copied!' : '↗ Share link'}
        </button>
        <button className="vid-record-dismiss" onClick={reset} aria-label="Done sharing">×</button>
      </div>
    );
  }

  if (phase?.kind === 'kept') {
    return (
      <button className="vid-record-btn vid-record-btn--idle" disabled>
        Saved to this device
      </button>
    );
  }

  if (phase?.kind === 'downloaded') {
    return (
      <button className="vid-record-btn vid-record-btn--idle" disabled>
        Saved to device
      </button>
    );
  }

  if (state === 'idle') {
    return (
      <button className="vid-record-btn vid-record-btn--idle" onClick={start}>
        <span className="rec-dot" /> Record
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

  // recording
  const pct = Number.isFinite(maxDurationMs)
    ? Math.min((elapsed / (maxDurationMs / 1000)) * 100, 100)
    : 0;
  return (
    <>
      {pct > 0 && <div className="record-progress record-progress--video" style={{ width: `${pct}%` }} />}
      <button className="vid-record-btn vid-record-btn--recording" onClick={stop}>
        <span className="rec-dot rec-dot--live" /> {formatTime(elapsed)} · Stop
      </button>
    </>
  );
}
