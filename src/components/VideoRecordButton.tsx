import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { AudioEngine } from '../engine/audio/AudioEngine';
import { useVideoRecorder, type VideoTake } from '../engine/recording/useVideoRecorder';
import {
  listVideoRecordings,
  saveVideoRecording,
  deleteVideoRecording,
  watchUrl,
} from '../engine/recording/videoRecordingStore';
import { copyToClipboard } from '../utils/clipboard';

type Props = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  cameraVideoRef: RefObject<HTMLVideoElement | null>;
  engineRef: RefObject<AudioEngine | null>;
  /** Plan-gated (entitlements.maxVideoRecordMs). */
  maxDurationMs: number;
  /** Plan-gated (entitlements.recordingWatermark): burned in while recording. */
  watermark: boolean;
  /** Plan-gated (entitlements.maxRecordings). At the cap, free (1) replaces
      its recording automatically; bigger caps stop and point at the drawer. */
  maxRecordings: number;
};

// What happened to the finished take. "Saving" isn't a phase — it's derived
// from having a take with no phase yet.
type SavePhase =
  | { kind: 'shared'; url: string }
  | { kind: 'full'; take: VideoTake }
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
  canvasRef, cameraVideoRef, engineRef, maxDurationMs, watermark, maxRecordings,
}: Props) {
  const { state, elapsed, take, start, stop, clearTake } =
    useVideoRecorder(canvasRef, cameraVideoRef, engineRef, maxDurationMs, watermark);
  const [phase, setPhase] = useState<SavePhase | null>(null);
  const [copied, setCopied] = useState(false);
  // Latch so StrictMode's double effect run can't save the same take twice.
  const processedTakeRef = useRef<VideoTake | null>(null);

  // A finished take heads straight to storage. Signed-out / offline / at-cap
  // paths fall back to a plain device download — nobody loses a take.
  useEffect(() => {
    if (!take || processedTakeRef.current === take) return;
    processedTakeRef.current = take;
    void (async () => {
      const existing = await listVideoRecordings();
      if (existing === null) {
        // No account or no backend — the file is still theirs.
        downloadTake(take);
        setPhase({ kind: 'downloaded' });
        return;
      }
      if (existing.length >= maxRecordings) {
        if (maxRecordings === 1) {
          // Free rerecord contract: the old recording and its link die here.
          for (const rec of existing) await deleteVideoRecording(rec);
        } else {
          setPhase({ kind: 'full', take });
          return;
        }
      }
      const rec = await saveVideoRecording(take.blob, take.mime, take.durationMs);
      if (rec) {
        setPhase({ kind: 'shared', url: watchUrl(rec.id) });
      } else {
        downloadTake(take);
        setPhase({ kind: 'downloaded' });
      }
    })();
  }, [take, maxRecordings]);

  // "Saved to device" is a receipt, not a state to get stuck in.
  useEffect(() => {
    if (phase?.kind !== 'downloaded') return;
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

  if (phase?.kind === 'full') {
    return (
      <div className="vid-record-result">
        <button
          className="vid-record-btn vid-record-btn--done"
          onClick={() => { downloadTake(phase.take); reset(); }}
          title="All recording slots are used — delete one in your profile drawer to save new takes"
        >
          Slots full · ↓ Download
        </button>
        <button className="vid-record-dismiss" onClick={reset} aria-label="Discard">×</button>
      </div>
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
