import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { DialSelection } from '../renderer';
import type { Drill } from './types';
import { scoreFrame, accuracy, combinedScore } from './scorer';

export type ReviewPhase = 'idle' | 'countdown' | 'attempt' | 'drill-result' | 'complete';

export type DrillResult = {
  drillId: string;
  noteAccuracy: number;
  qualAccuracy: number;
  score: number;
  passed: boolean;
};

export type ReviewRunnerAPI = {
  phase: ReviewPhase;
  queue: Drill[];
  drillIndex: number;
  countdown: number;
  liveScore: number;
  results: DrillResult[];
  start: (queue: Drill[]) => void;
  next: () => void;
  exit: () => void;
};

const COUNTDOWN_SECS = 3;
const SCORE_INTERVAL_MS = 100;
export const REVIEW_HOLD_MS = 2000;
export const REVIEW_PASS_THRESHOLD = 70;

// A cold-recall review session: no ghost, no preview audio, no hint — just an
// instruction ("Play: G7"), a countdown, and a graded hold. Deliberately a
// separate, smaller hook from useLessonRunner rather than a variant of it —
// the lesson runner's preview/ghost machinery exists purely to support
// showing the answer first, which review must never do.
export function useReviewRunner(
  liveSelectedRef: RefObject<DialSelection>,
  onResult: (drillId: string, passed: boolean) => void,
): ReviewRunnerAPI {
  const [phase, setPhase] = useState<ReviewPhase>('idle');
  const [queue, setQueue] = useState<Drill[]>([]);
  const [drillIndex, setDrillIndex] = useState(0);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECS);
  const [liveScore, setLiveScore] = useState(0);
  const [results, setResults] = useState<DrillResult[]>([]);

  const queueRef = useRef<Drill[]>([]);
  const drillIndexRef = useRef(0);
  const noteHitsRef = useRef<boolean[]>([]);
  const qualHitsRef = useRef<boolean[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { drillIndexRef.current = drillIndex; }, [drillIndex]);

  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  // ── Finish attempt ─────────────────────────────────────────────────────────
  const finishAttempt = useCallback((idx: number) => {
    clearTimers();
    const drill = queueRef.current[idx];
    const noteAccuracy = accuracy(noteHitsRef.current);
    const qualAccuracy = accuracy(qualHitsRef.current);
    const score = combinedScore(noteAccuracy, qualAccuracy);
    const passed = score >= REVIEW_PASS_THRESHOLD;

    const result: DrillResult = { drillId: drill.id, noteAccuracy, qualAccuracy, score, passed };
    setResults(prev => [...prev, result]);
    onResult(drill.id, passed);
    setPhase('drill-result');
  }, [clearTimers, onResult]);

  // ── Attempt phase ──────────────────────────────────────────────────────────
  const startAttempt = useCallback((idx: number) => {
    clearTimers();
    setPhase('attempt');
    setLiveScore(0);
    noteHitsRef.current = [];
    qualHitsRef.current = [];

    const drill = queueRef.current[idx];
    const attemptStart = performance.now();

    timerRef.current = setInterval(() => {
      const elapsed = performance.now() - attemptStart;
      const live = liveSelectedRef.current ?? { noteIdx: 0, qualIdx: 0 };
      const { noteHit, qualHit } = scoreFrame(drill.noteIdx, drill.qualIdx, live.noteIdx, live.qualIdx);
      noteHitsRef.current.push(noteHit);
      qualHitsRef.current.push(qualHit);
      setLiveScore(combinedScore(accuracy(noteHitsRef.current), accuracy(qualHitsRef.current)));

      if (elapsed >= REVIEW_HOLD_MS) {
        finishAttempt(idx);
      }
    }, SCORE_INTERVAL_MS);
  }, [clearTimers, liveSelectedRef, finishAttempt]);

  // ── Countdown phase ────────────────────────────────────────────────────────
  const startCountdown = useCallback((idx: number) => {
    clearTimers();
    setPhase('countdown');
    setCountdown(COUNTDOWN_SECS);

    let remaining = COUNTDOWN_SECS;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearTimers();
        startAttempt(idx);
      }
    }, 1000);
  }, [clearTimers, startAttempt]);

  // ── Public API ─────────────────────────────────────────────────────────────
  const start = useCallback((newQueue: Drill[]) => {
    queueRef.current = newQueue;
    setQueue(newQueue);
    setDrillIndex(0);
    setResults([]);
    if (newQueue.length === 0) {
      setPhase('complete');
      return;
    }
    startCountdown(0);
  }, [startCountdown]);

  const next = useCallback(() => {
    const nextIdx = drillIndexRef.current + 1;
    if (nextIdx >= queueRef.current.length) {
      clearTimers();
      setPhase('complete');
    } else {
      setDrillIndex(nextIdx);
      startCountdown(nextIdx);
    }
  }, [clearTimers, startCountdown]);

  const exit = useCallback(() => {
    clearTimers();
    setPhase('idle');
    setQueue([]);
    setDrillIndex(0);
    setResults([]);
    setLiveScore(0);
    setCountdown(COUNTDOWN_SECS);
  }, [clearTimers]);

  return { phase, queue, drillIndex, countdown, liveScore, results, start, next, exit };
}
