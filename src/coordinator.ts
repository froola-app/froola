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

    function tick() {
      const signals = signalRef.current;
      const left = signals.find(s => s.handId === 'left');

      if (left?.present && engineRef.current) {
        const { noteIdx, qualIdx } = selectedRef.current;
        const yChanged = Math.abs(left.y - lastY) > REGISTER_THRESHOLD;
        const selChanged = noteIdx !== lastNoteIdx || qualIdx !== lastQualIdx;

        if (yChanged || selChanged) {
          engineRef.current.play(buildCommand(noteIdx, qualIdx, left.y));
          lastNoteIdx = noteIdx;
          lastQualIdx = qualIdx;
          lastY = left.y;
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
