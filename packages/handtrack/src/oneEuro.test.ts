import { describe, it, expect } from 'vitest';
import { OneEuroFilter, OneEuroPoint, alphaFor } from './oneEuro';

describe('alphaFor', () => {
  it('opens toward 1 as the cutoff rises', () => {
    const dt = 1 / 30;
    expect(alphaFor(0.5, dt)).toBeLessThan(alphaFor(5, dt));
    expect(alphaFor(1000, dt)).toBeGreaterThan(0.99);
  });

  it('is rate independent: the same cutoff means the same cutoff', () => {
    // This is the property a fixed alpha lacks, and the reason Safari's slower
    // inference used to feel like different smoothing rather than fewer frames.
    const slow = alphaFor(2, 1 / 15);
    const fast = alphaFor(2, 1 / 60);
    expect(slow).toBeGreaterThan(fast); // bigger steps must blend harder
    // Four 60 Hz steps should land near one 15 Hz step from the same start.
    let a = 0;
    for (let i = 0; i < 4; i++) a += (1 - a) * fast;
    expect(a).toBeCloseTo(slow, 1);
  });
});

describe('OneEuroFilter', () => {
  it('starts at the first sample rather than sliding in from zero', () => {
    const f = new OneEuroFilter();
    expect(f.filter(0.8, 1 / 30)).toBeCloseTo(0.8);
  });

  it('converges to a held value', () => {
    const f = new OneEuroFilter();
    f.filter(0, 1 / 30);
    let v = 0;
    for (let i = 0; i < 200; i++) v = f.filter(1, 1 / 30);
    expect(v).toBeCloseTo(1, 3);
  });

  it('reports the velocity it measured', () => {
    const f = new OneEuroFilter();
    f.filter(0, 1 / 30);
    for (let i = 1; i <= 60; i++) f.filter(i * 0.01, 1 / 30);
    // 0.01 per 1/30 s is 0.3 units/sec.
    expect(f.velocity).toBeGreaterThan(0.2);
    expect(f.velocity).toBeLessThan(0.4);
  });

  it('survives a zero or garbage timestep without going NaN', () => {
    const f = new OneEuroFilter();
    f.filter(0.5, 1 / 30);
    expect(Number.isFinite(f.filter(0.6, 0))).toBe(true);
    expect(Number.isFinite(f.filter(0.6, NaN))).toBe(true);
    expect(Number.isFinite(f.filter(0.6, -1))).toBe(true);
  });

  it('seeds to a position with no velocity', () => {
    const f = new OneEuroFilter();
    for (let i = 0; i < 20; i++) f.filter(i * 0.05, 1 / 30);
    f.seedAt(0.1);
    expect(f.velocity).toBe(0);
    expect(f.filter(0.1, 1 / 30)).toBeCloseTo(0.1, 2);
  });
});

describe('OneEuroPoint', () => {
  it('filters both axes independently', () => {
    const p = new OneEuroPoint();
    p.seedAt(0.5, 0.5);
    const out = p.filter(0.9, 0.5, 1 / 30);
    expect(out.x).toBeGreaterThan(0.5);
    expect(out.y).toBeCloseTo(0.5, 3);
  });
});
