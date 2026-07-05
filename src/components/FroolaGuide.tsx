import { useEffect, useRef, useState } from 'react';
import type { LooperState } from '../engine/looper';
import FroolaMascot from './FroolaMascot';

const STEP_KEY = 'froola.guideStep';
const DONE_KEY = 'froola.guideDone';
const TIPS_KEY = 'froola.tipsSeen';

// One tour, told by Froo. Steps that can be observed advance themselves
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
    text: 'Hi, I’m Froo. Hear a chord you like? Tap + chord below to keep it.',
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

// After the tour, Froo stays in the corner and occasionally offers one of
// these — each once ever, dismiss any time, or poke Froo for the next one.
const TIPS: { id: string; text: string }[] = [
  { id: 'theme', text: 'Not feeling light mode? Dark mode lives in your profile, top right.' },
  { id: 'enter', text: 'Press Enter to drop the chord you’re holding straight into the loop.' },
  { id: 'octave', text: 'Arrow keys nudge the octave up and down.' },
  { id: 'scale', text: 'Feeling moody? Try switching major to minor down below.' },
  { id: 'learn', text: 'Want to play real songs? The Learn button has lessons.' },
];

const TIP_FIRST_MS = 75_000;   // quiet stretch before the first tip
const TIP_EVERY_MS = 180_000;  // and between tips after that
const TIP_SHOW_MS = 15_000;    // how long a tip stays up unattended

function storedStep(): number {
  const n = Number(localStorage.getItem(STEP_KEY));
  return Number.isInteger(n) && n >= 0 && n < STEPS.length ? n : 0;
}

function storedTipsSeen(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(TIPS_KEY) ?? '[]');
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

interface Props {
  loopState: LooperState;
  /** Suppressed while the tutorial overlay is up or no input mode is chosen. */
  active: boolean;
}

export default function FroolaGuide({ loopState, active }: Props) {
  const [tourDone, setTourDone] = useState(() => !!localStorage.getItem(DONE_KEY));
  const [step, setStep] = useState(storedStep);
  const [happy, setHappy] = useState(false);
  const happyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [tip, setTip] = useState<{ id: string; text: string } | null>(null);
  const tipsSeenRef = useRef(storedTipsSeen());

  const finishTour = () => {
    try { localStorage.setItem(DONE_KEY, '1'); } catch { /* private mode */ }
    setTourDone(true);
  };

  const beHappy = () => {
    if (happyTimer.current) clearTimeout(happyTimer.current);
    setHappy(true);
    happyTimer.current = setTimeout(() => setHappy(false), 1400);
  };

  const advance = () => {
    beHappy();
    setStep(s => {
      const next = s + 1;
      if (next >= STEPS.length) {
        finishTour();
        return s;
      }
      try { localStorage.setItem(STEP_KEY, String(next)); } catch { /* private mode */ }
      return next;
    });
  };

  // Observed advancement — Froo reacts to what the player actually does.
  const current = STEPS[step];
  useEffect(() => {
    if (!active || tourDone) return;
    if (current.observe?.(loopState)) advance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, tourDone, step, loopState]);

  // Dwell advancement for beats with nothing to observe but time.
  useEffect(() => {
    if (!active || tourDone || !current.dwellMs) return;
    const isLast = step === STEPS.length - 1;
    const t = setTimeout(() => (isLast ? finishTour() : advance()), current.dwellMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, tourDone, step]);

  const nextUnseenTip = () =>
    TIPS.find(t => !tipsSeenRef.current.has(t.id)) ?? null;

  const closeTip = () => {
    setTip(t => {
      if (t) {
        tipsSeenRef.current.add(t.id);
        try {
          localStorage.setItem(TIPS_KEY, JSON.stringify([...tipsSeenRef.current]));
        } catch { /* private mode */ }
      }
      return null;
    });
  };

  // Occasional tips: a long quiet stretch, then one unseen tip at a time.
  // Each tip auto-hides and is marked seen so Froo never repeats himself.
  useEffect(() => {
    if (!active || !tourDone) return;
    let show: ReturnType<typeof setTimeout> | null = null;
    let hide: ReturnType<typeof setTimeout> | null = null;

    const scheduleNext = (delay: number) => {
      show = setTimeout(() => {
        const next = nextUnseenTip();
        if (!next) return;
        setTip(next);
        hide = setTimeout(() => {
          closeTip();
          scheduleNext(TIP_EVERY_MS);
        }, TIP_SHOW_MS);
      }, delay);
    };
    scheduleNext(TIP_FIRST_MS);

    return () => {
      if (show) clearTimeout(show);
      if (hide) clearTimeout(hide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, tourDone]);

  // Poking Froo asks for a tip right now (or hides the current one).
  const poke = () => {
    if (!tourDone) return;
    if (tip) {
      closeTip();
      return;
    }
    const next = nextUnseenTip() ?? TIPS[Math.floor(Math.random() * TIPS.length)];
    beHappy();
    setTip(next);
  };

  useEffect(() => () => {
    if (happyTimer.current) clearTimeout(happyTimer.current);
  }, []);

  if (!active) return null;

  const inTour = !tourDone;
  const bubbleText = inTour ? current.text : tip?.text;
  const needsButton = inTour && !current.observe && !current.dwellMs;

  return (
    <div className="froo-guide" role="status">
      <button
        className="froo-guide__poke"
        onClick={poke}
        disabled={inTour}
        aria-label="Froo, the froola guide"
        title={inTour ? undefined : 'Ask Froo for a tip'}
      >
        <FroolaMascot
          size={inTour ? 52 : 44}
          mood={happy ? 'happy' : 'idle'}
          bpm={loopState.playing ? loopState.bpm : undefined}
        />
      </button>
      {bubbleText && (
        <div className="froo-guide__bubble">
          <p className="froo-guide__text">{bubbleText}</p>
          {needsButton && (
            <button className="froo-guide__ok" onClick={advance}>got it</button>
          )}
          <button
            className="froo-guide__close"
            onClick={inTour ? finishTour : closeTip}
            aria-label={inTour ? 'Dismiss guide' : 'Dismiss tip'}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
