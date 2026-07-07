import { describe, it, expect } from 'vitest';
import { palmCenter } from './palmCenter';

// 21 MediaPipe hand landmarks; only wrist (0) and MCPs (5, 9, 13, 17) matter.
function makeLandmarks(overrides: Record<number, { x: number; y: number }>) {
  const lm = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  for (const [i, p] of Object.entries(overrides)) {
    lm[Number(i)] = { ...p, z: 0 };
  }
  return lm;
}

describe('palmCenter', () => {
  it('averages the wrist and four MCP knuckles', () => {
    const lm = makeLandmarks({
      0: { x: 0.5, y: 0.9 },
      5: { x: 0.4, y: 0.5 },
      9: { x: 0.5, y: 0.5 },
      13: { x: 0.6, y: 0.5 },
      17: { x: 0.7, y: 0.5 },
    });
    const c = palmCenter(lm);
    expect(c.x).toBeCloseTo(0.54);
    expect(c.y).toBeCloseTo(0.58);
  });

  it('ignores fingertip positions — a stray index tip does not move the center', () => {
    const base = {
      0: { x: 0.5, y: 0.9 },
      5: { x: 0.4, y: 0.5 },
      9: { x: 0.5, y: 0.5 },
      13: { x: 0.6, y: 0.5 },
      17: { x: 0.7, y: 0.5 },
    };
    const centered = palmCenter(makeLandmarks(base));
    const strayTip = palmCenter(makeLandmarks({ ...base, 8: { x: 0.95, y: 0.1 } }));
    expect(strayTip).toEqual(centered);
  });
});
