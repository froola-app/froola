import { useEffect, useRef, useState } from 'react';
import type { LooperState } from '../engine/looper';
import FroolaMascot from './FroolaMascot';

const STEP_KEY = 'froola.guideStep';
const DONE_KEY = 'froola.guideDone';
const INTRO_KEY = 'froola.frooIntroSeen';
const CURSOR_KEY = 'froola.tipCursor';
const CYCLED_KEY = 'froola.tipsCycled';

// One tour, told by Froo. Steps that can be observed advance themselves
// (watching the looper); the rest offer a quiet "got it". Progress persists
// so a returning user never re-hears a step they finished.
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

// Shown once ever, shortly after the tour ends — the only bubble with an ×.
const INTRO_TEXT = 'Hi, I’m Froo. I keep time down here. Tap me whenever you want a tip.';

// Tapping Froo cycles through these, one per tap, wrapping around. A few
// also surface on their own (one every few minutes) until the cycle has
// wrapped once; after that Froo only speaks when poked.
const TIPS: string[] = [
  'Not feeling light mode? Dark mode lives in your profile, top right.',
  'Left wheel picks the chord, right wheel shapes it. That’s the whole instrument.',
  'Press Enter to drop the chord you’re holding straight into the loop.',
  'Make a fist to lock your chord while you move around.',
  'Try a 7th on the right wheel. Instant jazz.',
  'Feeling moody? Switch major to minor down below.',
  'Songs live in keys. Try trading C for something braver.',
  'Arrow keys nudge the octave up and down.',
  'Synth not your thing? There’s a piano in the bottom row.',
  'arp on breaks your chord into a rolling pattern. Off gives you a soft pad.',
  'Loop dragging? The minus and plus around bpm set the pace. I’ll keep up.',
  'Added a clunker? The backspace button removes the last chord.',
  'clear wipes the loop when you want to build something new.',
  'Record, top left, captures your jam as audio you can share.',
  'Record video grabs the whole performance, wheels and all.',
  'Share, top right, makes a link your friends can listen to.',
  'Want to play real songs? The Learn button has lessons.',
  'sus2 and sus4 float. Resolve them to a triad and feel the landing.',
  'Miss the tutorial? Replay it any time from your profile settings.',
];

const TIP_INTRO_MS = 6_000;    // the intro shows soon after the tour ends
const TIP_FIRST_MS = 75_000;   // quiet stretch before the first auto tip
const TIP_EVERY_MS = 180_000;  // and between auto tips after that
const TIP_SHOW_MS = 14_000;    // how long a tip stays up untouched

function storedStep(): number {
  const n = Number(localStorage.getItem(STEP_KEY));
  return Number.isInteger(n) && n >= 0 && n < STEPS.length ? n : 0;
}

function storedCursor(): number {
  const n = Number(localStorage.getItem(CURSOR_KEY));
  return Number.isInteger(n) && n >= 0 && n < TIPS.length ? n : 0;
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

  const [introSeen, setIntroSeen] = useState(() => !!localStorage.getItem(INTRO_KEY));
  const [showIntro, setShowIntro] = useState(false);
  const [tip, setTip] = useState<string | null>(null);
  const cursorRef = useRef(storedCursor());
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const dismissIntro = () => {
    try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* private mode */ }
    setIntroSeen(true);
    setShowIntro(false);
  };

  // Show the next tip in the cycle and restart the auto-hide clock.
  const showNextTip = () => {
    const i = cursorRef.current;
    setTip(TIPS[i]);
    const next = (i + 1) % TIPS.length;
    cursorRef.current = next;
    try {
      localStorage.setItem(CURSOR_KEY, String(next));
      // A full lap means every tip has had its airtime — stop volunteering.
      if (next === 0) localStorage.setItem(CYCLED_KEY, '1');
    } catch { /* private mode */ }
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setTip(null), TIP_SHOW_MS);
  };

  // The one-time introduction, shortly after the tour wraps.
  useEffect(() => {
    if (!active || !tourDone || introSeen) return;
    const t = setTimeout(() => setShowIntro(true), TIP_INTRO_MS);
    return () => clearTimeout(t);
  }, [active, tourDone, introSeen]);

  // Occasional unprompted tips, until the cycle has wrapped once.
  useEffect(() => {
    if (!active || !tourDone || !introSeen) return;
    if (localStorage.getItem(CYCLED_KEY)) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (delay: number) => {
      timer = setTimeout(() => {
        if (localStorage.getItem(CYCLED_KEY)) return;
        showNextTip();
        schedule(TIP_EVERY_MS);
      }, delay);
    };
    schedule(TIP_FIRST_MS);

    return () => { if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, tourDone, introSeen]);

  // Tapping Froo: dismiss the intro if it's up, otherwise cycle to the
  // next tip. No × needed — another tap brings the next one.
  const poke = () => {
    if (!tourDone) return;
    beHappy();
    if (showIntro) dismissIntro();
    showNextTip();
  };

  useEffect(() => () => {
    if (happyTimer.current) clearTimeout(happyTimer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  if (!active) return null;

  const inTour = !tourDone;
  const bubbleText = inTour ? current.text : showIntro ? INTRO_TEXT : tip;
  const needsButton = inTour && !current.observe && !current.dwellMs;

  return (
    <div className="froo-guide" role="status">
      <button
        className="froo-guide__poke"
        onClick={poke}
        disabled={inTour}
        aria-label="Froo, the froola guide"
        title={inTour ? undefined : 'Tap Froo for a tip'}
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
          {inTour && (
            <button
              className="froo-guide__close"
              onClick={finishTour}
              aria-label="Skip tour"
            >
              ×
            </button>
          )}
          {!inTour && showIntro && (
            <button
              className="froo-guide__close"
              onClick={dismissIntro}
              aria-label="Dismiss introduction"
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}
