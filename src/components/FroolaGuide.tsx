import { useEffect, useRef, useState } from 'react';
import type { LooperState } from '../engine/looper';
import FroolaMascot from './FroolaMascot';

const STEP_KEY = 'froola.guideStep';
const DONE_KEY = 'froola.guideDone';

// One tour, told by froo. Steps that can be observed advance themselves
// (watching the looper); the rest offer a quiet "got it". Progress persists
// so a returning user never re-hears a tip they finished.
const STEPS: {
  text: string;
  /** Advance automatically when this becomes true. */
  observe?: (loop: LooperState) => boolean;
  /** Auto-advance after this many ms on screen (for "just play" beats). */
  dwellMs?: number;
}[] = [
  {
    text: 'Hi, I’m froo. Hear a chord you like? Tap + chord below to keep it.',
    observe: loop => loop.slots.length >= 1,
  },
  {
    text: 'Kept! Collect two or three more, then press play.',
    observe: loop => loop.playing,
  },
  {
    text: 'Your loop plays itself now. Solo over it on the left wheel.',
    dwellMs: 12000,
  },
  {
    text: 'Sounding froolish? Record, top left, captures your jam to share.',
  },
  {
    text: 'That’s the tour. Froo la la.',
    dwellMs: 4000,
  },
];

function storedStep(): number {
  const n = Number(localStorage.getItem(STEP_KEY));
  return Number.isInteger(n) && n >= 0 && n < STEPS.length ? n : 0;
}

interface Props {
  loopState: LooperState;
  /** Suppressed while the tutorial overlay is up or no input mode is chosen. */
  active: boolean;
}

export default function FroolaGuide({ loopState, active }: Props) {
  const [done, setDone] = useState(() => !!localStorage.getItem(DONE_KEY));
  const [step, setStep] = useState(storedStep);
  const [happy, setHappy] = useState(false);
  const happyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = () => {
    try { localStorage.setItem(DONE_KEY, '1'); } catch { /* private mode */ }
    setDone(true);
  };

  const advance = () => {
    if (happyTimer.current) clearTimeout(happyTimer.current);
    setHappy(true);
    happyTimer.current = setTimeout(() => setHappy(false), 1400);
    setStep(s => {
      const next = s + 1;
      if (next >= STEPS.length) {
        finish();
        return s;
      }
      try { localStorage.setItem(STEP_KEY, String(next)); } catch { /* private mode */ }
      return next;
    });
  };

  // Observed advancement — froo reacts to what the player actually does.
  const current = STEPS[step];
  useEffect(() => {
    if (!active || done) return;
    if (current.observe?.(loopState)) advance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, done, step, loopState]);

  // Dwell advancement for beats with nothing to observe but time.
  useEffect(() => {
    if (!active || done || !current.dwellMs) return;
    const isLast = step === STEPS.length - 1;
    const t = setTimeout(() => (isLast ? finish() : advance()), current.dwellMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, done, step]);

  useEffect(() => () => {
    if (happyTimer.current) clearTimeout(happyTimer.current);
  }, []);

  if (!active || done) return null;

  const needsButton = !current.observe && !current.dwellMs;

  return (
    <div className="froo-guide" role="status">
      <FroolaMascot size={40} mood={happy ? 'happy' : 'idle'} />
      <div className="froo-guide__bubble">
        <p className="froo-guide__text">{current.text}</p>
        {needsButton && (
          <button className="froo-guide__ok" onClick={advance}>got it</button>
        )}
        <button
          className="froo-guide__close"
          onClick={finish}
          aria-label="Dismiss guide"
        >
          ×
        </button>
      </div>
    </div>
  );
}
