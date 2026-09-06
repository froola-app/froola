import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { RefObject } from 'react';
import type { GestureSignal } from '../engine/types';
import { wheelGeometry } from '../engine/renderer/geometry';
import FroolaMascot from './brand/FroolaMascot';

const TUTORIAL_KEY = 'froola.tutorialSeen';

// One prompt, one success: the card dissolves when the first chord sounds
// (left hand held on the left wheel — the same condition that makes sound).
// HOLD_MS only debounces single-frame detection noise; there is no minimum
// display time — reaching the aha IS completing the tutorial.
const HOLD_MS = 300;
// How long the success checkmark flashes before the card dissolves.
const FLASH_MS = 800;

interface Props {
  signalRef: RefObject<GestureSignal[]>;
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

export default function BeginnerTutorial({ signalRef, onDone }: Props) {
  const [gone, setGone] = useState(false);
  const [flashComplete, setFlashComplete] = useState(false);
  // Prevents the interval from firing the advance logic more than once
  // while the checkmark flash is playing.
  const advancingRef = useRef(false);
  // The finish timeout fires up to FLASH_MS after success — a ref keeps it
  // calling whatever onDone is current then, not whichever one was in scope
  // when the interval closure was created.
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    if (gone) return;

    let heldSince: number | null = null;

    const id = setInterval(() => {
      if (advancingRef.current) return;

      const { outerR, innerR, leftCx, leftCy } = wheelGeometry(
        window.innerWidth,
        window.innerHeight,
      );

      const left = signalRef.current.find(s => s.handId === 'left');
      const met = !!left?.present && (() => {
        const d = Math.hypot(left.x * window.innerWidth - leftCx, left.y * window.innerHeight - leftCy);
        return d >= innerR && d <= outerR;
      })();

      if (!met) { heldSince = null; return; }
      const now = Date.now();
      if (heldSince === null) heldSince = now;
      if (now - heldSince >= HOLD_MS) {
        advancingRef.current = true;
        playSuccessSound();
        localStorage.setItem(TUTORIAL_KEY, 'true');
        setFlashComplete(true);
        setTimeout(() => { setGone(true); onDoneRef.current?.(); }, FLASH_MS);
      }
    }, 100);

    return () => clearInterval(id);
  }, [gone, signalRef]);

  function skip() {
    localStorage.setItem(TUTORIAL_KEY, 'true');
    flushSync(() => setGone(true));
    onDone?.();
  }

  if (gone) return null;

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

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-card">
        <FroolaMascot size={56} />
        <h2 className="tutorial-headline">Hold your hands up</h2>
        <p className="tutorial-body">Lift both hands in front of your camera so Froola can see them.</p>
      </div>
      <button className="tutorial-skip" onClick={skip}>Skip tutorial</button>
    </div>
  );
}
