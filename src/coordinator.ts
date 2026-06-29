// src/coordinator.ts
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { GestureSignal, InstrumentMode } from './engine/types';
import { useGestureInput, type InputMode } from './engine/input';
import { useRenderer, type DialSelection } from './engine/renderer';
import { buildCommand } from './engine/music';
import { AudioEngine } from './engine/audio';

const REGISTER_THRESHOLD = 0.5 / 24;
// How long a chord keeps ringing after both hands briefly leave the wheels, so
// crossing the centre hub or a dropped tracking frame doesn't cut the note.
const SILENCE_GRACE_MS = 140;

export function useCoordinator(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  modeRef: RefObject<InstrumentMode>,
  initialMode: InputMode = 'asking'
) {
  const engineRef = useRef<AudioEngine | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const selectedRef = useRef<DialSelection>({ noteIdx: 0, qualIdx: 0 });

  const { signalRef, mode, requestCamera, useMouse } = useGestureInput(initialMode);

  // Create AudioEngine once; resume on first user pointer event
  useEffect(() => {
    const engine = new AudioEngine();
    engineRef.current = engine;
    analyserRef.current = engine.getAnalyser();

    const resume = () => engine.resume();
    window.addEventListener('pointerdown', resume, { once: true });

    return () => {
      engine.suspend();
      window.removeEventListener('pointerdown', resume);
    };
  }, []);

  // Hot path: rAF loop — reads dial selection + y-register, drives audio
  useEffect(() => {
    let rafId: number;
    let lastNoteIdx = -1;
    let lastQualIdx = -1;
    let lastY = -1;
    let sounding = false;
    let lastTouchMs = -Infinity;

    function tick() {
      const signals = signalRef.current;
      const left  = signals.find(s => s.handId === 'left');
      const right = signals.find(s => s.handId === 'right');

      // Replicate wheel geometry from renderer so we can do the hit-test here
      // without depending on the renderer's rAF writing to a shared ref first.
      const canvas = canvasRef.current;
      const w = canvas?.width  ?? window.innerWidth;
      const h = canvas?.height ?? window.innerHeight;
      const outerR  = Math.min(w, h) * 0.24;
      const innerR  = outerR * 0.36;
      const leftCx  = outerR * 1.5;
      const wheelCy = h * 0.65;

      const rightCx = w - outerR * 1.5;
      const inRing = (x: number, y: number, cx: number) => {
        const d = Math.hypot(x * w - cx, y * h - wheelCy);
        return d >= innerR && d <= outerR;
      };
      const leftInDial  = !!left?.present  && inRing(left.x,  left.y,  leftCx);
      const rightInDial = !!right?.present && inRing(right.x, right.y, rightCx);

      // Both hands on their wheels = chord plays (left=note, right=quality).
      const touching = leftInDial && rightInDial;
      const nowMs = performance.now();
      if (touching) lastTouchMs = nowMs;
      // A brief loss of contact (crossing the centre hub between slices, a dropped
      // tracking frame) holds the note instead of cutting it — avoids glitchy
      // silence/retrigger as you move around the wheels.
      const inGrace = !touching && (nowMs - lastTouchMs) < SILENCE_GRACE_MS;

      const { noteIdx, qualIdx } = selectedRef.current;
      const instrMode = modeRef.current;

      // Kick off sampler loading as soon as user selects piano or guitar
      if ((instrMode === 'piano' || instrMode === 'guitar') && engineRef.current) {
        engineRef.current.startLoadingSampler(instrMode);
      }

      if (touching && engineRef.current) {
        const y = left?.present ? left.y : (right?.y ?? lastY);
        const yChanged = instrMode === 'synth' && Math.abs(y - lastY) > REGISTER_THRESHOLD;
        const selChanged = noteIdx !== lastNoteIdx || qualIdx !== lastQualIdx;

        if (!sounding || selChanged || yChanged) {
          engineRef.current.play(buildCommand(noteIdx, qualIdx, y), instrMode);
          lastNoteIdx = noteIdx;
          lastQualIdx = qualIdx;
          lastY = y;
        }
        sounding = true;
      } else if (!inGrace && sounding && engineRef.current) {
        // Grace expired (or hand fully gone) — release the held note.
        engineRef.current.silence(instrMode);
        sounding = false;
      }

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [signalRef, modeRef]);

  useRenderer(
    canvasRef as RefObject<HTMLCanvasElement>,
    signalRef as RefObject<GestureSignal[]>,
    analyserRef,
    selectedRef
  );

  function preloadSampler(m: InstrumentMode) {
    if ((m === 'piano' || m === 'guitar') && engineRef.current) {
      engineRef.current.startLoadingSampler(m);
    }
  }

  return {
    mode,
    requestCamera,
    useMouse,
    signalRef,
    preloadSampler,
    vibe: 'warm' as string,
  };
}
