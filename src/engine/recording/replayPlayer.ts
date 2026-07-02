import type { GestureSignal, Recording } from '../types';
import { NOTES, QUALITIES } from '../types';
import { wheelGeometry, sliceToPoint } from '../renderer/geometry';

// Turns a decoded Recording back into a live stream of GestureSignals so the
// existing coordinator (audio) and renderer (visuals) can replay it with the
// exact same logic they use for live play. A recording only stores which note
// and quality slice was selected every ~100ms — not raw hand coordinates — so
// we synthesise two "hands" each parked at the centre of the recorded slice on
// its wheel. Both are reported present, which the coordinator reads as "both
// hands on their wheels" and sounds the chord.

/** Cumulative end-time (ms) of each sample, so we can binary-search by time. */
export function sampleEndTimes(recording: Recording): number[] {
  const ends: number[] = [];
  let acc = 0;
  for (const s of recording.samples) {
    acc += s.dt;
    ends.push(acc);
  }
  return ends;
}

/** Index of the sample active at `ms`, clamped to the recording's bounds. */
export function sampleIndexAt(ends: number[], ms: number): number {
  if (ends.length === 0) return -1;
  if (ms <= 0) return 0;
  const last = ends.length - 1;
  if (ms >= ends[last]) return last;
  // Each sample i covers (ends[i-1], ends[i]]; first sample also covers [0, ends[0]].
  let i = 0;
  while (i < last && ms > ends[i]) i++;
  return i;
}

/**
 * GestureSignals for the slice selected at `ms`, sized to the given canvas so
 * the synthesised hand positions land inside the wheels' rings. Returns an
 * empty array once playback has run past the end of the recording.
 */
export function signalsAt(
  recording: Recording,
  ends: number[],
  ms: number,
  w: number,
  h: number
): GestureSignal[] {
  const idx = sampleIndexAt(ends, ms);
  if (idx < 0) return [];
  const sample = recording.samples[idx];
  const { outerR, leftCx, rightCx, cy } = wheelGeometry(w, h);

  const left = sliceToPoint(sample.noteIdx, NOTES.length, leftCx, cy, outerR, w, h);
  const right = sliceToPoint(sample.qualityIdx, QUALITIES.length, rightCx, cy, outerR, w, h);

  return [
    { x: left.x, y: left.y, present: true, handId: 'left', sliceIdx: sample.noteIdx },
    { x: right.x, y: right.y, present: true, handId: 'right', sliceIdx: sample.qualityIdx },
  ];
}
