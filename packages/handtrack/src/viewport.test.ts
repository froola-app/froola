import { describe, it, expect } from 'vitest';
import { coverTransform } from './viewport';

describe('coverTransform', () => {
  it('mirrors by default, since a selfie feed is displayed mirrored', () => {
    const t = coverTransform(100, 100, 100, 100);
    expect(t.map({ x: 0.2, y: 0.5 }).x).toBeCloseTo(0.8);
  });

  it('leaves the center fixed no matter the crop', () => {
    // The center is the one point cover-cropping never moves, on any aspect.
    for (const [fw, fh, tw, th] of [[16, 9, 9, 16], [4, 3, 16, 9], [1, 1, 3, 1]]) {
      const c = coverTransform(fw, fh, tw, th).map({ x: 0.5, y: 0.5 });
      expect(c.x).toBeCloseTo(0.5);
      expect(c.y).toBeCloseTo(0.5);
    }
  });

  it('crops the over-long axis rather than squashing it', () => {
    // A 16:9 frame shown in a 9:16 portrait viewport is scaled to fill the
    // height, so most of its width falls outside and the visible x range
    // narrows: frame-space 0 and 1 land well outside 0..1.
    const t = coverTransform(1920, 1080, 1080, 1920, false);
    expect(t.map({ x: 0, y: 0.5 }).x).toBeLessThan(0);
    expect(t.map({ x: 1, y: 0.5 }).x).toBeGreaterThan(1);
    // The vertical axis fits exactly.
    expect(t.map({ x: 0.5, y: 0 }).y).toBeCloseTo(0);
    expect(t.map({ x: 0.5, y: 1 }).y).toBeCloseTo(1);
  });

  it('falls back to identity before video metadata has loaded', () => {
    // videoWidth/Height are 0 for the first frames; producing NaN coordinates
    // there would poison the filters permanently.
    const t = coverTransform(0, 0, 800, 600);
    const p = t.map({ x: 0.3, y: 0.4 });
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });
});
