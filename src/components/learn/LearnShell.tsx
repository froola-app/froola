import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { InstrumentMode, GestureSignal } from '../../engine/types';
import type { InputMode } from '../../engine/input';
import { useCoordinator } from '../../coordinator';
import { lessonById, CURRICULUM } from '../../engine/lessons/curriculum';
import { useLessonRunner } from '../../engine/lessons/useLessonRunner';
import { useLessonProgress } from '../../engine/lessons/useLessonProgress';
import LessonHUD from './LessonHUD';
import StepResultScreen from './StepResultScreen';
import CompletionScreen from './CompletionScreen';
import TrackingWarning from '../TrackingWarning';

const INITIAL_INPUT: InputMode = 'asking';

export default function LearnShell() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();

  const lesson = lessonId ? lessonById(lessonId) : undefined;

  useEffect(() => {
    if (!lesson) navigate('/learn', { replace: true });
  }, [lesson, navigate]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef<InstrumentMode>('synth');

  // Ghost orbs drawn by the renderer as dashed target rings during attempt —
  // purely visual. Preview audio is driven directly by the lesson runner
  // (see useLessonRunner), not by simulating hand positions through the
  // coordinator, so live camera/mouse input always drives the coordinator
  // here exactly like PlayShell.
  const ghostSignalsRef = useRef<GestureSignal[]>([]);

  const {
    mode,
    requestCamera,
    useMouse,
    selectedRef,
    engineRef,
    trackingUnstable,
  } = useCoordinator(canvasRef, modeRef, INITIAL_INPUT, undefined, undefined, undefined, ghostSignalsRef);

  const runner = lesson
    // eslint-disable-next-line react-hooks/rules-of-hooks
    ? useLessonRunner(lesson, selectedRef, engineRef, canvasRef, ghostSignalsRef)
    : null;

  const [elapsed, setElapsed] = useState(0);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptStartRef = useRef(0);

  useEffect(() => {
    if (runner?.phase === 'attempt') {
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
  }, [runner?.phase]);

  const { save } = useLessonProgress(lesson?.id);

  const handleSave = useCallback(() => {
    if (!runner || !lesson) return;
    save({
      lessonId: lesson.id,
      stepResults: runner.stepResults,
      totalScore: runner.totalScore,
      completedAt: Date.now(),
    });
  }, [runner, lesson, save]);

  const handleExit = useCallback(() => {
    runner?.exit();
    navigate('/learn');
  }, [runner, navigate]);

  if (!lesson || !runner) return null;

  const currentStep = lesson.steps[runner.stepIndex];
  const nextLesson = CURRICULUM[CURRICULUM.findIndex(l => l.id === lesson.id) + 1];

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

      {mode === 'camera' && trackingUnstable && <TrackingWarning />}

      {runner.phase === 'idle' && (
        <div className="lesson-start-screen">
          <div className="lesson-start-card">
            <p className="lesson-start__eyebrow">{lesson.difficulty}</p>
            <h2 className="lesson-start__title">{lesson.title}</h2>
            <p className="lesson-start__subtitle">{lesson.subtitle}</p>
            <ul className="lesson-start__steps">
              {lesson.steps.map((s, i) => (
                <li key={s.id}><span>{i + 1}.</span> {s.instruction}</li>
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
          nextLessonId={nextLesson?.id}
          onSave={handleSave}
        />
      )}
    </>
  );
}
