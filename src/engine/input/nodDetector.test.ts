import { describe, it, expect } from 'vitest';
import { pitchFromMatrix } from './nodDetector';

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
