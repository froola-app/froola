import { useNavigate } from 'react-router-dom';
import type { Lesson, LessonProgress } from '../../engine/lessons/types';

type Props = {
  lesson: Lesson;
  progress: LessonProgress | null;
};

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export default function LessonCard({ lesson, progress }: Props) {
  const navigate = useNavigate();

  return (
    <button
      className="lesson-card"
      onClick={() => navigate(`/learn/${lesson.id}`)}
    >
      <div className="lesson-card__header">
        <span className={`lesson-card__difficulty lesson-card__difficulty--${lesson.difficulty}`}>
          {DIFFICULTY_LABEL[lesson.difficulty]}
        </span>
        {progress?.completedAt != null && (
          <span className="lesson-card__badge">
            {progress.bestScore}
          </span>
        )}
      </div>

      <h3 className="lesson-card__title">{lesson.title}</h3>
      <p className="lesson-card__subtitle">{lesson.subtitle}</p>

      <div className="lesson-card__footer">
        <span className="lesson-card__steps">{lesson.steps.length} step{lesson.steps.length !== 1 ? 's' : ''}</span>
        <div className="lesson-card__tags">
          {lesson.tags.slice(0, 2).map(t => (
            <span key={t} className="lesson-card__tag">{t}</span>
          ))}
        </div>
      </div>
    </button>
  );
}
