import type { LessonPhase } from '../../engine/lessons/types';

type Props = {
  phase: LessonPhase;
  stepIndex: number;
  totalSteps: number;
  instruction: string;
  hint?: string;
  countdown: number;
  stepScore: number;
  elapsed: number;
  durationMs: number;
};

export default function LessonHUD({
  phase,
  stepIndex,
  totalSteps,
  instruction,
  hint,
  countdown,
  stepScore,
  elapsed,
  durationMs,
}: Props) {
  if (phase === 'preview') {
    return (
      <div className="lesson-hud lesson-hud--preview">
        <p className="lesson-hud__listen">Listen to the target…</p>
      </div>
    );
  }

  if (phase === 'countdown') {
    return (
      <div className="lesson-hud lesson-hud--countdown">
        <div className="lesson-countdown">{countdown === 0 ? 'Go!' : countdown}</div>
        <p className="lesson-hud__instruction">{instruction}</p>
      </div>
    );
  }

  if (phase === 'attempt') {
    const scorePct = Math.round(stepScore);
    const timePct = Math.min((elapsed / durationMs) * 100, 100);
    const scoreColor = scorePct >= 70 ? '#22c55e' : scorePct >= 40 ? '#f59e0b' : '#ef4444';

    return (
      <div className="lesson-hud lesson-hud--attempt">
        <div className="lesson-hud__steps">
          {Array.from({ length: totalSteps }, (_, i) => (
            <span
              key={i}
              className={
                'lesson-hud__dot' +
                (i === stepIndex ? ' is-active' : i < stepIndex ? ' is-done' : '')
              }
            />
          ))}
        </div>
        <p className="lesson-hud__instruction">{instruction}</p>
        {hint && <p className="lesson-hud__hint">{hint}</p>}
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
