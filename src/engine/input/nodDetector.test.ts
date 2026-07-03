import { describe, it, expect } from 'vitest';
import { pitchFromMatrix, createNodDetector, type NodEvent } from './nodDetector';

// Column-major 4x4 rotation about the x-axis by `deg` degrees.
// Rx = [[1,0,0],[0,c,-s],[0,s,c]]; column-major layout: data[col*4 + row].
function rx(deg: number): Float32Array {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return new Float32Array([
    1, 0,  0, 0, // col 0
    0, c,  s, 0, // col 1
    0, -s, c, 0, // col 2
    0, 0,  0, 1, // col 3
  ]);
}

describe('pitchFromMatrix', () => {
  it('returns 0 for the identity matrix', () => {
    expect(pitchFromMatrix(rx(0))).toBeCloseTo(0, 5);
  });

  it('returns +20 for a +20° rotation about x', () => {
    expect(pitchFromMatrix(rx(20))).toBeCloseTo(20, 5);
  });

  it('returns -20 for a -20° rotation about x', () => {
    expect(pitchFromMatrix(rx(-20))).toBeCloseTo(-20, 5);
  });
});

// Feed a pitch trace at 33ms steps (~30Hz); collect fired events.
function runTrace(
  det: ReturnType<typeof createNodDetector>,
  pitches: number[],
  startMs = 0,
): NodEvent[] {
  const events: NodEvent[] = [];
  pitches.forEach((p, i) => {
    const ev = det.sample(p, startMs + i * 33);
    if (ev) events.push(ev);
  });
  return events;
}

const IDLE10 = Array(10).fill(0); // seed + settle at baseline 0

describe('createNodDetector — core detection', () => {
  it('fires exactly one "down" for a fast (~300ms) downward nod', () => {
    const det = createNodDetector();
    // deflect past 12°, hold, return to baseline: ~9 samples ≈ 300ms
    const nod = [6, 13, 15, 15, 15, 13, 6, 0, 0];
    const events = runTrace(det, [...IDLE10, ...nod, ...Array(10).fill(0)]);
    expect(events).toEqual(['down']);
  });

  it('fires exactly one "up" for the mirrored upward nod', () => {
    const det = createNodDetector();
    const nod = [-6, -13, -15, -15, -15, -13, -6, 0, 0];
    const events = runTrace(det, [...IDLE10, ...nod, ...Array(10).fill(0)]);
    expect(events).toEqual(['up']);
  });

  it('fires for a slow deliberate nod (~800ms)', () => {
    const det = createNodDetector();
    const nod = [13, ...Array(20).fill(15), 6, 0]; // ~23 samples ≈ 760ms deflected
    const events = runTrace(det, [...IDLE10, ...nod, ...Array(5).fill(0)]);
    expect(events).toEqual(['down']);
  });

  it('ignores a sub-150ms twitch', () => {
    const det = createNodDetector();
    // deflected for a single 33ms sample, back at baseline immediately
    const events = runTrace(det, [...IDLE10, 15, 0, ...Array(10).fill(0)]);
    expect(events).toEqual([]);
  });
});
