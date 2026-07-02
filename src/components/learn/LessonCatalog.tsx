import { useNavigate } from 'react-router-dom';
import { LEARNING_PATH, TECHNIQUE_PATH, SONG_PATH, starsForScore } from '../../engine/lessons/curriculum';
import { useLessonProgress } from '../../engine/lessons/useLessonProgress';
import { TechniqueCard, SongCard } from './LessonCard';
import ReviewBanner from './ReviewBanner';

export default function LessonCatalog() {
  const navigate = useNavigate();
  const { allProgress } = useLessonProgress();

  const isComplete = (id: string) => allProgress[id]?.completedAt != null;

  // Every lesson is playable — the path order is a recommendation, and the
  // first uncompleted lesson gets an "up next" nudge rather than a gate.
  // The nudge is computed over the combined pedagogical order even though
  // the two sections render separately below.
  const upNextId = LEARNING_PATH.find(l => !isComplete(l.id))?.id;

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

        <section className="learn-section">
          <h2 className="learn-section__label">Technique drills</h2>
          <ol className="technique-grid">
            {TECHNIQUE_PATH.map((lesson, i) => (
              <TechniqueCard
                key={lesson.id}
                lesson={lesson}
                progress={allProgress[lesson.id] ?? null}
                index={i}
                isNext={lesson.id === upNextId}
              />
            ))}
          </ol>
        </section>

        <section className="learn-section">
          <h2 className="learn-section__label">Songs</h2>
          <ol className="song-list">
            {SONG_PATH.map((lesson, i) => (
              <SongCard
                key={lesson.id}
                lesson={lesson}
                progress={allProgress[lesson.id] ?? null}
                index={i}
                isNext={lesson.id === upNextId}
              />
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
