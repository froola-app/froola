import { useNavigate } from 'react-router-dom';
import type { Lesson, LessonProgress } from '../../engine/lessons/types';
import { starsForScore } from '../../engine/lessons/curriculum';

type Props = {
  lesson: Lesson;
  progress: LessonProgress | null;
  index: number;   // position within this section (0-based)
  isNext: boolean; // the first uncompleted lesson overall — recommended next
};

function Stars({ stars }: { stars: number }) {
  return (
    <span className="lesson-card__stars" aria-label={`${stars} of 3 stars`}>
      {[1, 2, 3].map(n => (
        <span key={n} className={'lesson-card__star' + (n <= stars ? ' is-earned' : '')}>★</span>
      ))}
    </span>
  );
}

export function TechniqueCard({ lesson, progress, index, isNext }: Props) {
  const navigate = useNavigate();
  const completed = progress?.completedAt != null;
  const stars = completed ? starsForScore(progress.bestScore) : 0;

  const className = ['technique-card', isNext && 'is-next', completed && 'is-complete']
    .filter(Boolean).join(' ');

  return (
    <li className={className}>
      <button className="technique-card__btn" onClick={() => navigate(`/learn/${lesson.id}`)}>
        <span className="technique-card__num">{String(index + 1).padStart(2, '0')}</span>
        <span className="technique-card__title">{lesson.title}</span>
        <span className="technique-card__subtitle">{lesson.subtitle}</span>
        <span className="technique-card__status">
          {completed ? <Stars stars={stars} /> : (
            <span className="technique-card__cta">{isNext ? 'up next' : 'play'} →</span>
          )}
        </span>
      </button>
    </li>
  );
}

export function SongCard({ lesson, progress, index, isNext }: Props) {
  const navigate = useNavigate();
  const completed = progress?.completedAt != null;
  const stars = completed ? starsForScore(progress.bestScore) : 0;

  const className = ['song-card', isNext && 'is-next', completed && 'is-complete']
    .filter(Boolean).join(' ');

  return (
    <li className={className}>
      <button className="song-card__btn" onClick={() => navigate(`/learn/${lesson.id}`)}>
        <span className="song-card__num">{String(index + 1).padStart(2, '0')}</span>
        <span className="song-card__main">
          <span className="song-card__artist">{lesson.artist}</span>
          <span className="song-card__title">{lesson.title}</span>
          {lesson.progression && (
            <span className="song-card__progression">
              {lesson.progression.map((c, i) => (
                <span key={i} className="chord-chip">{c}</span>
              ))}
            </span>
          )}
        </span>
        <span className="song-card__status">
          {completed ? <Stars stars={stars} /> : (
            <span className="song-card__cta">{isNext ? 'up next' : 'play'} →</span>
          )}
        </span>
      </button>
    </li>
  );
}
