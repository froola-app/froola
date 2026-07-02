import { useNavigate } from 'react-router-dom';
import type { Lesson, LessonProgress } from '../../engine/lessons/types';
import { starsForScore } from '../../engine/lessons/curriculum';

type Props = {
  lesson: Lesson;
  progress: LessonProgress | null;
  index: number;   // position in the learning path (0-based)
  locked: boolean;
  isNext: boolean; // the first unlocked, uncompleted lesson
};

export default function LessonCard({ lesson, progress, index, locked, isNext }: Props) {
  const navigate = useNavigate();

  const completed = progress?.completedAt != null;
  const stars = completed ? starsForScore(progress.bestScore) : 0;
  const isSong = lesson.kind === 'song';

  const className = [
    'lesson-row',
    isSong ? 'lesson-row--song' : 'lesson-row--technique',
    locked && 'is-locked',
    isNext && 'is-next',
    completed && 'is-complete',
  ].filter(Boolean).join(' ');

  const body = (
    <>
      <span className="lesson-row__index">{String(index + 1).padStart(2, '0')}</span>

      <span className="lesson-row__main">
        <span className="lesson-row__eyebrow">
          {isSong ? lesson.artist : 'technique'}
        </span>
        <span className="lesson-row__title">{lesson.title}</span>
        {isSong && lesson.progression ? (
          <span className="lesson-row__progression">
            {lesson.progression.map((c, i) => (
              <span key={i} className="chord-chip">{c}</span>
            ))}
          </span>
        ) : (
          <span className="lesson-row__subtitle">{lesson.subtitle}</span>
        )}
      </span>

      <span className="lesson-row__status">
        {locked ? (
          <span className="lesson-row__lock" aria-label="Locked">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" />
            </svg>
          </span>
        ) : completed ? (
          <span className="lesson-row__stars" aria-label={`${stars} of 3 stars`}>
            {[1, 2, 3].map(n => (
              <span key={n} className={'lesson-row__star' + (n <= stars ? ' is-earned' : '')}>★</span>
            ))}
          </span>
        ) : (
          <span className="lesson-row__cta">{isNext ? 'up next' : 'play'} →</span>
        )}
      </span>
    </>
  );

  if (locked) {
    return <li className={className} aria-disabled="true">{body}</li>;
  }

  return (
    <li className={className}>
      <button className="lesson-row__btn" onClick={() => navigate(`/learn/${lesson.id}`)}>
        {body}
      </button>
    </li>
  );
}
