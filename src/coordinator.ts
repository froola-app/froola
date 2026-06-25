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
  const gestureRef = useRef<GestureSignal>({
    x: 0.5, y: 0.5, present: false, handId: 'primary',
  });
  const analyserRef = useRef<AnalyserNode | null>(null);

  const { signalRef: inputSignalRef, mode, requestCamera, useMouse } = useGestureInput();

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

  // Hot path: rAF loop — reads signal ref, maps, plays
  useEffect(() => {
    let rafId: number;

    function tick() {
      const signal = inputSignalRef.current;
      gestureRef.current = signal;

      if (signal.present && engineRef.current) {
        const cmd = mapperRef.current(signal);
        if (cmd) engineRef.current.play(cmd);
      }

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [inputSignalRef]);

  useRenderer(canvasRef as RefObject<HTMLCanvasElement>, gestureRef, analyserRef);

  return { mode, requestCamera, useMouse };
}
