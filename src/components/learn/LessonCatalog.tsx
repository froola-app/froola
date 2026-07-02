import { useNavigate } from 'react-router-dom';
import { LEARNING_PATH, starsForScore } from '../../engine/lessons/curriculum';
import { useLessonProgress } from '../../engine/lessons/useLessonProgress';
import LessonCard from './LessonCard';
import ReviewBanner from './ReviewBanner';

export default function LessonCatalog() {
  const navigate = useNavigate();
  const { allProgress } = useLessonProgress();

  const isComplete = (id: string) => allProgress[id]?.completedAt != null;

  // Every lesson is playable — the path order is a recommendation, and the
  // first uncompleted lesson gets an "up next" nudge rather than a gate.
  const upNextIndex = LEARNING_PATH.findIndex(l => !isComplete(l.id));

  const completedCount = LEARNING_PATH.filter(l => isComplete(l.id)).length;
  const starCount = LEARNING_PATH.reduce((sum, l) => {
    const p = allProgress[l.id];
    return p?.completedAt != null ? sum + starsForScore(p.bestScore) : sum;
  }, 0);

  return (
    <div className="learn-page">
      <div className="learn-page__inner">
        <header className="learn-header">
          <button className="learn-back-btn" onClick={() => navigate('/')}>
            ← back to play
          </button>
          <p className="learn-eyebrow">froola lessons</p>
          <h1 className="learn-title">
            From zero to <em>Wonderwall.</em>
          </h1>
          <p className="learn-subtitle">
            A guided path of real songs — follow it in order, or jump straight to one you love.
          </p>
          <div className="learn-progress">
            <span className="learn-progress__count">
              {completedCount} / {LEARNING_PATH.length} complete
            </span>
            <span className="learn-progress__stars">★ {starCount} / {LEARNING_PATH.length * 3}</span>
          </div>
        </header>

        <ReviewBanner />

        <ol className="lesson-path">
          {LEARNING_PATH.map((lesson, i) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              progress={allProgress[lesson.id] ?? null}
              index={i}
              isNext={i === upNextIndex}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}
