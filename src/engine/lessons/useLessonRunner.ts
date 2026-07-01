import { useRef, useState, useCallback, useEffect } from 'react';
import type { RefObject } from 'react';
import type { GestureSignal } from '../types';
import type { DialSelection } from '../renderer';
import { sampleEndTimes, sampleIndexAt, signalsAt } from '../recording/replayPlayer';
import { scoreFrame, meanScore } from './scorer';
import type { Lesson, LessonPhase, StepResult } from './types';
import type { AudioEngine } from '../audio';
import { buildCommand } from '../music';

export type LessonRunnerAPI = {
  phase: LessonPhase;
  stepIndex: number;
  countdown: number;
  stepScore: number;
  stepResults: StepResult[];
  totalScore: number;
  start: () => void;
  retry: () => void;
  next: () => void;
  exit: () => void;
};

const COUNTDOWN_SECS = 3;
const SCORE_INTERVAL_MS = 100;

export function useLessonRunner(
  lesson: Lesson,
  liveSelectedRef: RefObject<DialSelection>,
  engineRef: RefObject<AudioEngine | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  ghostSignalsRef: RefObject<GestureSignal[]>,
): LessonRunnerAPI {
  const [phase, setPhase] = useState<LessonPhase>('idle');
  const [stepIndex, setStepIndex] = useState(0);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECS);
  const [stepScore, setStepScore] = useState(0);
  const [stepResults, setStepResults] = useState<StepResult[]>([]);
  const phaseRef = useRef<LessonPhase>('idle');
  const stepIndexRef = useRef(0);
  const frameScoresRef = useRef<number[]>([]);
  const attemptStartRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);
  const previewAudioRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep refs in sync with state so callbacks always read current values
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { stepIndexRef.current = stepIndex; }, [stepIndex]);

  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (previewAudioRef.current) {
      clearInterval(previewAudioRef.current);
      previewAudioRef.current = null;
      engineRef.current?.silence('synth');
    }
  }, [engineRef]);

  useEffect(() => clearTimers, [clearTimers]);

  // ── Ghost animation loop ───────────────────────────────────────────────────
  // Runs during preview, countdown, and attempt. Feeds the target recording into
  // ghostSignalsRef so the renderer draws dashed target-hand orbs.
  const startGhostLoop = useCallback((stepIdx: number, startMs: number) => {
    const step = lesson.steps[stepIdx];
    if (!step) return;
    const ends = sampleEndTimes(step.targetRecording);

    function loop() {
      const canvas = canvasRef.current;
      const w = canvas?.width ?? window.innerWidth;
      const h = canvas?.height ?? window.innerHeight;
      const elapsed = performance.now() - startMs;
      // Clamp elapsed to recording length so ghost freezes on last frame
      const clamped = Math.min(elapsed, step.targetRecording.totalMs - 1);
      ghostSignalsRef.current = signalsAt(step.targetRecording, ends, clamped, w, h);
      rafRef.current = requestAnimationFrame(loop);
    }
    loop();
  }, [lesson, canvasRef]);

  // ── Preview audio ──────────────────────────────────────────────────────────
  // Runs only during preview. Sounds the target recording's chords as the
  // ghost hand moves through them, so "Listen to the target" is actually audible.
  const startPreviewAudio = useCallback((stepIdx: number, startMs: number) => {
    const step = lesson.steps[stepIdx];
    const ends = sampleEndTimes(step.targetRecording);
    let lastSampleIdx = -1;

    function tick() {
      const engine = engineRef.current;
      if (!engine) return;
      const elapsed = performance.now() - startMs;
      const idx = sampleIndexAt(ends, elapsed);
      if (idx < 0 || idx === lastSampleIdx) return;
      lastSampleIdx = idx;
      const sample = step.targetRecording.samples[idx];
      engine.play(buildCommand(sample.noteIdx, sample.qualityIdx, 0.5, 0, lesson.musicConfig));
    }

    tick();
    previewAudioRef.current = setInterval(tick, 50);
  }, [lesson, engineRef]);

  // ── Preview phase ──────────────────────────────────────────────────────────
  const startPreview = useCallback((stepIdx: number) => {
    clearTimers();
    setPhase('preview');
    setCountdown(COUNTDOWN_SECS);
    setStepScore(0);
    frameScoresRef.current = [];

    const step = lesson.steps[stepIdx];
    const previewStart = performance.now();
    startGhostLoop(stepIdx, previewStart);
    startPreviewAudio(stepIdx, previewStart);

    // After the target recording finishes, move to countdown
    timerRef.current = setTimeout(() => {
      startCountdown(stepIdx);
    }, step.targetRecording.totalMs + 500) as unknown as ReturnType<typeof setInterval>;
  }, [lesson, clearTimers, startGhostLoop, startPreviewAudio]);

  // ── Countdown phase ────────────────────────────────────────────────────────
  const startCountdown = useCallback((stepIdx: number) => {
    clearTimers();
    setPhase('countdown');
    setCountdown(COUNTDOWN_SECS);

    // Show ghost frozen on first frame during countdown
    const step = lesson.steps[stepIdx];
    const ends = sampleEndTimes(step.targetRecording);
    const canvas = canvasRef.current;
    const w = canvas?.width ?? window.innerWidth;
    const h = canvas?.height ?? window.innerHeight;
    ghostSignalsRef.current = signalsAt(step.targetRecording, ends, 0, w, h);

    let remaining = COUNTDOWN_SECS;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearTimers();
        startAttempt(stepIdx);
      }
    }, 1000);
  }, [lesson, canvasRef, clearTimers]);

  // ── Attempt phase ──────────────────────────────────────────────────────────
  const startAttempt = useCallback((stepIdx: number) => {
    clearTimers();
    setPhase('attempt');
    frameScoresRef.current = [];

    const step = lesson.steps[stepIdx];
    const ends = sampleEndTimes(step.targetRecording);
    const attemptStart = performance.now();
    attemptStartRef.current = attemptStart;

    startGhostLoop(stepIdx, attemptStart);

    // Score each frame
    timerRef.current = setInterval(() => {
      const elapsed = performance.now() - attemptStart;
      const canvas = canvasRef.current;
      const w = canvas?.width ?? window.innerWidth;
      const h = canvas?.height ?? window.innerHeight;

      const targetSignals = signalsAt(step.targetRecording, ends, elapsed, w, h);
      const targetLeft = targetSignals.find(s => s.handId === 'left');
      const targetRight = targetSignals.find(s => s.handId === 'right');

      // Derive target noteIdx / qualIdx from targetSignals position on the wheels
      // We stored these via sliceToPoint so we can recover them by reading ghostSignalsRef
      // positions through the same geometry. Simpler: store them directly in RecordingSample.
      // Since signalsAt is designed for rendering (not scoring), we re-derive from the sample.
      const sampleIdx = Math.min(
        Math.floor(elapsed / SCORE_INTERVAL_MS),
        step.targetRecording.samples.length - 1,
      );
      const targetSample = step.targetRecording.samples[Math.max(0, sampleIdx)];
      const live = liveSelectedRef.current ?? { noteIdx: 0, qualIdx: 0 };

      // For fist-solo lessons only check noteIdx (right hand is locked)
      const isFistLesson = lesson.id === 'fist-solo';
      let frame: number;
      if (isFistLesson) {
        frame = targetSample.noteIdx === live.noteIdx ? 100 : 0;
      } else {
        frame = scoreFrame(targetSample.noteIdx, targetSample.qualityIdx, live.noteIdx, live.qualIdx);
      }
      frameScoresRef.current.push(frame);

      const runningMean = meanScore(frameScoresRef.current);
      setStepScore(runningMean);

      // Ghost needs targetLeft / targetRight to be valid — if both exist, we're scoring.
      // Just update ghost visuals (already handled by startGhostLoop).
      void targetLeft; void targetRight;

      if (elapsed >= step.durationMs) {
        finishAttempt(stepIdx, step.durationMs);
      }
    }, SCORE_INTERVAL_MS);
  }, [lesson, liveSelectedRef, canvasRef, clearTimers, startGhostLoop]);

  // ── Finish attempt ─────────────────────────────────────────────────────────
  const finishAttempt = useCallback((stepIdx: number, attemptMs: number) => {
    clearTimers();
    const step = lesson.steps[stepIdx];
    const score = meanScore(frameScoresRef.current);
    const passed = score >= step.minScore;

    const result: StepResult = { stepId: step.id, score, passed, attemptMs };
    setStepResults(prev => {
      const next = [...prev];
      next[stepIdx] = result;
      return next;
    });
    setStepScore(score);
    setPhase('step-result');
  }, [lesson, clearTimers]);

  // ── Public API ─────────────────────────────────────────────────────────────

  const start = useCallback(() => {
    setStepIndex(0);
    setStepResults([]);
    startPreview(0);
  }, [startPreview]);

  const retry = useCallback(() => {
    startPreview(stepIndexRef.current);
  }, [startPreview]);

  const next = useCallback(() => {
    const nextIdx = stepIndexRef.current + 1;
    if (nextIdx >= lesson.steps.length) {
      clearTimers();
      ghostSignalsRef.current = [];
      setPhase('complete');
    } else {
      setStepIndex(nextIdx);
      startPreview(nextIdx);
    }
  }, [lesson, clearTimers, startPreview]);

  const exit = useCallback(() => {
    clearTimers();
    ghostSignalsRef.current = [];
    setPhase('idle');
    setStepIndex(0);
    setStepResults([]);
    setStepScore(0);
    setCountdown(COUNTDOWN_SECS);
  }, [clearTimers]);

  const totalScore = stepResults.length > 0
    ? Math.round(stepResults.reduce((s, r) => s + r.score, 0) / stepResults.length)
    : 0;

  return {
    phase,
    stepIndex,
    countdown,
    stepScore,
    stepResults,
    totalScore,
    start,
    retry,
    next,
    exit,
  };
}
