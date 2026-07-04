import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Lesson, StepResult } from '../../engine/lessons/types';
import { starsForScore } from '../../engine/lessons/curriculum';
import ReviewBanner from './ReviewBanner';

type Props = {
  lesson: Lesson;
  stepResults: StepResult[];
  totalScore: number;
  nextLesson?: Lesson;
  onSave?: () => void; // called once after mount if provided
};

export default function CompletionScreen({ lesson, stepResults, totalScore, nextLesson, onSave }: Props) {
  const navigate = useNavigate();

  // Trigger save exactly once per completion, even across re-renders
  const savedRef = useRef(false);
  useEffect(() => {
    if (savedRef.current) return;
    savedRef.current = true;
    onSave?.();
  }, [onSave]);

  const stars = starsForScore(totalScore);

  return (
    <div className="lesson-complete">
      <div className="lesson-complete__backdrop" />
      <div className="lesson-complete__card">
        <p className="lesson-complete__eyebrow">
          {lesson.kind === 'song' ? 'Song complete' : 'Lesson complete'}
        </p>
        <h2 className="lesson-complete__title">{lesson.title}</h2>
        {lesson.artist && <p className="lesson-complete__artist">{lesson.artist}</p>}

        <div className="lesson-complete__stars" aria-label={`${stars} of 3 stars`}>
          {[1, 2, 3].map(n => (
            <span key={n} className={'lesson-complete__star' + (n <= stars ? ' is-earned' : '')}>
              ★
            </span>
          ))}
        </div>
        <div className="lesson-complete__total">{totalScore} / 100</div>
        {stars < 3 && (
          <p className="lesson-complete__improve">
            {stars === 1 ? 'Score 80 for two stars' : 'Score 92 for all three'} — replay any time
          </p>
        )}

        <table className="lesson-complete__table">
          <tbody>
            {lesson.steps.map((step, i) => {
              const r = stepResults[i];
              return (
                <tr key={step.id}>
                  <td className="lesson-complete__table-step">{i + 1}</td>
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
          {nextLesson ? (
            <button
              className="lesson-complete__btn lesson-complete__btn--primary"
              onClick={() => navigate(`/learn/${nextLesson.id}`)}
            >
              Next: {nextLesson.title} →
            </button>
          ) : (
            <button
              className="lesson-complete__btn lesson-complete__btn--primary"
              onClick={() => navigate('/play')}
            >
              Play freely →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
