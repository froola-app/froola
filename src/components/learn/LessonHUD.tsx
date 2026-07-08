import type { LessonPhase } from '../../engine/lessons/types';
import { useEncouragement } from './encouragement';

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
  /** 0–100 score required to pass this step — shown before the attempt starts. */
  minScore: number;
  /** Song lessons: the chord to play right now / coming up next. */
  chordNow?: string;
  chordNext?: string;
  /** Whether a chord is currently fist-locked / space-held. */
  sustained?: boolean;
  /** Practice phase only: label of the chord currently being learned. */
  practiceChord?: string;
  practiceChordIndex?: number;
  practiceChordCount?: number;
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
  minScore,
  chordNow,
  chordNext,
  sustained,
  practiceChord,
  practiceChordIndex,
  practiceChordCount,
}: Props) {
  const cheer = useEncouragement(stepScore, phase === 'attempt');

  if (phase === 'preview') {
    return (
      <div className="lesson-hud lesson-hud--preview">
        <p className="lesson-hud__preview-eyebrow">Watch &amp; listen</p>
        <p className="lesson-hud__listen">Here&apos;s what you&apos;re about to play</p>
        <p className="lesson-hud__preview-hint">Follow the glowing hands — your turn is next</p>
      </div>
    );
  }

  if (phase === 'practice') {
    return (
      <div className="lesson-hud lesson-hud--practice">
        <p className="lesson-hud__preview-eyebrow">Take your time</p>
        <p className="lesson-hud__listen">
          Find and hold <strong>{practiceChord}</strong> — no timer, no score
        </p>
        <div className="lesson-hud__practice-dots">
          {Array.from({ length: practiceChordCount ?? 0 }, (_, i) => (
            <span
              key={i}
              className={
                'lesson-hud__dot' +
                (i === practiceChordIndex ? ' is-active' : i < (practiceChordIndex ?? 0) ? ' is-done' : '')
              }
            />
          ))}
        </div>
        {hint && <p className="lesson-hud__hint">{hint}</p>}
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
        <p className="lesson-hud__target">Score {minScore}%+ to pass</p>
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

        {sustained && <p className="lesson-hud__lock">🔒 Chord locked</p>}

        {cheer && <p key={cheer} className="lesson-hud__cheer">{cheer}</p>}

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
