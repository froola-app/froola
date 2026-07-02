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
  /** Song lessons: the chord to play right now / coming up next. */
  chordNow?: string;
  chordNext?: string;
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
  chordNow,
  chordNext,
}: Props) {
  if (phase === 'preview') {
    return (
      <div className="lesson-hud lesson-hud--preview">
        <p className="lesson-hud__listen">
          <span className="lesson-hud__listen-dot" />
          Watch &amp; listen…
        </p>
      </div>
    );
  }

  if (phase === 'countdown') {
    return (
      <div className="lesson-hud lesson-hud--countdown">
        <div className="lesson-countdown">{countdown === 0 ? 'Go!' : countdown}</div>
        <p className="lesson-hud__instruction">{instruction}</p>
        {chordNow ? (
          <p className="lesson-hud__first-chord">
            First chord: <strong>{chordNow}</strong>
          </p>
        ) : (
          hint && <p className="lesson-hud__hint">{hint}</p>
        )}
      </div>
    );
  }

  if (phase === 'attempt') {
    const scorePct = Math.round(stepScore);
    const timePct = Math.min((elapsed / durationMs) * 100, 100);

    return (
      <div className="lesson-hud lesson-hud--attempt">
        <div className="lesson-hud__top">
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
        </div>

        {chordNow && (
          <div className="lesson-hud__chords">
            <div className="lesson-hud__chord-now">{chordNow}</div>
            {chordNext && (
              <div className="lesson-hud__chord-next">
                next&ensp;<strong>{chordNext}</strong>
              </div>
            )}
          </div>
        )}

        <div className="lesson-hud__bars">
          <div className="lesson-hud__bar-row">
            <span className="lesson-hud__bar-label">score</span>
            <div className="lesson-hud__bar-track">
              <div
                className={
                  'lesson-hud__bar-fill' +
                  (scorePct >= 70 ? ' is-good' : scorePct >= 40 ? ' is-mid' : ' is-low')
                }
                style={{ width: `${scorePct}%` }}
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
