import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Lesson, StepResult } from '../../engine/lessons/types';
import ReviewBanner from './ReviewBanner';

type Props = {
  lesson: Lesson;
  stepResults: StepResult[];
  totalScore: number;
  onSave?: () => void; // called once after mount if provided
};

function grade(score: number): string {
  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 45) return 'C';
  return 'D';
}

export default function CompletionScreen({ lesson, stepResults, totalScore, onSave }: Props) {
  const navigate = useNavigate();

  // Trigger save once after mount
  const savedRef = useRef(false);
  useEffect(() => {
    if (savedRef.current) return;
    savedRef.current = true;
    onSave?.();
  }, [onSave]);

  return (
    <div className="lesson-complete">
      <div className="lesson-complete__backdrop" />
      <div className="lesson-complete__card">
        <p className="lesson-complete__eyebrow">Lesson complete</p>
        <h2 className="lesson-complete__title">{lesson.title}</h2>

        <div className="lesson-complete__grade">{grade(totalScore)}</div>
        <div className="lesson-complete__total">{totalScore} / 100</div>

        <table className="lesson-complete__table">
          <tbody>
            {lesson.steps.map((step, i) => {
              const r = stepResults[i];
              return (
                <tr key={step.id}>
                  <td className="lesson-complete__table-step">Step {i + 1}</td>
                  <td className="lesson-complete__table-instruction">{step.instruction}</td>
                  <td className={`lesson-complete__table-score ${r?.passed ? 'is-pass' : 'is-fail'}`}>
                    {r?.score ?? '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <ReviewBanner />

        <div className="lesson-complete__actions">
          <button
            className="lesson-complete__btn lesson-complete__btn--secondary"
            onClick={() => navigate('/learn')}
          >
            All lessons
          </button>
          <button
            className="lesson-complete__btn lesson-complete__btn--primary"
            onClick={() => navigate('/play')}
          >
            Play freely →
          </button>
        </div>
      </div>
    </div>
  );
}
