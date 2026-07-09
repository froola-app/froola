import { useRef, useState, useCallback, useEffect } from 'react';
import type { RefObject } from 'react';
import type { GestureSignal } from '../types';
import type { DialSelection } from '../renderer';
import { sampleEndTimes, sampleIndexAt, signalsAt } from '../recording/replayPlayer';
import { chordSpans, scoreChords, type ChordSpan, type LiveFrame } from './scorer';
import type { Lesson, LessonPhase, StepResult } from './types';
import type { AudioEngine, SongBackingTrack, MelodyNote } from '../audio';
import { backingSequence } from '../audio';
import { buildCommand } from '../music';

export type LessonRunnerAPI = {
  phase: LessonPhase;
  stepIndex: number;
  countdown: number;
  stepScore: number;
  stepResults: StepResult[];
  totalScore: number;
  practiceChordIndex: number;
  practiceChordCount: number;
  practiceTarget: { noteIdx: number; qualIdx: number } | null;
  start: () => void;
  retry: () => void;
  next: () => void;
  exit: () => void;
};

const COUNTDOWN_SECS = 3;
const SCORE_INTERVAL_MS = 100;
const PRACTICE_DWELL_MS = 700;
const PRACTICE_TICK_MS = 100;

// Context handed from the hook to the module-level preview/practice phase
// functions below. Preview routes into practice and practice completion
// routes into the next step's preview — mutual recursion that React Compiler
// rejects inside hook-created closures, so both live at module level.
type PhaseCtx = {
  lesson: Lesson;
  liveSelectedRef: RefObject<DialSelection>;
  engineRef: RefObject<AudioEngine | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  ghostSignalsRef: RefObject<GestureSignal[]>;
  timerRef: RefObject<ReturnType<typeof setInterval> | null>;
  framesRef: RefObject<LiveFrame[]>;
  clearTimers: () => void;
  startCountdown: (stepIdx: number) => void;
  startGhostLoop: (stepIdx: number, startMs: number) => void;
  startPreviewAudio: (stepIdx: number, startMs: number) => void;
  startBacking: (stepIdx: number) => void;
  setPhase: (p: LessonPhase) => void;
  setCountdown: (n: number) => void;
  setStepScore: (n: number) => void;
  setPracticeChordIndex: (n: number) => void;
  setPracticeSpans: (s: ChordSpan[]) => void;
  setStepResults: (fn: (prev: StepResult[]) => StepResult[]) => void;
  setStepIndex: (n: number) => void;
};

