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

function StepDots({ total, active }: { total: number; active: number }) {
  return (
    <div className="lesson-hud__steps">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={
            'lesson-hud__dot' +
            (i === active ? ' is-active' : i < active ? ' is-done' : '')
          }
        />
      ))}
    </div>
  );
}

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
        <div className="lesson-hud__preview-top">
          <StepDots total={totalSteps} active={stepIndex} />
          <span className="lesson-hud__listen-pill">Listen</span>
        </div>
        <div className="lesson-hud__preview-center">
          <p className="lesson-hud__instruction">{instruction}</p>
          {hint && <p className="lesson-hud__hint">{hint}</p>}
        </div>
      </div>
    );
  }

  if (phase === 'countdown') {
    return (
      <div className="lesson-hud lesson-hud--countdown">
        <StepDots total={totalSteps} active={stepIndex} />
        <div className="lesson-countdown">{countdown === 0 ? 'Go!' : countdown}</div>
        <div className="lesson-hud__countdown-footer">
          <p className="lesson-hud__instruction">{instruction}</p>
          {hint && <p className="lesson-hud__hint">{hint}</p>}
        </div>
      </div>
    );
  }

  if (phase === 'attempt') {
    const scorePct = Math.round(stepScore);
    const timePct = Math.min((elapsed / durationMs) * 100, 100);
    const scoreColor = scorePct >= 70 ? '#22c55e' : scorePct >= 40 ? '#f59e0b' : '#ef4444';

    return (
      <div className="lesson-hud lesson-hud--attempt">
        <div className="lesson-hud__top">
          <StepDots total={totalSteps} active={stepIndex} />
        </div>
        <div className="lesson-hud__mid">
          <p className="lesson-hud__instruction">{instruction}</p>
          {hint && <p className="lesson-hud__hint">{hint}</p>}
        </div>
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
