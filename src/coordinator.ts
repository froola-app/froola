// src/coordinator.ts
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { GestureSignal, MusicalCommand, NoteName, ChordQuality } from './engine/types';
import { useGestureInput } from './engine/input';
import { useRenderer } from './engine/renderer';

const NOTES: NoteName[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const QUALITIES: ChordQuality[] = ['major', 'minor', 'maj7', 'min7', 'dom7', 'aug', 'dim'];

function pickFromList<T>(x: number, list: T[]): T {
  const i = Math.min(Math.floor(x * list.length), list.length - 1);
  return list[i];
}

// --- Track A stubs — delete when Track A delivers useAudio and mapGesture ---
const mapGesture = (signals: GestureSignal[], _vibe: string): MusicalCommand => {  // eslint-disable-line @typescript-eslint/no-unused-vars
  const left  = signals.find(s => s.handId === 'left');
  const right = signals.find(s => s.handId === 'right');

  const rootNote     = left  ? pickFromList(left.x,  NOTES)    : 'C' as NoteName;
  const chordQuality = right ? pickFromList(right.x, QUALITIES) : 'major' as ChordQuality;

  return {
    chord: `${rootNote}${chordQuality}`,
    voicing: [60, 64, 67],
    register: right ? right.y : 0.5,
    texture: left  ? left.y  : 0.5,
    tension: 0.2,
    rootNote,
    chordQuality,
  };
};
const useAudio = () => ({
  play: (_cmd: MusicalCommand) => {},  // eslint-disable-line @typescript-eslint/no-unused-vars
  getAnalyser: (): AnalyserNode | null => null,
});
// --- end stubs ---

export function useCoordinator(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const { signalRef: inputSignalRef, mode, requestCamera, useMouse } = useGestureInput();
  const { play, getAnalyser } = useAudio();
  const analyserRef = useRef<AnalyserNode | null>(getAnalyser());

  // Fire audio on any hand present
  useEffect(() => {
    const signals = inputSignalRef.current;
    if (!signals.some(s => s.present)) return;
    const cmd = mapGesture(signals, 'default');
    play(cmd);
  });

  useRenderer(canvasRef as RefObject<HTMLCanvasElement>, inputSignalRef, analyserRef);

  return { mode, requestCamera, useMouse };
}
