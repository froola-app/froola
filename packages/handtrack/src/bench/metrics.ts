// Metrics for judging a filter. Each one answers a question a user would
// actually notice, rather than a question that is merely easy to compute.

import type { Sample } from './traces';

export type Series = { t: number; x: number; y: number }[];

/**
 * RMS distance from the series' own mean position.
 *
 * Run on a still-hand trace, this *is* the visible shimmer: the hand is not
 * moving, so every unit of spread is error the filter failed to remove.
 */
export function rmsJitter(s: Series): number {
  if (s.length === 0) return 0;
  const mx = s.reduce((a, p) => a + p.x, 0) / s.length;
  const my = s.reduce((a, p) => a + p.y, 0) / s.length;
  const sum = s.reduce((a, p) => a + (p.x - mx) ** 2 + (p.y - my) ** 2, 0);
  return Math.sqrt(sum / s.length);
}

/** RMS distance between two aligned series. */
export function rmsError(out: Series, truth: Series): number {
  const n = Math.min(out.length, truth.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += (out[i].x - truth[i].x) ** 2 + (out[i].y - truth[i].y) ** 2;
  }
  return Math.sqrt(sum / n);
}

/**
 * How far behind the truth the output runs, in ms.
 *
 * Found by sliding the output back over the truth and taking the shift with the
 * lowest error, then refining to sub-sample resolution by fitting a parabola to
 * the three points around the minimum. Sub-sample matters here: at 30 Hz one
 * sample is 33 ms, which is coarser than the differences being measured.
 *
 * `skip` drops the head of the series so the filter's initial convergence does
 * not count as lag.
 */
export function lagMs(out: Series, truth: Series, sampleMs: number, skip = 15): number {
  const maxShift = Math.min(30, Math.floor((Math.min(out.length, truth.length) - skip) / 2));
  if (maxShift < 2) return 0;

  const errAt = (shift: number): number => {
    let sum = 0;
    let n = 0;
    for (let i = skip + shift; i < Math.min(out.length, truth.length + shift); i++) {
      const tr = truth[i - shift];
      if (!tr) break;
      sum += (out[i].x - tr.x) ** 2 + (out[i].y - tr.y) ** 2;
      n++;
    }
    return n > 0 ? sum / n : Infinity;
  };

  let best = 0;
  let bestErr = Infinity;
  for (let s = 0; s <= maxShift; s++) {
    const e = errAt(s);
    if (e < bestErr) { bestErr = e; best = s; }
  }
  // Parabolic refinement around the discrete minimum.
  if (best > 0 && best < maxShift) {
    const y0 = errAt(best - 1);
    const y1 = bestErr;
    const y2 = errAt(best + 1);
    const denom = y0 - 2 * y1 + y2;
    if (Math.abs(denom) > 1e-12) {
      const delta = (0.5 * (y0 - y2)) / denom;
      if (Math.abs(delta) <= 1) return (best + delta) * sampleMs;
    }
  }
  return best * sampleMs;
}

/**
 * Time (ms) after a step for the output to reach and stay within `tolerance`
 * of the destination. Returns Infinity if it never settles.
 */
export function settlingMs(
  out: Series,
  target: { x: number; y: number },
  stepAtMs: number,
  tolerance = 0.01
): number {
  const within = (p: Series[number]) => Math.hypot(p.x - target.x, p.y - target.y) <= tolerance;
  for (let i = 0; i < out.length; i++) {
    if (out[i].t < stepAtMs) continue;
    if (!within(out[i])) continue;
    if (out.slice(i).every(within)) return out[i].t - stepAtMs;
  }
  return Infinity;
}

/** How many times a boolean series changes value. Chatter, counted. */
export function countFlips(states: boolean[]): number {
  let flips = 0;
  for (let i = 1; i < states.length; i++) if (states[i] !== states[i - 1]) flips++;
  return flips;
}

/** Convenience: run a per-sample position filter over a trace. */
export function runFilter(
  trace: Sample[],
  step: (s: Sample, dtSec: number) => { x: number; y: number }
): Series {
  const out: Series = [];
  let prevT: number | null = null;
  for (const s of trace) {
    const dt = prevT === null ? 1 / 30 : Math.max(s.t - prevT, 1) / 1000;
    prevT = s.t;
    const p = step(s, dt);
    out.push({ t: s.t, x: p.x, y: p.y });
  }
  return out;
}
