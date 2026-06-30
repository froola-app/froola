import { useEffect, useState } from 'react';
import type { StepResult } from '../../engine/lessons/types';

type Props = {
  result: StepResult;
  stepIndex: number;
  totalSteps: number;
  minScore: number;
  onRetry: () => void;
  onNext: () => void;
  isLast: boolean;
};

export default function StepResultScreen({
  result,
  stepIndex,
  totalSteps,
  minScore,
  onRetry,
  onNext,
  isLast,
}: Props) {
  const [displayed, setDisplayed] = useState(0);

  // Animate score count-up
  useEffect(() => {
    setDisplayed(0);
    const target = result.score;
    const duration = 600;
    const start = performance.now();
    let id: number;
    function tick() {
      const p = Math.min((performance.now() - start) / duration, 1);
      setDisplayed(Math.round(p * target));
      if (p < 1) id = requestAnimationFrame(tick);
    }
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [result.score]);

  const passed = result.score >= minScore;
  const noteScore = Math.min(result.score, 50);
  const qualScore = Math.max(0, result.score - 50);

  return (
    <div className="step-result">
      <div className="step-result__backdrop" />
      <div className="step-result__card">
        <div className="step-result__step-label">
          Step {stepIndex + 1} / {totalSteps}
        </div>

        <div className={`step-result__score ${passed ? 'step-result__score--pass' : 'step-result__score--fail'}`}>
          {displayed}
        </div>

        <p className={`step-result__verdict ${passed ? 'step-result__verdict--pass' : 'step-result__verdict--fail'}`}>
          {passed ? 'Nice work!' : `Need ${minScore} to pass — keep trying`}
        </p>

        <div className="step-result__breakdown">
          <div className="step-result__breakdown-row">
            <span>Note accuracy</span>
            <span>{noteScore} / 50</span>
          </div>
          <div className="step-result__breakdown-row">
            <span>Chord quality</span>
            <span>{qualScore} / 50</span>
          </div>
        </div>

        <div className="step-result__actions">
          <button className="step-result__btn step-result__btn--retry" onClick={onRetry}>
            Retry
          </button>
          <button
            className="step-result__btn step-result__btn--next"
            onClick={onNext}
            disabled={!passed}
          >
            {isLast ? 'Finish' : 'Next'} →
          </button>
        </div>
      </div>
    </div>
  );
}
