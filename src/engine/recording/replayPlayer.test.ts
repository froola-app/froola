import { describe, it, expect } from 'vitest';
import type { Recording } from '../types';
import { NOTES, QUALITIES } from '../types';
import { wheelGeometry } from '../renderer/geometry';
import { sampleEndTimes, sampleIndexAt, signalsAt } from './replayPlayer';

const W = 1280;
const H = 720;

const recording: Recording = {
  samples: [
    { dt: 100, noteIdx: 0, qualityIdx: 0, vibe: 0 },
    { dt: 100, noteIdx: 3, qualityIdx: 2, vibe: 0 },
    { dt: 100, noteIdx: 6, qualityIdx: 6, vibe: 0 },
  ],
  totalMs: 300,
};

// Mirror the renderer's angle hit-test so we can assert the synthesised hand
// lands on the slice it was recorded from (the round-trip the coordinator sees).
function sliceAt(x: number, y: number, cx: number, cy: number, n: number): number {
  const angle = Math.atan2(y * H - cy, x * W - cx);
  const normalized = ((angle + Math.PI / 2) + Math.PI * 2) % (Math.PI * 2);
  return Math.round((normalized / (Math.PI * 2)) * n) % n;
}

describe('replayPlayer', () => {
  it('sampleEndTimes accumulates dt', () => {
    expect(sampleEndTimes(recording)).toEqual([100, 200, 300]);
  });

  it('sampleIndexAt maps time to the active sample', () => {
    const ends = sampleEndTimes(recording);
    expect(sampleIndexAt(ends, 0)).toBe(0);
    expect(sampleIndexAt(ends, 50)).toBe(0);
    expect(sampleIndexAt(ends, 100)).toBe(0);
    expect(sampleIndexAt(ends, 150)).toBe(1);
    expect(sampleIndexAt(ends, 250)).toBe(2);
    expect(sampleIndexAt(ends, 999)).toBe(2); // clamps to last
  });

  it('emits two present hands, left=note right=quality', () => {
    const ends = sampleEndTimes(recording);
    const signals = signalsAt(recording, ends, 150, W, H);
    expect(signals).toHaveLength(2);
    expect(signals.map(s => s.handId)).toEqual(['left', 'right']);
    expect(signals.every(s => s.present)).toBe(true);
  });

  it('synthesised hands hit-test back to the recorded slice indices', () => {
    const ends = sampleEndTimes(recording);
    const { leftCx, rightCx, cy } = wheelGeometry(W, H);
    for (const ms of [50, 150, 250]) {
      const idx = sampleIndexAt(ends, ms);
      const sample = recording.samples[idx];
      const [left, right] = signalsAt(recording, ends, ms, W, H);
      expect(sliceAt(left.x, left.y, leftCx, cy, NOTES.length)).toBe(sample.noteIdx);
      expect(sliceAt(right.x, right.y, rightCx, cy, QUALITIES.length)).toBe(sample.qualityIdx);
    }
  });

  it('returns no signals for an empty recording', () => {
    const empty: Recording = { samples: [], totalMs: 0 };
    expect(signalsAt(empty, [], 0, W, H)).toEqual([]);
  });
});
