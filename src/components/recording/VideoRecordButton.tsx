import { useState } from 'react';
import type { RefObject } from 'react';
import type { AudioEngine } from '../../engine/audio/AudioEngine';
import { useVideoRecorder } from '../../engine/recording/useVideoRecorder';
import { EXPORT_FORMATS, type ExportFormat } from '../../engine/recording/exportFrame';
import { copyToClipboard } from './clipboard';
import LockBadge from '../LockBadge';

type Props = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  cameraVideoRef: RefObject<HTMLVideoElement | null>;
  engineRef: RefObject<AudioEngine | null>;
  maxDurationMs: number;
  /** Plan-gated: free downloads get "made with froola" burned in. */
  watermark?: boolean;
  /** Live chord label for the portrait chip (optional). */
  getChordLabel?: () => string;
  /** Locked keeps the button visible as a teaser. */
  locked?: boolean;
  onLockedClick?: () => void;
};

const FORMAT_KEY = 'froola.exportFormat';
const CAPTION = 'made with froola · froolamusic.com';

function storedFormat(): ExportFormat {
  try {
    const v = localStorage.getItem(FORMAT_KEY);
    return (EXPORT_FORMATS as string[]).includes(v ?? '') ? (v as ExportFormat) : '9:16';
  } catch { return '9:16'; }
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function VideoRecordButton({ canvasRef, cameraVideoRef, engineRef, maxDurationMs, watermark = false, getChordLabel, locked, onLockedClick }: Props) {
  const [format, setFormat] = useState<ExportFormat>(storedFormat);
  const [doneLabel, setDoneLabel] = useState<string | null>(null);
  const { state, elapsed, start, stop, download, fileForShare, reset } =
    useVideoRecorder(canvasRef, cameraVideoRef, engineRef, maxDurationMs, watermark, format, getChordLabel);

  function pickFormat(f: ExportFormat) {
    setFormat(f);
    try { localStorage.setItem(FORMAT_KEY, f); } catch { /* private mode */ }
  }

  // Locked plans still see the control — it advertises what Plus unlocks and
  // opens the upgrade sheet instead of recording. No toggle while locked.
  if (locked) {
    return (
      <button className="vid-record-btn vid-record-btn--idle" onClick={onLockedClick}>
        <span className="rec-dot" /> Record video <LockBadge />
      </button>
    );
  }

  const toggle = (
    <div className="export-format-toggle" role="radiogroup" aria-label="Export format">
      {EXPORT_FORMATS.map(f => (
        <button
          key={f}
          role="radio"
          aria-checked={format === f}
          className={`export-format-opt${format === f ? ' is-active' : ''}`}
          disabled={state === 'recording' || state === 'requesting'}
          onClick={() => pickFormat(f)}
        >
          {f}
        </button>
      ))}
    </div>
  );

  async function handleShare() {
    const file = fileForShare();
    if (!file) return;
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      try {
        await nav.share({ files: [file], text: CAPTION });
        reset();
      } catch { /* user cancelled the sheet — stay in done state */ }
      return;
    }
    download();
    const copied = await copyToClipboard(CAPTION);
    setDoneLabel(copied ? 'Saved · caption copied' : 'Saved');
    setTimeout(() => { setDoneLabel(null); reset(); }, 1500);
  }

  if (state === 'idle') {
    return (
      <>
        <button className="vid-record-btn vid-record-btn--idle" onClick={start}>
          <span className="rec-dot" /> Record video
        </button>
        {toggle}
      </>
    );
  }

  if (state === 'requesting') {
    return (
      <>
        <button className="vid-record-btn vid-record-btn--requesting" disabled>
          Allow mic…
        </button>
        {toggle}
      </>
    );
  }

  if (state === 'done') {
    return (
      <>
        <button className="vid-record-btn vid-record-btn--done" onClick={handleShare} aria-label="Share video">
          {doneLabel ?? '↗ Share video'}
        </button>
        <button
          className="vid-record-btn vid-record-btn--done"
          onClick={() => { download(); reset(); }}
          aria-label="Download video"
        >
          ↓
        </button>
        {toggle}
      </>
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
      {toggle}
    </>
  );
}
