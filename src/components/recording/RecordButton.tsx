import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { DialSelection } from '../../engine/renderer';
import { useRecorder } from '../../engine/recording/useRecorder';
import { listRecordings } from '../../engine/recording/recordingStore';
import { copyToClipboard } from './clipboard';
import LockBadge from '../LockBadge';

type Props = {
  selectedRef: RefObject<DialSelection>;
  vibe: string;
  maxDurationMs: number;
  /** Plan-gated: free replays play back with a "made with froola" overlay. */
  watermark?: boolean;
  /** Plan-gated (ent.maxSavedRecordings): how many saved rows this user may
   *  hold; starting a take past the cap prompts a replace confirm. */
  maxSavedRecordings: number;
  /** Locked keeps the button visible as a teaser (Plus unlocks recording). */
  locked?: boolean;
  onLockedClick?: () => void;
};

export default function RecordButton({ selectedRef, vibe, maxDurationMs, watermark = true, maxSavedRecordings, locked, onLockedClick }: Props) {
  const { state, elapsed, shareUrl, start, stop, saveTick } = useRecorder(selectedRef, vibe, maxDurationMs, watermark, maxSavedRecordings);
  const [copied, setCopied] = useState(false);
  const [held, setHeld] = useState(0);

  // Refreshes on mount and again whenever a save settles (saveTick bumps
  // after stop()'s async save resolves/rejects) — `state` flips to 'done'
  // synchronously before the save lands, so keying off state alone would
  // usually read the pre-save count.
  useEffect(() => {
    if (locked) return;
    let alive = true;
    void listRecordings().then(rs => {
      if (alive) setHeld(rs.length);
    });
    return () => { alive = false; };
  }, [saveTick, locked]);

  function handleStart() {
    if (held >= maxSavedRecordings &&
        !window.confirm('This replaces your previous recording — the old link will stop working.')) {
      return;
    }
    start();
  }

  // Locked plans still see the control — it advertises what Plus unlocks and
  // opens the upgrade sheet instead of recording.
  if (locked) {
    return (
      <button className="record-btn record-btn--idle" onClick={onLockedClick}>
        <span className="rec-dot" /> Record <LockBadge />
      </button>
    );
  }

  async function handleShare() {
    if (!shareUrl) return;
    await copyToClipboard(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (state === 'idle') {
    return (
      <button className="record-btn record-btn--idle" onClick={handleStart}>
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
