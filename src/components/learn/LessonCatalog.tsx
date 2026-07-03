import { useNavigate } from 'react-router-dom';
import { LEARNING_PATH, starsForScore } from '../../engine/lessons/curriculum';
import { useLessonProgress } from '../../engine/lessons/useLessonProgress';
import { JourneyCard, UpNextCard } from './LessonCard';
import ReviewBanner from './ReviewBanner';

export default function LessonCatalog() {
  const navigate = useNavigate();
  const { allProgress } = useLessonProgress();

  const isComplete = (id: string) => allProgress[id]?.completedAt != null;

  // The learning path is one ordered journey — technique drills interleaved
  // with the songs they prepare. The first uncompleted lesson is where the
  // spine's orange fill stops and the "up next" card points.
  const upNext = LEARNING_PATH.find(l => !isComplete(l.id));
  const total = LEARNING_PATH.length;
  const completedCount = LEARNING_PATH.filter(l => isComplete(l.id)).length;
  const starCount = LEARNING_PATH.reduce((sum, l) => {
    const p = allProgress[l.id];
    return p?.completedAt != null ? sum + starsForScore(p.bestScore) : sum;
  }, 0);
  const pct = Math.round((completedCount / total) * 100);
  // Fresh start = nothing done yet; the very first lesson reads "Start here".
  const isFreshStart = completedCount === 0;

  return (
    <div className="learn-page">
      <div className="learn-page__inner">
        <header className="learn-header">
          <button className="learn-back-btn" onClick={() => navigate('/')}>
            ← back to play
          </button>
          <p className="learn-eyebrow">Froola Lessons</p>
          <h1 className="learn-title">
            From zero to <em>Wonderwall.</em>
          </h1>
          <p className="learn-subtitle">
            One guided path of real songs — follow it in order, or jump straight to one you love.
          </p>
          <div className="learn-meter">
            <div className="learn-meter__track">
              <div className="learn-meter__fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="learn-meter__stats">
              <span className="learn-meter__count">
                {completedCount}<span>/{total}</span> complete
              </span>
              <span className="learn-meter__stars">
                ★ {starCount}<span>/{total * 3}</span>
              </span>
            </div>
          </div>
        </header>

        <ReviewBanner />

        {upNext && (
          <UpNextCard lesson={upNext} isStart={isFreshStart} />
        )}

        <section className="journey">
          <h2 className="journey__label">The journey</h2>
          <ol className="journey__list">
            {LEARNING_PATH.map(lesson => (
              <JourneyCard
                key={lesson.id}
                lesson={lesson}
                progress={allProgress[lesson.id] ?? null}
                isNext={lesson.id === upNext?.id}
                isComplete={isComplete(lesson.id)}
              />
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
