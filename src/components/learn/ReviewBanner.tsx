import { useNavigate } from 'react-router-dom';
import { useReviewProgress } from '../../engine/lessons/useReviewProgress';

export default function ReviewBanner() {
  const navigate = useNavigate();
  const { dueCount } = useReviewProgress();

  if (dueCount === 0) return null;

  return (
    <button className="review-banner" onClick={() => navigate('/learn/review')}>
      <span className="review-banner__title">
        {dueCount} chord{dueCount !== 1 ? 's' : ''} due for review
      </span>
      <span className="review-banner__cta">Review now →</span>
    </button>
  );
}
