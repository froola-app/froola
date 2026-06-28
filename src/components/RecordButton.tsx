import { useState } from 'react';
import type { RefObject } from 'react';
import type { GestureSignal } from '../engine/types';
import { useRecorder } from '../engine/recording/useRecorder';

type Props = {
  signalsRef: RefObject<GestureSignal[]>;
  vibe: string;
};

export default function RecordButton({ signalsRef, vibe }: Props) {
  const { state, elapsed, shareUrl, start, stop } = useRecorder(signalsRef, vibe);
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (state === 'idle') {
    return (
      <button className="record-btn record-btn--idle" onClick={start}>
        ● Rec
      </button>
    );
  }

  if (state === 'recording') {
    const pct = Math.min((elapsed / 30) * 100, 100);
    return (
      <>
        <div className="record-progress" style={{ width: `${pct}%` }} />
        <button className="record-btn record-btn--recording" onClick={stop}>
          ■ {Math.floor(elapsed)}s — Stop
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
