import { useState } from 'react';
import type { RefObject } from 'react';
import type { DialSelection } from '../engine/renderer';
import { useRecorder } from '../engine/recording/useRecorder';
import { copyToClipboard } from '../utils/clipboard';

type Props = {
  selectedRef: RefObject<DialSelection>;
  vibe: string;
  maxDurationMs: number;
};

export default function RecordButton({ selectedRef, vibe, maxDurationMs }: Props) {
  const { state, elapsed, shareUrl, start, stop } = useRecorder(selectedRef, vibe, maxDurationMs);
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (!shareUrl) return;
    await copyToClipboard(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (state === 'idle') {
    return (
      <button className="record-btn record-btn--idle" onClick={start}>
        <span className="rec-dot" /> Record
      </button>
    );
  }

  if (state === 'recording') {
    const pct = Math.min((elapsed / (maxDurationMs / 1000)) * 100, 100);
    return (
      <>
        <div className="record-progress" style={{ width: `${pct}%` }} />
        <button className="record-btn record-btn--recording" onClick={stop}>
          <span className="rec-dot rec-dot--live" /> Rec {Math.floor(elapsed)}s · Stop
        </button>
      </>
    );
  }

  // done
  return (
    <button className="record-btn record-btn--done" onClick={handleShare}>
      {copied ? 'Copied!' : '↗ Share replay'}
    </button>
  );
}
