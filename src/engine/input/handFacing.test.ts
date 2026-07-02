import { describe, it, expect } from 'vitest';
import { classifyHandFacing } from './handFacing';

// classifyHandFacing only reads landmarks 0 (wrist), 5 (index MCP),
// 9 (middle MCP), 17 (pinky MCP). Build a 21-point array with those set.
function makeLandmarks(overrides: Record<number, { x: number; y: number; z: number }>) {
  const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  // Default: a flat palm facing the camera, fingers up, ~0.2 wide.
  lm[0] = { x: 0.5, y: 0.7, z: 0 };   // wrist
  lm[5] = { x: 0.4, y: 0.5, z: 0 };   // index MCP
  lm[9] = { x: 0.5, y: 0.5, z: 0 };   // middle MCP
  lm[17] = { x: 0.6, y: 0.5, z: 0 };  // pinky MCP
  for (const [i, v] of Object.entries(overrides)) lm[Number(i)] = v;
  return lm;
}

describe('classifyHandFacing', () => {
  it('returns ok for a flat palm facing the camera', () => {
    expect(classifyHandFacing(makeLandmarks({}))).toBe('ok');
  });

  it('returns ok for a slightly tilted hand (grace zone)', () => {
    // knuckle line ~17° out of plane: z spread 0.06 over 0.2 xy span
    const lm = makeLandmarks({
      5: { x: 0.4, y: 0.5, z: -0.03 },
      17: { x: 0.6, y: 0.5, z: 0.03 },
    });
    expect(classifyHandFacing(lm)).toBe('ok');
  });

  it('returns turned when the hand is rotated sideways', () => {
    // knuckle line ~68° out of plane: z spread 0.5 over 0.2 xy span
    const lm = makeLandmarks({
      5: { x: 0.4, y: 0.5, z: -0.25 },
      17: { x: 0.6, y: 0.5, z: 0.25 },
    });
    expect(classifyHandFacing(lm)).toBe('turned');
  });

  it('returns pitched when the fingers point toward the camera', () => {
    // palm line ~68° out of plane: wrist→middle MCP mostly along z
    const lm = makeLandmarks({
      0: { x: 0.5, y: 0.7, z: 0 },
      9: { x: 0.5, y: 0.62, z: -0.2 },
    });
    expect(classifyHandFacing(lm)).toBe('pitched');
  });

  it('returns ok for degenerate (zero-length) segments', () => {
    const lm = makeLandmarks({
      0: { x: 0.5, y: 0.5, z: 0 },
      5: { x: 0.5, y: 0.5, z: 0 },
      9: { x: 0.5, y: 0.5, z: 0 },
      17: { x: 0.5, y: 0.5, z: 0 },
    });
    expect(classifyHandFacing(lm)).toBe('ok');
  });
});
