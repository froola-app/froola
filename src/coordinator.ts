// src/coordinator.ts
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { GestureSignal } from './engine/types';
import { useGestureInput } from './engine/input';
import { useRenderer, type DialSelection } from './engine/renderer';
import { buildCommand } from './engine/music';
import { AudioEngine } from './engine/audio';

const REGISTER_THRESHOLD = 0.5 / 24;

export function useCoordinator(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const engineRef = useRef<AudioEngine | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const selectedRef = useRef<DialSelection>({ noteIdx: 0, qualIdx: 0 });

  const { signalRef, mode, requestCamera, useMouse } = useGestureInput();

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
    let wasTouching = false;

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

      const inRing = (x: number, y: number, cx: number) => {
        const d = Math.hypot(x * w - cx, y * h - wheelCy);
        return d >= innerR && d <= outerR;
      };
      const leftInDial = !!left?.present && inRing(left.x, left.y, leftCx);

      // Audio follows the left hand only: left orb on left wheel → sound on.
      // Right hand modifies chord quality but never sustains sound on its own.
      const touching = leftInDial;
      const justEntered = touching && !wasTouching;
      const justLeft    = !touching && wasTouching;
      wasTouching = touching;

      const { noteIdx, qualIdx } = selectedRef.current;

      if (justLeft && engineRef.current) {
        engineRef.current.silence();
      }

      if (touching && engineRef.current) {
        const y = left?.present ? left.y : (right?.y ?? lastY);
        const yChanged = Math.abs(y - lastY) > REGISTER_THRESHOLD;
        const selChanged = noteIdx !== lastNoteIdx || qualIdx !== lastQualIdx;

        if (justEntered || yChanged || selChanged) {
          engineRef.current.play(buildCommand(noteIdx, qualIdx, y));
          lastNoteIdx = noteIdx;
          lastQualIdx = qualIdx;
          lastY = y;
        }
      }

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [signalRef]);

  useRenderer(
    canvasRef as RefObject<HTMLCanvasElement>,
    signalRef as RefObject<GestureSignal[]>,
    analyserRef,
    selectedRef
  );

  return { mode, requestCamera, useMouse };
}
