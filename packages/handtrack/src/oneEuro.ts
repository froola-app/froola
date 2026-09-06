// The One Euro filter (Casiez, Roussel & Vogel, CHI 2012).
//
// Why this and not the exponential moving average it replaces: an EMA has a
// single time constant, so it is one frozen compromise. Smooth enough to kill
// jitter while a hand hovers, and it visibly lags when the hand sweeps; quick
// enough to keep up with a sweep, and the resting hand shivers. There is no
// setting that is good at both, because the two goals want opposite cutoffs.
//
// One Euro resolves that by making the cutoff a function of speed. It runs a
// low-pass over the signal's own derivative, then sets the position cutoff to
//
//     cutoff = minCutoff + beta * |filtered derivative|
//
// A still hand has ~0 derivative, so the cutoff collapses to `minCutoff` and
// the output is heavily smoothed. A moving hand raises its own cutoff, the
// filter opens up, and lag drops. One filter, both behaviours, and only two
// parameters that a human can reason about:
//
// - `minCutoff` (Hz) — lower means steadier when still. Raise it if the
//   resting position feels sluggish, lower it if it shivers.
// - `beta` — how eagerly the filter opens up with speed. Raise it if fast
//   motion lags, lower it if fast motion overshoots or feels twitchy.
//
// Everything here is time-corrected: alpha is derived from the actual dt of
// each sample, so the filter behaves identically whether inference is running
// at 60 Hz on a desktop GPU delegate or 15 Hz on a phone's CPU delegate. A
// fixed-alpha EMA does not have that property, which is exactly why the same
// smoothing constant felt different on Safari.

/**
 * Smoothing factor for a first-order low-pass with the given cutoff, at the
 * given timestep. Derived from the RC time constant tau = 1 / (2*pi*cutoff).
 *
 * This is the exponential form, `1 - exp(-dt/tau)`, rather than the rational
 * `1 / (1 + tau/dt)` the original paper writes. The two agree closely at small
 * timesteps, but only the exponential one is *exactly* rate independent: four
 * steps at 60 Hz compose to precisely one step at 15 Hz. That matters here
 * because inference rate is not a constant — it drops on a CPU delegate and
 * varies with load — and a filter whose effective smoothing drifts with frame
 * rate is the reason the same constants used to feel different on Safari.
 */
export function alphaFor(cutoffHz: number, dtSec: number): number {
  return 1 - Math.exp(-2 * Math.PI * cutoffHz * dtSec);
}

/** First-order low-pass holding only its last output. */
class LowPass {
  private y: number | null = null;

  filter(x: number, alpha: number): number {
    this.y = this.y === null ? x : alpha * x + (1 - alpha) * this.y;
    return this.y;
  }

  get initialized(): boolean {
    return this.y !== null;
  }

  reset(): void {
    this.y = null;
  }

  /** Force the internal state, used when a hand reappears after a gap. */
  seed(x: number): void {
    this.y = x;
  }
}

export type OneEuroOptions = {
  /** Cutoff in Hz as speed approaches zero. Lower is steadier at rest. */
  minCutoff?: number;
  /** Speed coefficient. Higher opens the filter faster as the hand moves. */
  beta?: number;
  /**
   * Cutoff in Hz for the derivative's own low-pass. 1 Hz is the value the
   * paper recommends and there is rarely a reason to move it: it exists to
   * stop noise in the derivative from spuriously opening the position filter.
   */
  derivativeCutoff?: number;
};

/**
 * Defaults tuned for normalized (0-1) viewport coordinates sampled at roughly
 * 30 Hz, which is what the hand pipeline feeds it. They were picked by sweeping
 * the two parameters against the traces in `bench/` and taking a point that
 * beat the previous filter on every metric at once — resting jitter, lag, and
 * tracking error while moving — rather than by feel.
 *
 * For reference, the fixed EMA these replaced used tau = 77 ms, i.e. a
 * constant ~2.07 Hz cutoff. One Euro sits below that at rest (steadier) and
 * rises well above it in motion (quicker) — that crossover is the whole point,
 * and `bench/filters.bench.test.ts` asserts it holds.
 */
export const DEFAULT_ONE_EURO: Required<OneEuroOptions> = {
  minCutoff: 0.7,
  beta: 12,
  derivativeCutoff: 1.0,
};

/** One Euro over a single scalar channel. */
export class OneEuroFilter {
  private readonly opts: Required<OneEuroOptions>;
  private readonly xFilter = new LowPass();
  private readonly dxFilter = new LowPass();
  private xPrev: number | null = null;
  /** Last filtered derivative, in units per second. */
  private dxHat = 0;

  constructor(options: OneEuroOptions = {}) {
    this.opts = { ...DEFAULT_ONE_EURO, ...options };
  }

  /** Filtered derivative of the last sample, units per second. */
  get velocity(): number {
    return this.dxHat;
  }

  /**
   * Feed one sample.
   * @param x     the raw value
   * @param dtSec seconds since the previous sample; must be > 0
   */
  filter(x: number, dtSec: number): number {
    if (!(dtSec > 0) || !Number.isFinite(dtSec)) {
      // A zero or garbage timestep would divide by zero in alphaFor. Treat it
      // as "no new information" and hold, rather than poisoning the state.
      return this.xFilter.initialized ? this.filter(x, 1 / 60) : this.seedAt(x);
    }
    const dx = this.xPrev === null ? 0 : (x - this.xPrev) / dtSec;
    this.dxHat = this.dxFilter.filter(dx, alphaFor(this.opts.derivativeCutoff, dtSec));

    const cutoff = this.opts.minCutoff + this.opts.beta * Math.abs(this.dxHat);
    const out = this.xFilter.filter(x, alphaFor(cutoff, dtSec));
    this.xPrev = x;
    return out;
  }

  /**
   * Jump the filter to `x` with zero velocity. Used when a hand first appears
   * or returns after a dropout: blending from a stale position would drag the
   * cursor in from wherever the hand used to be.
   */
  seedAt(x: number): number {
    this.xFilter.seed(x);
    this.dxFilter.seed(0);
    this.xPrev = x;
    this.dxHat = 0;
    return x;
  }

  reset(): void {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.xPrev = null;
    this.dxHat = 0;
  }
}

/** One Euro over a 2D point, one independent filter per axis. */
export class OneEuroPoint {
  private readonly fx: OneEuroFilter;
  private readonly fy: OneEuroFilter;

  constructor(options: OneEuroOptions = {}) {
    this.fx = new OneEuroFilter(options);
    this.fy = new OneEuroFilter(options);
  }

  filter(x: number, y: number, dtSec: number): { x: number; y: number } {
    return { x: this.fx.filter(x, dtSec), y: this.fy.filter(y, dtSec) };
  }

  seedAt(x: number, y: number): { x: number; y: number } {
    return { x: this.fx.seedAt(x), y: this.fy.seedAt(y) };
  }

  /** Filtered velocity, units per second on each axis. */
  get velocity(): { x: number; y: number } {
    return { x: this.fx.velocity, y: this.fy.velocity };
  }

  reset(): void {
    this.fx.reset();
    this.fy.reset();
  }
}
