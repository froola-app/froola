import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { RefObject } from 'react';
import type { GestureSignal } from '../engine/types';
import type { DialSelection } from '../engine/renderer';
import type { InputMode } from '../engine/input';
import { wheelGeometry } from '../engine/renderer/geometry';

const TUTORIAL_KEY = 'froola.tutorialSeen';

const STEPS = [
  {
    headline: 'Hold your hands up',
    body: 'Lift both hands in front of your camera so Froola can see them.',
  },
  {
    headline: 'Touch the left circle',
    body: 'Move your left hand onto the big circle on the left — you should hear a chord.',
  },
  {
    headline: 'Slide around to change the chord',
    body: 'Keep your hand on the circle and move it around — the music changes as you go.',
  },
  {
    headline: 'Try the right circle',
    body: 'Put your right hand on the right circle to change the flavor of the chord.',
  },
] as const;

interface Props {
  signalRef: RefObject<GestureSignal[]>;
  selectedRef: RefObject<DialSelection>;
  mode: InputMode;
}

export default function BeginnerTutorial({ signalRef, selectedRef, mode }: Props) {
  const initialStep = mode === 'mouse' ? 1 : 0;
  const [step, setStep] = useState(initialStep);
  const [doneMessage, setDoneMessage] = useState(false);
  const [gone, setGone] = useState(false);
  const visitedRef = useRef(new Set<number>());

  useEffect(() => {
    if (doneMessage || gone || step >= STEPS.length) return;

    const id = setInterval(() => {
      const signals = signalRef.current;
      const { outerR, innerR, leftCx, rightCx, cy } = wheelGeometry(
        window.innerWidth,
        window.innerHeight,
      );

      const inRing = (x: number, y: number, cx: number) => {
        const d = Math.hypot(x * window.innerWidth - cx, y * window.innerHeight - cy);
        return d >= innerR && d <= outerR;
      };

      const left = signals.find(s => s.handId === 'left');
      const right = signals.find(s => s.handId === 'right');

      let advance = false;
      if (step === 0) {
        advance = signals.length > 0;
      } else if (step === 1) {
        advance = !!left?.present && inRing(left.x, left.y, leftCx);
      } else if (step === 2) {
        if (left?.present && inRing(left.x, left.y, leftCx)) {
          visitedRef.current.add(selectedRef.current.noteIdx);
        }
        advance = visitedRef.current.size >= 3;
      } else if (step === 3) {
        advance = !!right?.present && inRing(right.x, right.y, rightCx);
      }

      if (advance) {
        const next = step + 1;
        if (next >= STEPS.length) {
          localStorage.setItem(TUTORIAL_KEY, 'true');
          setDoneMessage(true);
          setTimeout(() => setGone(true), 1500);
        } else {
          setStep(next);
        }
      }
    }, 100);

    return () => clearInterval(id);
  }, [step, doneMessage, gone]);

  function skip() {
    localStorage.setItem(TUTORIAL_KEY, 'true');
    flushSync(() => setGone(true));
  }

  if (gone) return null;

  if (doneMessage) {
    return (
      <div className="tutorial-overlay">
        <div className="tutorial-card">
          <h2 className="tutorial-headline">You're ready — have fun!</h2>
        </div>
      </div>
    );
  }

  const current = STEPS[step];
  return (
    <div className="tutorial-overlay">
      <button className="tutorial-skip" onClick={skip}>Skip tutorial</button>
      <div className="tutorial-card">
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
    </div>
  );
}
