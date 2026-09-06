// The numbers quoted on the engineering page.
//
// They are measurements, not marketing, and they come from `npm run bench`,
// which replays seeded synthetic traces through the real tracker and writes
// `packages/handtrack/BENCHMARK.md`. `benchmarks.test.ts` parses that file and
// fails if anything here has drifted from it, so the page cannot quietly go
// stale after a change to the filters.
//
// The label on each row is the exact line prefix in BENCHMARK.md, which is what
// the test matches on. Keep them in sync or the test will say so.

export type Metric = {
  /** Line prefix in BENCHMARK.md. */
  key: string;
  before: number;
  after: number;
  unit: string;
  /** Lower is better for every metric here; kept explicit rather than assumed. */
  lowerIsBetter: true;
};

export const JITTER: Metric = {
  key: 'jitter',
  before: 2.86,
  after: 2.35,
  unit: '',
  lowerIsBetter: true,
};

export const LAG: Metric = {
  key: 'lag',
  before: 59.6,
  after: 21.1,
  unit: 'ms',
  lowerIsBetter: true,
};

export const SETTLING: Metric = {
  key: 'step settling',
  before: 300,
  after: 33,
  unit: 'ms',
  lowerIsBetter: true,
};

export const FIST_FLIPS: Metric = {
  key: 'fist flips',
  before: 108,
  after: 1,
  unit: '',
  lowerIsBetter: true,
};

export const SEAM_FLIPS: Metric = {
  key: 'seam flips',
  before: 106,
  after: 0,
  unit: '',
  lowerIsBetter: true,
};

/** Raw input jitter, the number a filter that did nothing would score. */
export const RAW_JITTER = 5.73;
/** The fixed cutoff the previous exponential average was equivalent to. */
export const LEGACY_CUTOFF_HZ = 2.07;

/** Percent reduction, rounded — computed so it can never disagree with the pair. */
export function improvement(m: Metric): number {
  if (m.before === 0) return 0;
  return Math.round(((m.before - m.after) / m.before) * 100);
}

/** "9x faster" reads better than "89% less" for the big ones. */
export function timesFaster(m: Metric): number {
  if (m.after === 0) return Infinity;
  return Math.round((m.before / m.after) * 10) / 10;
}
