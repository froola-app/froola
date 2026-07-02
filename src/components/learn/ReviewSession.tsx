import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { InstrumentMode } from '../../engine/types';
import type { InputMode } from '../../engine/input';
import { useCoordinator } from '../../coordinator';
import { useReviewProgress } from '../../engine/lessons/useReviewProgress';
import { useReviewRunner } from '../../engine/lessons/useReviewRunner';
import { drillById } from '../../engine/lessons/drillBank';
import ReviewHUD from './ReviewHUD';

const INITIAL_INPUT: InputMode = 'asking';
const REVIEW_SESSION_SIZE = 10;

export default function ReviewSession() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef<InstrumentMode>('synth');

  // No ghostSignalsRef — review never shows a visual answer.
  const { mode, requestCamera, useMouse, selectedRef } = useCoordinator(canvasRef, modeRef, INITIAL_INPUT);

  const { dueDrills, dueCount, recordResult } = useReviewProgress();
  const runner = useReviewRunner(selectedRef, recordResult);

  const [elapsed, setElapsed] = useState(0);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptStartRef = useRef(0);

  useEffect(() => {
    if (runner.phase === 'attempt') {
      attemptStartRef.current = performance.now();
      elapsedIntervalRef.current = setInterval(() => {
        setElapsed(performance.now() - attemptStartRef.current);
      }, 50);
    } else if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }
    return () => {
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    };
  }, [runner.phase]);

  const handleExit = useCallback(() => {
    runner.exit();
    navigate('/learn');
  }, [runner, navigate]);

  const currentDrill = runner.queue[runner.drillIndex];
  const lastResult = runner.results[runner.results.length - 1];
  const lastDrill = lastResult ? drillById(lastResult.drillId) : undefined;
  const passedCount = runner.results.filter(r => r.passed).length;

  return (
    <>
      <canvas ref={canvasRef} className="main-canvas" />

      {mode === 'asking' && (
        <div className="permission-screen" style={{ inset: 0 }}>
          <div className="permission-card">
            <p className="permission-eyebrow">Review mode</p>
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

      {runner.phase === 'idle' && (
        <div className="lesson-start-screen">
          <div className="lesson-start-card">
            <p className="lesson-start__eyebrow">Spaced review</p>
            <h2 className="lesson-start__title">Chord review</h2>
            {dueCount === 0 ? (
              <>
                <p className="lesson-start__subtitle">Nothing due right now — nice work staying on top of it.</p>
                <button className="lesson-start__btn" onClick={() => navigate('/learn')}>
                  Back to lessons →
                </button>
              </>
            ) : (
              <>
                <p className="lesson-start__subtitle">
                  {dueCount} chord{dueCount !== 1 ? 's' : ''} ready to test cold — no ghost, no hint.
                </p>
                <button
                  className="lesson-start__btn"
                  onClick={() => runner.start(dueDrills.slice(0, REVIEW_SESSION_SIZE))}
                >
                  Start review →
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {(runner.phase === 'countdown' || runner.phase === 'attempt') && currentDrill && (
        <ReviewHUD
          phase={runner.phase}
          drillIndex={runner.drillIndex}
          totalDrills={runner.queue.length}
          label={currentDrill.label}
          countdown={runner.countdown}
          liveScore={runner.liveScore}
          elapsed={elapsed}
        />
      )}

      {runner.phase === 'drill-result' && lastResult && (
        <div className="step-result">
          <div className="step-result__backdrop" />
          <div className="step-result__card">
            <div className="step-result__step-label">
              Drill {runner.drillIndex + 1} / {runner.queue.length}
            </div>
            <div className={`step-result__score ${lastResult.passed ? 'step-result__score--pass' : 'step-result__score--fail'}`}>
              {lastResult.score}
            </div>
            <p className={`step-result__verdict ${lastResult.passed ? 'step-result__verdict--pass' : 'step-result__verdict--fail'}`}>
              {lastDrill ? lastDrill.label : ''} — {lastResult.passed ? 'Remembered!' : 'Not quite — back in the queue'}
            </p>
            <div className="step-result__breakdown">
              <div className="step-result__breakdown-row">
                <span>Left hand (chord)</span>
                <span>{lastResult.noteAccuracy}%</span>
              </div>
              <div className="step-result__breakdown-row">
                <span>Right hand (color)</span>
                <span>{lastResult.qualAccuracy}%</span>
              </div>
            </div>
            <div className="step-result__actions">
              <button className="step-result__btn step-result__btn--next" onClick={runner.next}>
                {runner.drillIndex + 1 >= runner.queue.length ? 'Finish' : 'Next'} →
              </button>
            </div>
          </div>
        </div>
      )}

      {runner.phase === 'complete' && runner.queue.length > 0 && (
        <div className="lesson-complete">
          <div className="lesson-complete__backdrop" />
          <div className="lesson-complete__card">
            <p className="lesson-complete__eyebrow">Review complete</p>
            <h2 className="lesson-complete__title">{passedCount} / {runner.queue.length} remembered</h2>
            <div className="lesson-complete__actions">
              <button
                className="lesson-complete__btn lesson-complete__btn--secondary"
                onClick={() => navigate('/learn')}
              >
                All lessons
              </button>
              <button
                className="lesson-complete__btn lesson-complete__btn--primary"
                onClick={() => navigate('/')}
              >
                Play freely →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
