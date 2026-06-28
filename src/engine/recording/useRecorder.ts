import { useRef, useState, useCallback, useEffect } from 'react';
import type { RefObject } from 'react';
import type { GestureSignal, RecordingSample, Recording } from '../types';
import { encode } from './codec';

const NOTES_LEN = 7;
const QUALITIES_LEN = 7;
const VIBES = ['warm', 'bright', 'dark', 'electric'];
const MAX_DURATION_MS = 30_000;
const INTERVAL_MS = 100;

function pickIndex(x: number, count: number): number {
  return Math.min(Math.floor(x * count), count - 1);
}

export type RecorderState = 'idle' | 'recording' | 'done';

export function useRecorder(
  signalsRef: RefObject<GestureSignal[]>,
  vibe: string
) {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const samplesRef = useRef<RecordingSample[]>([]);
  const startTimeRef = useRef(0);
  const lastSampleTimeRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vibeRef = useRef(vibe);

  useEffect(() => { vibeRef.current = vibe; }, [vibe]);

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
    };
    const encoded = encode(recording);
    setShareUrl(window.location.origin + '/replay?d=' + encoded);
    setState('done');
  }, []);

  const start = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
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
      setElapsed(Math.min(totalElapsed / 1000, 30));

      const dt = Math.round(tick - lastSampleTimeRef.current);
      lastSampleTimeRef.current = tick;

      const signals = signalsRef.current ?? [];
      const left = signals.find(s => s.handId === 'left');
      const right = signals.find(s => s.handId === 'right');
      const vibeIdx = Math.max(0, VIBES.indexOf(vibeRef.current));

      samplesRef.current.push({
        dt,
        noteIdx: left ? pickIndex(left.x, NOTES_LEN) : 0,
        qualityIdx: right ? pickIndex(right.x, QUALITIES_LEN) : 0,
        vibe: vibeIdx,
      });

      if (totalElapsed >= MAX_DURATION_MS) stop();
    }, INTERVAL_MS);
  }, [signalsRef, stop]);

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  return { state, elapsed, shareUrl, start, stop };
}
