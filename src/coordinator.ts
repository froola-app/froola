// src/coordinator.ts
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { GestureSignal } from './engine/types';
import { useGestureInput } from './engine/input';
import { useRenderer } from './engine/renderer';
import { createMapper } from './engine/music';
import { AudioEngine } from './engine/audio';

export function useCoordinator(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const engineRef = useRef<AudioEngine | null>(null);
  const mapperRef = useRef(createMapper('warm'));
  const analyserRef = useRef<AnalyserNode | null>(null);

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

  // Hot path: rAF loop — reads signals, maps left hand to audio
  useEffect(() => {
    let rafId: number;

    function tick() {
      const signals = signalRef.current;
      const left = signals.find(s => s.handId === 'left');

      if (left?.present && engineRef.current) {
        const cmd = mapperRef.current(left);
        if (cmd) engineRef.current.play(cmd);
      }

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [signalRef]);

  useRenderer(canvasRef as RefObject<HTMLCanvasElement>, signalRef as RefObject<GestureSignal[]>, analyserRef);

  return { mode, requestCamera, useMouse };
}