// ── Practice phase ───────────────────────────────────────────────────────────
// Self-paced: walk the step's chord spans one at a time; hold the matching
// chord for PRACTICE_DWELL_MS to advance. No timer bar, no score.
function startPracticeImpl(ctx: PhaseCtx, stepIdx: number): void {
  const { lesson } = ctx;
  ctx.clearTimers();
  ctx.setPhase('practice');
  const step = lesson.steps[stepIdx];
  const spans = chordSpans(step.targetRecording);
  ctx.setPracticeSpans(spans);
  ctx.setPracticeChordIndex(0);
  const isFistLesson = lesson.id === 'fist-solo';

  if (spans.length === 0) {
    // Empty target recording: nothing to practice — treat as instantly complete.
    ctx.clearTimers();
    const result: StepResult = {
      stepId: step.id, score: 100, passed: true, attemptMs: 0,
      noteAccuracy: 100, qualAccuracy: 100, scoresQuality: !isFistLesson,
    };
    ctx.setStepResults(prev => { const next = [...prev]; next[stepIdx] = result; return next; });
    if (stepIdx === lesson.steps.length - 1) {
      ctx.startCountdown(stepIdx);
    } else {
      ctx.setStepIndex(stepIdx + 1);
      startPreviewImpl(ctx, stepIdx + 1);
    }
    return;
  }

  const ends = sampleEndTimes(step.targetRecording);
  let chordIdx = 0;
  let dwellMs = 0;

  const freezeGhost = () => {
    const canvas = ctx.canvasRef.current;
    const w = canvas?.width ?? window.innerWidth;
    const h = canvas?.height ?? window.innerHeight;
    ctx.ghostSignalsRef.current = signalsAt(step.targetRecording, ends, spans[chordIdx].startMs, w, h);
  };
  freezeGhost();

  ctx.timerRef.current = setInterval(() => {
    const target = spans[chordIdx];
    const live = ctx.liveSelectedRef.current ?? { noteIdx: -1, qualIdx: -1 };
    const match = live.noteIdx === target.noteIdx && (isFistLesson || live.qualIdx === target.qualIdx);
    dwellMs = match ? dwellMs + PRACTICE_TICK_MS : 0;
    if (dwellMs < PRACTICE_DWELL_MS) return;

    dwellMs = 0;
    // Confirmation chime: sound the chord the user just nailed.
    ctx.engineRef.current?.play(buildCommand(target.noteIdx, target.qualIdx, 0.5, 0, lesson.musicConfig));
    chordIdx += 1;
    if (chordIdx < spans.length) {
      ctx.setPracticeChordIndex(chordIdx);
      freezeGhost();
      return;
    }
    // Practice pass complete.
    ctx.clearTimers();
    const result: StepResult = {
      stepId: step.id, score: 100, passed: true, attemptMs: 0,
      noteAccuracy: 100, qualAccuracy: 100, scoresQuality: !isFistLesson,
    };
    ctx.setStepResults(prev => { const next = [...prev]; next[stepIdx] = result; return next; });
    if (stepIdx === lesson.steps.length - 1) {
      // Single-step lesson: same step now runs the timed play-through.
      ctx.startCountdown(stepIdx);
    } else {
      ctx.setStepIndex(stepIdx + 1);
      startPreviewImpl(ctx, stepIdx + 1);
    }
  }, PRACTICE_TICK_MS);
}

