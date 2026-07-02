import { useNavigate } from 'react-router-dom';
import { useReviewProgress } from '../../engine/lessons/useReviewProgress';

export default function ReviewBanner() {
  const navigate = useNavigate();
  const { dueCount, hasEligibleDrills } = useReviewProgress();

  // Nothing to review yet (no lesson completed) — the feature has nothing
  // to say, so stay hidden rather than reference chords the user hasn't
  // learned. Once they've completed a lesson, always show an entry point —
  // due count when there's something to do, an explanatory state otherwise —
  // so spaced review isn't only discoverable at the one moment it's due.
  if (!hasEligibleDrills) return null;

  return (
    <button className="review-banner" onClick={() => navigate('/learn/review')}>
      <span className="review-banner__title">
        {dueCount === 0 ? 'Chord review' : `${dueCount} chord${dueCount !== 1 ? 's' : ''} due for review`}
      </span>
      <span className="review-banner__cta">
        {dueCount === 0 ? "Nothing due — you're on top of it →" : 'Review now →'}
      </span>
    </button>
  );
}
