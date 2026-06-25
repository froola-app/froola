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
  const gestureRef = useRef<GestureSignal>({
    x: 0.5, y: 0.5, present: false, handId: 'primary',
  });

  const { signalRef: inputSignalRef, mode, requestCamera, useMouse } = useGestureInput();
  const { play, getAnalyser } = useAudio();
  const analyserRef = useRef<AnalyserNode | null>(getAnalyser());

  // Write latest signal into ref — no re-render
  useEffect(() => {
    gestureRef.current = inputSignalRef.current;
  });

  // Fire audio on presence
  useEffect(() => {
    const signal = inputSignalRef.current;
    if (!signal.present) return;
    const cmd = mapGesture(signal, 'default');
    play(cmd);
  });

  useRenderer(canvasRef as RefObject<HTMLCanvasElement>, gestureRef, analyserRef);

  return { mode, requestCamera, useMouse };
}
