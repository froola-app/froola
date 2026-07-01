import { useNavigate } from 'react-router-dom';
import { CURRICULUM } from '../../engine/lessons/curriculum';
import { useLessonProgress } from '../../engine/lessons/useLessonProgress';
import LessonCard from './LessonCard';
import ReviewBanner from './ReviewBanner';

export default function LessonCatalog() {
  const navigate = useNavigate();
  const { allProgress } = useLessonProgress();

  return (
    <div className="learn-page">
      <header className="learn-header">
        <button className="learn-back-btn" onClick={() => navigate('/play')}>
          ← Play
        </button>
        <div>
          <h1 className="learn-title">Learn</h1>
          <p className="learn-subtitle">Step-by-step lessons to build real musical intuition</p>
        </div>
      </header>

      <ReviewBanner />

      <div className="lesson-grid">
        {CURRICULUM.map(lesson => (
          <LessonCard
            key={lesson.id}
            lesson={lesson}
            progress={allProgress[lesson.id] ?? null}
          />
        ))}
      </div>
    </div>
  );
}
