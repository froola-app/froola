// src/coordinator.ts
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { GestureSignal, MusicalCommand } from './engine/types';
import { useGestureInput } from './engine/input';
import { useRenderer } from './engine/renderer';

// --- Track A stubs — delete when Track A delivers useAudio and mapGesture ---
const mapGesture = (_s: GestureSignal, _vibe: string): MusicalCommand => ({  // eslint-disable-line @typescript-eslint/no-unused-vars
  chord: 'C',
  voicing: [60, 64, 67],
  register: 0.5,
  texture: 0.5,
  tension: 0.2,
});
const useAudio = () => ({
  play: (_cmd: MusicalCommand) => {},  // eslint-disable-line @typescript-eslint/no-unused-vars
  getAnalyser: (): AnalyserNode | null => null,
});
// --- end stubs ---

export function useCoordinator(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const signalsRef = useRef<GestureSignal[]>([]);

  const { signalRef: inputSignalRef, mode, requestCamera, useMouse } = useGestureInput();
  const { play, getAnalyser } = useAudio();
  const analyserRef = useRef<AnalyserNode | null>(getAnalyser());

  // Hot path: rAF loop — reads signal ref, maps, plays
  useEffect(() => {
    let rafId: number;

    function tick() {
      const signal = inputSignalRef.current;
      signalsRef.current = signal.present ? [signal] : [];

      if (signal.present) {
        const cmd = mapGesture(signal, 'default');
        play(cmd);
      }

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [inputSignalRef]);

  useRenderer(canvasRef as RefObject<HTMLCanvasElement>, signalsRef, analyserRef);

  return { mode, requestCamera, useMouse };
}
