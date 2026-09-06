import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  JITTER, LAG, SETTLING, FIST_FLIPS, SEAM_FLIPS,
  RAW_JITTER, LEGACY_CUTOFF_HZ, improvement, timesFaster,
} from './benchmarks';

// The engineering page makes specific numeric claims. This is what stops them
// from drifting away from the benchmark that produced them: change the filters,
// re-run `npm run bench`, and this test tells you exactly which claims on the
// site are now wrong.
const BENCHMARK_PATH = path.join(process.cwd(), 'packages/handtrack/BENCHMARK.md');

function readBenchmark(): string[] {
  return fs.readFileSync(BENCHMARK_PATH, 'utf8').split('\n');
}

/** All numbers on the lines starting with `key`, in order. */
function valuesFor(lines: string[], key: string): number[] {
  const line = lines.find(l => l.trim().startsWith(key));
  if (!line) throw new Error(`No line starting with "${key}" in BENCHMARK.md`);
  return (line.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
}

describe('quoted benchmark numbers', () => {
  const lines = readBenchmark();

  it('has a benchmark file to check against', () => {
    expect(lines.length).toBeGreaterThan(5);
  });

  // Each metric is reported on two lines: the legacy one and the new one. The
  // report labels them "..., legacy EMA" / "..., one euro" and so on, so the
  // first number on each matching line is the value.
  const pairs: [string, typeof JITTER, string, string][] = [
    ['jitter', JITTER, 'jitter, legacy EMA', 'jitter, one euro'],
    ['lag', LAG, 'lag, legacy EMA', 'lag, one euro'],
    ['settling', SETTLING, 'step settling, legacy', 'step settling, one euro'],
    ['fist chatter', FIST_FLIPS, 'fist flips, bare cutoff', 'fist flips, gated'],
    ['seam chatter', SEAM_FLIPS, 'seam flips, stateless', 'seam flips, hysteretic'],
  ];

  for (const [name, metric, beforeKey, afterKey] of pairs) {
    it(`${name} matches the measured before and after`, () => {
      expect(valuesFor(lines, beforeKey)[0]).toBe(metric.before);
      expect(valuesFor(lines, afterKey)[0]).toBe(metric.after);
    });
  }

  it('matches the raw input jitter and the legacy cutoff', () => {
    expect(valuesFor(lines, 'jitter, raw input')[0]).toBe(RAW_JITTER);
    expect(valuesFor(lines, 'legacy EMA cutoff')[0]).toBe(LEGACY_CUTOFF_HZ);
  });

  it('only claims improvements that the measurements support', () => {
    for (const [, metric] of pairs) {
      expect(metric.after).toBeLessThan(metric.before);
    }
  });
});

describe('derived figures', () => {
  it('computes percent reduction from the pair, not by hand', () => {
    expect(improvement(LAG)).toBe(65);
    expect(improvement({ ...LAG, before: 100, after: 50 })).toBe(50);
  });

  it('computes the multiple for the large wins', () => {
    expect(timesFaster(SETTLING)).toBeCloseTo(9.1, 1);
  });
});
