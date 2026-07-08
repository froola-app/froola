import { useRef, useState, useCallback, useEffect } from 'react';
import type { RefObject } from 'react';
import type { RecordingSample, Recording } from '../types';
import type { DialSelection } from '../renderer';
import { encode } from './codec';
import { saveRecording } from './recordingStore';

const VIBES = ['warm', 'bright', 'dark', 'electric'];
const DEFAULT_MAX_DURATION_MS = 30_000;
const INTERVAL_MS = 100;

export type RecorderState = 'idle' | 'recording' | 'done';

// Records the angle-derived note/quality selection the audio path actually
// plays (selectedRef, published by the renderer) — not the raw hand x — so a
// replay reproduces exactly what was heard.
export function useRecorder(
  selectedRef: RefObject<DialSelection>,
  vibe: string,
  // Plan-gated (see src/entitlements.ts maxReplayRecordMs).
  maxDurationMs: number = DEFAULT_MAX_DURATION_MS,
  // Plan-gated (replayWatermark): free replays play back watermarked.
  watermark: boolean = true,
) {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const samplesRef = useRef<RecordingSample[]>([]);
  const startTimeRef = useRef(0);
  const lastSampleTimeRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vibeRef = useRef(vibe);
  // Bumped on every start() so a slow save from a previous take can't
  // overwrite the shareUrl of the recording that replaced it.
  const takeRef = useRef(0);

  useEffect(() => { vibeRef.current = vibe; }, [vibe]);

  const watermarkRef = useRef(watermark);
  useEffect(() => { watermarkRef.current = watermark; }, [watermark]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // Ensure at least one sample so the encoded payload is non-empty.
    const samples = samplesRef.current.length > 0
      ? samplesRef.current
      : [{ dt: 0, noteIdx: 0, qualityIdx: 0, vibe: 0 }];
    const recording: Recording = {
      samples,
      totalMs: samples.reduce((s, r) => s + r.dt, 0),
      watermark: watermarkRef.current,
    };
    const encoded = encode(recording);
    // Self-contained link immediately (still works, just longer), then swap
    // in the short stored link once the upload lands. Signed-out users and
    // network failures simply keep the long link.
    setShareUrl(window.location.origin + '/replay?d=' + encoded);
    setState('done');
    const take = takeRef.current;
    void saveRecording(encoded).then(id => {
      if (id && takeRef.current === take) {
        setShareUrl(window.location.origin + '/replay?r=' + id);
      }
    });
  }, []);

  const start = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    takeRef.current++;
    samplesRef.current = [];
    const now = performance.now();
    startTimeRef.current = now;
    lastSampleTimeRef.current = now;
    setElapsed(0);
    setShareUrl(null);
    setState('recording');

    intervalRef.current = setInterval(() => {
      const tick = performance.now();
      const totalElapsed = tick - startTimeRef.current;
      setElapsed(Math.min(totalElapsed / 1000, maxDurationMs / 1000));

      const dt = Math.round(tick - lastSampleTimeRef.current);
      lastSampleTimeRef.current = tick;

      const sel = selectedRef.current ?? { noteIdx: 0, qualIdx: 0 };
      const vibeIdx = Math.max(0, VIBES.indexOf(vibeRef.current));

      samplesRef.current.push({
        dt,
        noteIdx: sel.noteIdx,
        qualityIdx: sel.qualIdx,
        vibe: vibeIdx,
      });

      if (totalElapsed >= maxDurationMs) stop();
    }, INTERVAL_MS);
  }, [selectedRef, stop, maxDurationMs]);

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  return { state, elapsed, shareUrl, start, stop };
}
