import { useNavigate } from 'react-router-dom';
import { LEARNING_PATH, starsForScore } from '../../engine/lessons/curriculum';
import { useLessonProgress } from '../../engine/lessons/useLessonProgress';
import LessonCard from './LessonCard';
import ReviewBanner from './ReviewBanner';

export default function LessonCatalog() {
  const navigate = useNavigate();
  const { allProgress } = useLessonProgress();

  const isComplete = (id: string) => allProgress[id]?.completedAt != null;

  // Sequential unlock: the first lesson is always open; each one after opens
  // when the previous is complete. (Progress loads async — until it arrives,
  // only lesson 1 shows unlocked, then the list fills in.)
  const unlocked = LEARNING_PATH.map((_, i) => i === 0 || isComplete(LEARNING_PATH[i - 1].id));
  const upNextIndex = LEARNING_PATH.findIndex((l, i) => unlocked[i] && !isComplete(l.id));

  const completedCount = LEARNING_PATH.filter(l => isComplete(l.id)).length;
  const starCount = LEARNING_PATH.reduce((sum, l) => {
    const p = allProgress[l.id];
    return p?.completedAt != null ? sum + starsForScore(p.bestScore) : sum;
  }, 0);

  return (
    <div className="learn-page">
      <div className="learn-page__inner">
        <header className="learn-header">
          <button className="learn-back-btn" onClick={() => navigate('/play')}>
            ← back to play
          </button>
          <p className="learn-eyebrow">froola lessons</p>
          <h1 className="learn-title">
            From zero to <em>Wonderwall.</em>
          </h1>
          <p className="learn-subtitle">
            A guided path of real songs — each technique you learn unlocks the song that uses it.
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
              locked={!unlocked[i]}
              isNext={i === upNextIndex}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}
