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
  const selectedRef = useRef<DialSelection>({ noteIdx: 0, qualIdx: 0, leftInDial: false, rightInDial: false });

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

      const { noteIdx, qualIdx, leftInDial, rightInDial } = selectedRef.current;
      const touching = leftInDial || rightInDial;
      const justEntered = touching && !wasTouching;
      wasTouching = touching;

      if (touching && engineRef.current) {
        // Use left hand y for register when available, fall back to right
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
