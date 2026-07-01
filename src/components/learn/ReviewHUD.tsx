import type { ReviewPhase } from '../../engine/lessons/useReviewRunner';
import { REVIEW_HOLD_MS } from '../../engine/lessons/useReviewRunner';

type Props = {
  phase: ReviewPhase;
  drillIndex: number;
  totalDrills: number;
  label: string;
  countdown: number;
  liveScore: number;
  elapsed: number;
};

export default function ReviewHUD({
  phase,
  drillIndex,
  totalDrills,
  label,
  countdown,
  liveScore,
  elapsed,
}: Props) {
  if (phase === 'countdown') {
    return (
      <div className="lesson-hud lesson-hud--countdown">
        <div className="lesson-countdown">{countdown === 0 ? 'Go!' : countdown}</div>
        <p className="lesson-hud__instruction">Play: {label}</p>
      </div>
    );
  }

  if (phase === 'attempt') {
    const scorePct = Math.round(liveScore);
    const timePct = Math.min((elapsed / REVIEW_HOLD_MS) * 100, 100);
    const scoreColor = scorePct >= 70 ? '#22c55e' : scorePct >= 40 ? '#f59e0b' : '#ef4444';

    return (
      <div className="lesson-hud lesson-hud--attempt">
        <div className="lesson-hud__steps">
          {Array.from({ length: totalDrills }, (_, i) => (
            <span
              key={i}
              className={
                'lesson-hud__dot' +
                (i === drillIndex ? ' is-active' : i < drillIndex ? ' is-done' : '')
              }
            />
          ))}
        </div>
        <p className="lesson-hud__instruction">Play: {label}</p>
        <div className="lesson-hud__bars">
          <div className="lesson-hud__bar-row">
            <span className="lesson-hud__bar-label">score</span>
            <div className="lesson-hud__bar-track">
              <div
                className="lesson-hud__bar-fill"
                style={{ width: `${scorePct}%`, background: scoreColor }}
              />
            </div>
            <span className="lesson-hud__bar-value">{scorePct}</span>
          </div>
          <div className="lesson-hud__bar-row">
            <span className="lesson-hud__bar-label">time</span>
            <div className="lesson-hud__bar-track">
              <div
                className="lesson-hud__bar-fill lesson-hud__bar-fill--time"
                style={{ width: `${timePct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
