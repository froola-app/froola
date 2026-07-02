import type { LessonStep } from './types';
import type { RecordingSample, Recording } from '../types';

// Helpers to build target recordings from compact descriptions.
// noteIdx: wheel degree 0-6 (left wheel), qualIdx: extension 0-6 (right wheel).
// Shared by curriculum.ts (technique drills) and songs.ts (song lessons).

export function hold(noteIdx: number, qualIdx: number, durationMs: number): RecordingSample[] {
  const count = Math.round(durationMs / 100);
  return Array.from({ length: count }, () => ({ dt: 100, noteIdx, qualityIdx: qualIdx, vibe: 0 }));
}

export function seq(...chunks: RecordingSample[][]): Recording {
  const samples = chunks.flat();
  return { samples, totalMs: samples.reduce((s, r) => s + r.dt, 0) };
}

export function step(
  id: string,
  instruction: string,
  recording: Recording,
  opts: { hint?: string; minScore?: number } = {},
): LessonStep {
  return {
    id,
    instruction,
    hint: opts.hint,
    targetRecording: recording,
    minScore: opts.minScore ?? 60,
    durationMs: recording.totalMs,
  };
}

/** Milliseconds for `n` beats at `bpm`. Song lessons use bpm values whose beat
 *  length is a multiple of 100ms (60, 75, 100, 120, 150) so chord boundaries
 *  stay on the recording's 100ms sample grid. */
export function beats(n: number, bpm: number): number {
  return Math.round((n * 60000) / bpm);
}

/** Hold a chord for `n` beats at `bpm`. */
export function chord(noteIdx: number, qualIdx: number, n: number, bpm: number): RecordingSample[] {
  return hold(noteIdx, qualIdx, beats(n, bpm));
}
