import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { RefObject } from 'react';
import type { GestureSignal } from '../engine/types';
import type { DialSelection } from '../engine/renderer';
import { wheelGeometry } from '../engine/renderer/geometry';
import FroolaMascot from './FroolaMascot';

const TUTORIAL_KEY = 'froola.tutorialSeen';

// Pacing guards: a step never auto-advances before it's been readable for
// MIN_STEP_MS, and its success condition must hold continuously for
// HOLD_MS. Without these, a user whose hands were already up when the
// tutorial mounted blew through step 1 in a single 100ms tick — the
// tutorial appeared to start on "2 / 4" and raced itself off the screen.
const MIN_STEP_MS = 2000;
const HOLD_MS = 600;

const CAMERA_STEPS = [
  {
    headline: 'Hold your hands up',
    body: 'Lift both hands in front of your camera so Froola can see them.',
  },
  {
    headline: 'Touch the left circle',
    body: 'Move your left hand onto the big circle on the left. You should hear a chord.',
  },
  {
    headline: 'Slide around to change the chord',
    body: 'Keep your hand on the circle and move it around. The music changes as you go.',
  },
  {
    headline: 'Try the right circle',
    body: 'Put your right hand on the right circle to change the flavor of the chord.',
  },
] as const;

interface Props {
  signalRef: RefObject<GestureSignal[]>;
  selectedRef: RefObject<DialSelection>;
  /** Fired once when the tutorial leaves the screen (finished or skipped). */
  onDone?: () => void;
}

/** Play a short two-note ascending ding using the Web Audio API. */
function playSuccessSound() {
  try {
    const ac = new AudioContext();
    const now = ac.currentTime;
    // C5 then G5 — a pleasant perfect-fifth "done" sound
    const notes: [number, number, number][] = [
      [523, 0,    0.28],
      [784, 0.14, 0.55],
    ];
    notes.forEach(([freq, start, stop]) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.3, now + start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + stop);
      osc.start(now + start);
      osc.stop(now + stop);
    });
    // Close context after last note finishes
    setTimeout(() => { try { ac.close(); } catch { /* ignore */ } }, 700);
  } catch { /* ignore — audio unavailable */ }
}

export default function BeginnerTutorial({ signalRef, selectedRef, onDone }: Props) {
  const STEPS = CAMERA_STEPS;
  const [step, setStep] = useState(0);
  const [doneMessage, setDoneMessage] = useState(false);
  const [gone, setGone] = useState(false);
  const [flashComplete, setFlashComplete] = useState(false);
  const visitedRef = useRef(new Set<number>());
  // Prevents the interval from firing the advance logic more than once
  // while the checkmark flash is playing.
  const advancingRef = useRef(false);
  // The finish timeout fires up to ~2.3s after the last step completes — a
  // ref keeps it calling whatever onDone is current then, not whichever one
  // was in scope when the interval closure was created.
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    if (doneMessage || gone || step >= STEPS.length) return;

    const shownAt = Date.now();
    let heldSince: number | null = null;

    const id = setInterval(() => {
      if (advancingRef.current) return;

      const signals = signalRef.current;
      const { outerR, innerR, leftCx, rightCx, leftCy, rightCy } = wheelGeometry(
        window.innerWidth,
        window.innerHeight,
      );

      const inRing = (x: number, y: number, cx: number, cy: number) => {
        const d = Math.hypot(x * window.innerWidth - cx, y * window.innerHeight - cy);
        return d >= innerR && d <= outerR;
      };

      const left = signals.find(s => s.handId === 'left');
      const right = signals.find(s => s.handId === 'right');

      let met = false;
      if (step === 0) {
        met = signals.some(s => s.present);
      } else if (step === 1) {
        met = !!left?.present && inRing(left.x, left.y, leftCx, leftCy);
      } else if (step === 2) {
        if (left?.present && inRing(left.x, left.y, leftCx, leftCy)) {
          visitedRef.current.add(selectedRef.current.noteIdx);
        }
        met = visitedRef.current.size >= 3;
      } else if (step === 3) {
        met = !!right?.present && inRing(right.x, right.y, rightCx, rightCy);
      }

      const now = Date.now();
      if (!met) heldSince = null;
      else if (heldSince === null) heldSince = now;

      const advance = met &&
        now - shownAt >= MIN_STEP_MS &&
        heldSince !== null && now - heldSince >= HOLD_MS;

      if (advance) {
        advancingRef.current = true;
        playSuccessSound();
        setFlashComplete(true);

        setTimeout(() => {
          setFlashComplete(false);
          const next = step + 1;
          if (next >= STEPS.length) {
            localStorage.setItem(TUTORIAL_KEY, 'true');
            setDoneMessage(true);
            setTimeout(() => { setGone(true); onDoneRef.current?.(); }, 1500);
          } else {
            setStep(next);
          }
          advancingRef.current = false;
        }, 800);
      }
    }, 100);

    return () => clearInterval(id);
  }, [step, doneMessage, gone, signalRef, selectedRef, STEPS.length]);

  function skip() {
    localStorage.setItem(TUTORIAL_KEY, 'true');
    flushSync(() => setGone(true));
    onDone?.();
  }

  if (gone) return null;

  if (doneMessage) {
    return (
      <div className="tutorial-overlay">
        <div className="tutorial-card">
          <FroolaMascot size={56} mood="happy" />
          <h2 className="tutorial-headline">You're ready. Have fun!</h2>
        </div>
      </div>
    );
  }

  if (flashComplete) {
    return (
      <div className="tutorial-overlay">
        <div className="tutorial-card tutorial-card--complete">
          <FroolaMascot size={56} mood="happy" />
          <span className="tutorial-checkmark">✓</span>
        </div>
        {/* Keep the skip target rendered so it can't dodge a click that
            lands mid-flash. */}
        <button className="tutorial-skip" onClick={skip}>Skip tutorial</button>
      </div>
    );
  }

  const current = STEPS[step];
  return (
    <div className="tutorial-overlay">
      <div className="tutorial-card">
        <FroolaMascot size={56} />
        <p className="tutorial-step-count">{step + 1} / {STEPS.length}</p>
        <h2 className="tutorial-headline">{current.headline}</h2>
        <p className="tutorial-body">{current.body}</p>
        <div className="tutorial-dots">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`tutorial-dot${i === step ? ' tutorial-dot--active' : ''}`}
            />
          ))}
        </div>
      </div>
      <button className="tutorial-skip" onClick={skip}>Skip tutorial</button>
    </div>
  );
}
