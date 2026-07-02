import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { InstrumentMode } from '../../engine/types';
import type { GestureSignal } from '../../engine/types';
import type { InputMode } from '../../engine/input';
import { useCoordinator } from '../../coordinator';
import { lessonById, nextLessonAfter } from '../../engine/lessons/curriculum';
import type { Lesson, LessonStep } from '../../engine/lessons/types';
import { diatonicChord, type MusicConfig } from '../../engine/music/keyScale';
import { useLessonRunner } from '../../engine/lessons/useLessonRunner';
import { useLessonProgress } from '../../engine/lessons/useLessonProgress';
import LessonHUD from './LessonHUD';
import StepResultScreen from './StepResultScreen';
import CompletionScreen from './CompletionScreen';

const INITIAL_INPUT: InputMode = 'asking';

// Chord-change timeline of a step's target recording, for the "now / next"
// prompts shown during song attempts.
type ChordSegment = { startMs: number; label: string };

function chordSegments(step: LessonStep, music: MusicConfig): ChordSegment[] {
  const segments: ChordSegment[] = [];
  let t = 0;
  let last = '';
  for (const sample of step.targetRecording.samples) {
    const key = `${sample.noteIdx}:${sample.qualityIdx}`;
    if (key !== last) {
      last = key;
      segments.push({
        startMs: t,
        label: diatonicChord(sample.noteIdx, sample.qualityIdx, music.keyOffset, music.scale).label,
      });
    }
    t += sample.dt;
  }
  return segments;
}

export default function LearnShell() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();

  const lesson = lessonId ? lessonById(lessonId) : undefined;

  useEffect(() => {
    if (!lesson) navigate('/learn', { replace: true });
  }, [lesson, navigate]);

  if (!lesson) return null;

  // Keyed so navigating between lessons (e.g. the completion screen's
  // "Next lesson" button) remounts the session with fresh runner state.
  return <LessonSession key={lesson.id} lesson={lesson} />;
}

function LessonSession({ lesson }: { lesson: Lesson }) {
  const navigate = useNavigate();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef<InstrumentMode>('synth');

  // Owned here — shared between coordinator (renderer reads it) and lesson runner (writes it)
  const ghostSignalsRef = useRef<GestureSignal[]>([]);

  const {
    mode,
    requestCamera,
    useMouse,
    selectedRef,
    engineRef,
  } = useCoordinator(canvasRef, modeRef, INITIAL_INPUT, undefined, undefined, undefined, ghostSignalsRef);

  const runner = useLessonRunner(lesson, selectedRef, engineRef, canvasRef, ghostSignalsRef);

  const [elapsed, setElapsed] = useState(0);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptStartRef = useRef(0);

  useEffect(() => {
    if (runner.phase === 'attempt') {
      attemptStartRef.current = performance.now();
      elapsedIntervalRef.current = setInterval(() => {
        setElapsed(performance.now() - attemptStartRef.current);
      }, 50);
    } else {
      if (elapsedIntervalRef.current) {
        clearInterval(elapsedIntervalRef.current);
        elapsedIntervalRef.current = null;
      }
      setElapsed(0);
    }
    return () => {
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    };
  }, [runner.phase]);

  const { save } = useLessonProgress(lesson.id);

  const handleSave = useCallback(() => {
    save({
      lessonId: lesson.id,
      stepResults: runner.stepResults,
      totalScore: runner.totalScore,
      completedAt: Date.now(),
    });
  }, [runner, lesson, save]);

  const handleExit = useCallback(() => {
    runner.exit();
    navigate('/learn');
  }, [runner, navigate]);

  const currentStep = lesson.steps[runner.stepIndex];

  const segments = useMemo(
    () => (currentStep ? chordSegments(currentStep, lesson.musicConfig) : []),
    [currentStep, lesson],
  );

  // Song lessons show the target chord (and the upcoming one) during countdown
  // and attempt — playing along with named changes is how the song sticks.
  // Technique drills stay prompt-free: they test recall.
  let chordNow: string | undefined;
  let chordNext: string | undefined;
  if (lesson.kind === 'song' && segments.length > 0) {
    if (runner.phase === 'attempt') {
      let i = 0;
      while (i + 1 < segments.length && segments[i + 1].startMs <= elapsed) i++;
      chordNow = segments[i].label;
      chordNext = segments[i + 1]?.label;
    } else if (runner.phase === 'countdown') {
      chordNow = segments[0].label;
      chordNext = segments[1]?.label;
    }
  }

  return (
    <>
      <canvas ref={canvasRef} className="main-canvas" />

      {mode === 'asking' && (
        <div className="permission-screen" style={{ inset: 0 }}>
          <div className="permission-card">
            <p className="permission-eyebrow">Lesson mode</p>
            <h1 className="permission-title">Choose your input</h1>
            <div className="permission-buttons">
              <button onClick={requestCamera} className="permission-btn-primary">Enable camera</button>
              <button onClick={useMouse} className="permission-btn-secondary">Use mouse</button>
            </div>
          </div>
        </div>
      )}

      {runner.phase !== 'complete' && (
        <button className="lesson-exit-btn" onClick={handleExit}>✕ Exit</button>
      )}

      {/* Input choice first — the start card would sit on top of it otherwise */}
      {mode !== 'asking' && runner.phase === 'idle' && (
        <div className="lesson-start-screen">
          <div className="lesson-start-card">
            <p className="lesson-start__eyebrow">
              {lesson.kind === 'song' ? lesson.artist : `Technique · ${lesson.difficulty}`}
            </p>
            <h2 className="lesson-start__title">{lesson.title}</h2>
            <p className="lesson-start__subtitle">{lesson.subtitle}</p>

            {lesson.kind === 'song' && lesson.progression && (
              <div className="lesson-start__progression">
                {lesson.progression.map((c, i) => (
                  <span key={i} className="chord-chip">{c}</span>
                ))}
                {lesson.bpm && <span className="lesson-start__bpm">{lesson.bpm} bpm</span>}
              </div>
            )}

            <ul className="lesson-start__steps">
              {lesson.steps.map((s, i) => (
                <li key={s.id}><span>{i + 1}</span> {s.instruction}</li>
              ))}
            </ul>
            <button className="lesson-start__btn" onClick={runner.start}>
              Start lesson →
            </button>
          </div>
        </div>
      )}

      {(runner.phase === 'preview' || runner.phase === 'countdown' || runner.phase === 'attempt') && (
        <LessonHUD
          phase={runner.phase}
          stepIndex={runner.stepIndex}
          totalSteps={lesson.steps.length}
          instruction={currentStep?.instruction ?? ''}
          hint={currentStep?.hint}
          countdown={runner.countdown}
          stepScore={runner.stepScore}
          elapsed={elapsed}
          durationMs={currentStep?.durationMs ?? 1}
          chordNow={chordNow}
          chordNext={chordNext}
        />
      )}

      {runner.phase === 'step-result' && runner.stepResults[runner.stepIndex] && (
        <StepResultScreen
          result={runner.stepResults[runner.stepIndex]}
          stepIndex={runner.stepIndex}
          totalSteps={lesson.steps.length}
          minScore={currentStep?.minScore ?? 60}
          onRetry={runner.retry}
          onNext={runner.next}
          isLast={runner.stepIndex === lesson.steps.length - 1}
        />
      )}

      {runner.phase === 'complete' && (
        <CompletionScreen
          lesson={lesson}
          stepResults={runner.stepResults}
          totalScore={runner.totalScore}
          nextLesson={nextLessonAfter(lesson.id)}
          onSave={handleSave}
        />
      )}
    </>
  );
}