// ── Preview phase ────────────────────────────────────────────────────────────
function startPreviewImpl(ctx: PhaseCtx, stepIdx: number): void {
  const { lesson } = ctx;
  ctx.clearTimers();
  ctx.setPhase('preview');
  ctx.setCountdown(COUNTDOWN_SECS);
  ctx.setStepScore(0);
  ctx.setPracticeChordIndex(0);
  ctx.setPracticeSpans([]);
  ctx.framesRef.current = [];

  const step = lesson.steps[stepIdx];
  const previewStart = performance.now();
  ctx.startGhostLoop(stepIdx, previewStart);
  ctx.startPreviewAudio(stepIdx, previewStart);
  ctx.startBacking(stepIdx);

  // Non-final steps (and the sole step of a single-step lesson) practice
  // self-paced first; only the final play-through gets a countdown.
  const isFinalStep = stepIdx === lesson.steps.length - 1;
  const practicesFirst = !isFinalStep || lesson.steps.length === 1;
  ctx.timerRef.current = setTimeout(() => {
    if (practicesFirst) startPracticeImpl(ctx, stepIdx);
    else ctx.startCountdown(stepIdx);
  }, step.targetRecording.totalMs + 500) as unknown as ReturnType<typeof setInterval>;
}

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
  const [practiceChordIndex, setPracticeChordIndex] = useState(0);
  // Discrete per-step state (changes once per step, not per gesture frame),
  // read during render to derive practiceTarget/practiceChordCount.
  const [practiceSpans, setPracticeSpans] = useState<ChordSpan[]>([]);
  const framesRef = useRef<LiveFrame[]>([]);
  const phaseRef = useRef<LessonPhase>('idle');
  const stepIndexRef = useRef(0);
  const attemptStartRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);
  const previewAudioRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const backingRef = useRef<SongBackingTrack | null>(null);
  const melodyRef = useRef<MelodyNote[] | undefined>(undefined);
  const audioBytesRef = useRef<ArrayBuffer | null>(null);
  const audioBufRef = useRef<AudioBuffer | null>(null);
  const audioTokenRef = useRef(0);

  // Optional locally-generated melody data (gitignored runtime asset — a 404
  // is fine and simply means the backing plays without a lead line).
  useEffect(() => {
    melodyRef.current = undefined;
    if (!lesson.melodyAsset) return;
    let cancelled = false;
    fetch(lesson.melodyAsset, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : undefined))
      .then(notes => { if (!cancelled && Array.isArray(notes)) melodyRef.current = notes; })
      .catch(() => { /* no melody file */ });
    return () => { cancelled = true; };
  }, [lesson]);

  // Optional real-audio backing (also a gitignored local asset; 404 = fall
  // back to the synth arrangement). Decoded lazily once the engine exists.
  useEffect(() => {
    audioBytesRef.current = null;
    audioBufRef.current = null;
    if (!lesson.audioBackingAsset) return;
    let cancelled = false;
    fetch(lesson.audioBackingAsset, { cache: 'no-store' })
      .then(r => (r.ok ? r.arrayBuffer() : null))
      .then(bytes => { if (!cancelled) audioBytesRef.current = bytes; })
      .catch(() => { /* no audio backing file */ });
    return () => { cancelled = true; };
  }, [lesson]);

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
    audioTokenRef.current += 1; // cancel any in-flight audio-backing decode
    backingRef.current?.stop();
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
  }, [lesson, canvasRef, ghostSignalsRef]);

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

  // ── Backing track ──────────────────────────────────────────────────────────
  // Song lessons only (lesson.bpm set): a quiet synthesized bass + hi-hat groove
  // follows the step's chord roots during preview and attempt, so the step feels
  // like playing along with a band. Stopped wherever clearTimers() runs.
  const startBacking = useCallback((stepIdx: number) => {
    const engine = engineRef.current;
    if (!lesson.bpm || !engine) return;
    backingRef.current ??= engine.createBackingTrack();
    const step = lesson.steps[stepIdx];
    // Section-length assets only fit the step they were prepared against —
    // anywhere else they'd play over the wrong chords.
    const isSectionStep = step.id === lesson.melodyStepId;

    // Real-audio backing takes precedence over the synth band when present.
    const bytes = isSectionStep ? audioBytesRef.current : null;
    if (bytes) {
      const token = ++audioTokenRef.current;
      const decoded = audioBufRef.current
        ? Promise.resolve(audioBufRef.current)
        : engine.decodeAudio(bytes.slice(0)).then(buf => (audioBufRef.current = buf));
      decoded
        .then(buf => { if (audioTokenRef.current === token) backingRef.current?.startAudio(buf); })
        .catch(() => { /* undecodable file — stay silent rather than misfire */ });
      return;
    }

    const melody = isSectionStep ? melodyRef.current : undefined;
    backingRef.current.start(backingSequence(step.targetRecording, lesson.musicConfig), lesson.bpm, lesson.backing, melody);
  }, [lesson, engineRef]);

  // The phase callbacks below are declared in reverse calling order
  // (finishAttempt → startAttempt → startCountdown → startPreview) so each
  // only references callbacks declared above it.

  // ── Finish attempt ─────────────────────────────────────────────────────────
  const finishAttempt = useCallback((stepIdx: number, attemptMs: number) => {
    clearTimers();
    const step = lesson.steps[stepIdx];
    const isFistLesson = lesson.id === 'fist-solo';
    const spans = chordSpans(step.targetRecording);
    const { score, noteAccuracy, qualAccuracy } = scoreChords(spans, framesRef.current, isFistLesson);
    const passed = score >= step.minScore;
    const scoresQuality = lesson.id !== 'fist-solo';

    const result: StepResult = { stepId: step.id, score, passed, attemptMs, noteAccuracy, qualAccuracy, scoresQuality };
    setStepResults(prev => {
      const next = [...prev];
      next[stepIdx] = result;
      return next;
    });
    setStepScore(score);
    setPhase('step-result');
  }, [lesson, clearTimers]);

  // ── Attempt phase ──────────────────────────────────────────────────────────
  // No ghost, no hint — this is the graded window, so it has to test recall,
  // not tracing a moving target.
  const startAttempt = useCallback((stepIdx: number) => {
    clearTimers();
    setPhase('attempt');
    framesRef.current = [];
    ghostSignalsRef.current = [];

    const step = lesson.steps[stepIdx];
    const attemptStart = performance.now();
    attemptStartRef.current = attemptStart;
    startBacking(stepIdx);

    // For fist-solo lessons only the note (left hand) is under the user's
    // control — the chord quality is locked by the fist, so it isn't scored.
    const isFistLesson = lesson.id === 'fist-solo';
    const spans = chordSpans(step.targetRecording);

    // Log each frame; score is recomputed per chord span, not per frame.
    // Frames are only logged up to step.durationMs, so an authored duration
    // shorter than targetRecording.totalMs will auto-miss trailing spans —
    // an authoring constraint, not a runtime bug.
    timerRef.current = setInterval(() => {
      const elapsed = performance.now() - attemptStart;

      const live = liveSelectedRef.current ?? { noteIdx: 0, qualIdx: 0 };
      framesRef.current.push({ tMs: elapsed, noteIdx: live.noteIdx, qualIdx: live.qualIdx });
      setStepScore(scoreChords(spans, framesRef.current, isFistLesson).score);

      if (elapsed >= step.durationMs) {
        finishAttempt(stepIdx, step.durationMs);
      }
    }, SCORE_INTERVAL_MS);
  }, [lesson, liveSelectedRef, ghostSignalsRef, clearTimers, startBacking, finishAttempt]);

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
  }, [lesson, canvasRef, ghostSignalsRef, clearTimers, startAttempt]);

  // ── Preview phase (+ practice, via module-level impls above) ────────────────
  const startPreview = useCallback((stepIdx: number) => {
    startPreviewImpl({
      lesson, liveSelectedRef, engineRef, canvasRef, ghostSignalsRef, timerRef, framesRef,
      clearTimers, startCountdown, startGhostLoop, startPreviewAudio, startBacking,
      setPhase, setCountdown, setStepScore, setPracticeChordIndex, setPracticeSpans,
      setStepResults, setStepIndex,
    }, stepIdx);
  }, [lesson, liveSelectedRef, engineRef, canvasRef, ghostSignalsRef, clearTimers, startCountdown, startGhostLoop, startPreviewAudio, startBacking]);

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
  }, [lesson, clearTimers, startPreview, ghostSignalsRef]);

  const exit = useCallback(() => {
    clearTimers();
    ghostSignalsRef.current = [];
    setPhase('idle');
    setStepIndex(0);
    setStepResults([]);
    setStepScore(0);
    setCountdown(COUNTDOWN_SECS);
    setPracticeChordIndex(0);
    setPracticeSpans([]);
    framesRef.current = [];
  }, [clearTimers, ghostSignalsRef]);

  // Practice steps always record score 100 for StepResult-shape compatibility
  // (attemptMs: 0) but are unscored; only the timed play-through(s) — where
  // attemptMs > 0 — should count toward the lesson's total score.
  const scoredResults = stepResults.filter(r => r.attemptMs > 0);
  const totalScore = scoredResults.length > 0
    ? Math.round(scoredResults.reduce((s, r) => s + r.score, 0) / scoredResults.length)
    : 0;

  const practiceTarget =
    phase === 'practice' ? (practiceSpans[practiceChordIndex] ?? null) : null;

  return {
    phase,
    stepIndex,
    countdown,
    stepScore,
    stepResults,
    totalScore,
    practiceChordIndex,
    practiceChordCount: practiceSpans.length,
    practiceTarget: practiceTarget && { noteIdx: practiceTarget.noteIdx, qualIdx: practiceTarget.qualIdx },
    start,
    retry,
    next,
    exit,
  };
}
