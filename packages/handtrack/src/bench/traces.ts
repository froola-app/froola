// Synthetic input for the tracker, so its behaviour can be measured in CI.
//
// The point of generating traces rather than recording a real hand: a real
// recording pins the numbers to one person, one camera and one lighting setup,
// and it cannot isolate anything. A synthetic still-hand trace with a known
// noise amplitude answers "how much of this noise survives the filter" exactly,
// and a synthetic sine with a known frequency answers "how far behind does the
// output run" exactly. Both questions are unanswerable from a recording, and
// both are the questions that actually decide whether the filter is good.
//
// Everything here is seeded, so a failing benchmark reproduces byte for byte.

import type { Landmark, Point } from '../types';

/** Small, fast, seeded PRNG. Deterministic across platforms. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal via Box-Muller, drawing from a seeded uniform. */
export function gaussian(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export type Sample = { t: number; x: number; y: number };

export type TraceOptions = {
  /** Duration in ms. */
  ms?: number;
  /** Sample rate in Hz. 30 matches the pipeline's inference cadence. */
  hz?: number;
  /**
   * Std deviation of per-sample noise, in target-space units. 0.004 is
   * representative of landmark jitter on a hand held still at desk distance:
   * invisible per frame, very visible as a shimmering cursor.
   */
  noise?: number;
  seed?: number;
};

const defaults = { ms: 2000, hz: 30, noise: 0.004, seed: 1 };

/** A hand held perfectly still. Everything the filter emits here is error. */
export function stillTrace(at: Point = { x: 0.5, y: 0.5 }, o: TraceOptions = {}): Sample[] {
  const { ms, hz, noise, seed } = { ...defaults, ...o };
  const rng = mulberry32(seed);
  const step = 1000 / hz;
  const out: Sample[] = [];
  for (let t = 0; t <= ms; t += step) {
    out.push({ t, x: at.x + gaussian(rng) * noise, y: at.y + gaussian(rng) * noise });
  }
  return out;
}

/**
 * A hand sweeping back and forth. 0.5 Hz over a third of the viewport is an
 * unhurried, musical motion — the kind of movement the instrument is actually
 * played with, not a worst case.
 */
export function sineTrace(
  o: TraceOptions & { freqHz?: number; amplitude?: number; center?: Point } = {}
): Sample[] {
  const { ms, hz, noise, seed } = { ...defaults, ...o };
  const freqHz = o.freqHz ?? 0.5;
  const amplitude = o.amplitude ?? 0.17;
  const center = o.center ?? { x: 0.5, y: 0.5 };
  const rng = mulberry32(seed);
  const step = 1000 / hz;
  const out: Sample[] = [];
  for (let t = 0; t <= ms; t += step) {
    const phase = 2 * Math.PI * freqHz * (t / 1000);
    out.push({
      t,
      x: center.x + Math.sin(phase) * amplitude + gaussian(rng) * noise,
      y: center.y + gaussian(rng) * noise,
    });
  }
  return out;
}

/** Ground truth for a sine trace, with the noise removed. */
export function sineTruth(
  o: TraceOptions & { freqHz?: number; amplitude?: number; center?: Point } = {}
): Sample[] {
  return sineTrace({ ...o, noise: 0 });
}

/** A hand that jumps and holds. Measures how fast the filter catches up. */
export function stepTrace(
  from: Point,
  to: Point,
  o: TraceOptions & { atMs?: number } = {}
): Sample[] {
  const { ms, hz, noise, seed } = { ...defaults, ...o };
  const atMs = o.atMs ?? 500;
  const rng = mulberry32(seed);
  const step = 1000 / hz;
  const out: Sample[] = [];
  for (let t = 0; t <= ms; t += step) {
    const p = t < atMs ? from : to;
    out.push({ t, x: p.x + gaussian(rng) * noise, y: p.y + gaussian(rng) * noise });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Synthetic landmarks, for driving the whole tracker rather than one filter.
// ---------------------------------------------------------------------------

const TIPS = [8, 12, 16, 20];
const MCPS = [5, 9, 13, 17];
/** Where each finger's knuckle sits relative to the palm center, in x. */
const MCP_X_OFFSET = [-0.03, -0.01, 0.01, 0.03];

/**
 * A plausible 21-landmark hand centered on `center`, curled by `curl` (0 open,
 * 1 fisted).
 *
 * The geometry is built backwards from what `curlScore` measures: each
 * fingertip is placed along its own knuckle ray at a tip/knuckle distance ratio
 * that interpolates from 2.0 (extended) to 0.8 (folded). That makes the input
 * curl and the scored curl monotonically related, so a test can say "hold this
 * hand at 0.8 curl" and mean something specific.
 *
 * Palm center is exact by construction: the wrist offset below cancels the four
 * knuckle offsets above, so `palmCenter()` of this hand returns `center`.
 */
export function makeHand(center: Point, curl = 0, z = 0): Landmark[] {
  const lm: Landmark[] = Array.from({ length: 21 }, () => ({ x: center.x, y: center.y, z }));
  const wrist = { x: center.x, y: center.y + 0.06, z };
  lm[0] = wrist;

  const ratio = 2.0 - 1.2 * Math.max(0, Math.min(1, curl));

  for (let i = 0; i < 4; i++) {
    const mcp = { x: center.x + MCP_X_OFFSET[i], y: center.y - 0.015, z };
    lm[MCPS[i]] = mcp;
    const tip = {
      x: wrist.x + (mcp.x - wrist.x) * ratio,
      y: wrist.y + (mcp.y - wrist.y) * ratio,
      z,
    };
    lm[TIPS[i]] = tip;
    // Intermediate joints (PIP, DIP) sit evenly along the knuckle-to-tip ray.
    // Nothing measures them, but leaving them at the palm center would make a
    // debug render of this hand look wrong.
    lm[MCPS[i] + 1] = lerp(mcp, tip, 1 / 3, z);
    lm[MCPS[i] + 2] = lerp(mcp, tip, 2 / 3, z);
  }

  // Thumb (1-4), angled off the side of the palm. Excluded from curl scoring,
  // present for completeness.
  for (let k = 1; k <= 4; k++) {
    const f = k / 4;
    lm[k] = { x: wrist.x - 0.03 * f, y: wrist.y - 0.05 * f, z };
  }
  return lm;
}

function lerp(a: Point, b: Point, t: number, z: number): Landmark {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z };
}

/**
 * World landmarks for a hand squarely facing the camera: same layout, all z at
 * zero, so every out-of-plane angle is 0 and facing classifies as 'ok'.
 */
export function makeWorldHand(curl = 0): Landmark[] {
  return makeHand({ x: 0, y: 0 }, curl, 0);
}
