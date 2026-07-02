import { useNavigate } from 'react-router-dom';
import type { Lesson, LessonProgress } from '../../engine/lessons/types';
import { starsForScore } from '../../engine/lessons/curriculum';

type Props = {
  lesson: Lesson;
  progress: LessonProgress | null;
  index: number;   // position in the learning path (0-based)
  isNext: boolean; // the first uncompleted lesson — recommended next
};

export default function LessonCard({ lesson, progress, index, isNext }: Props) {
  const navigate = useNavigate();

  const completed = progress?.completedAt != null;
  const stars = completed ? starsForScore(progress.bestScore) : 0;
  const isSong = lesson.kind === 'song';

  const className = [
    'lesson-row',
    isSong ? 'lesson-row--song' : 'lesson-row--technique',
    isNext && 'is-next',
    completed && 'is-complete',
  ].filter(Boolean).join(' ');

  return (
    <li className={className}>
      <button className="lesson-row__btn" onClick={() => navigate(`/learn/${lesson.id}`)}>
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
          {completed ? (
            <span className="lesson-row__stars" aria-label={`${stars} of 3 stars`}>
              {[1, 2, 3].map(n => (
                <span key={n} className={'lesson-row__star' + (n <= stars ? ' is-earned' : '')}>★</span>
              ))}
            </span>
          ) : (
            <span className="lesson-row__cta">{isNext ? 'up next' : 'play'} →</span>
          )}
        </span>
      </button>
    </li>
  );
}
