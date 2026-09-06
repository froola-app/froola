// The filter that One Euro replaced, kept so the benchmarks can compare against
// it rather than against an assertion.
//
// This is the exact scheme the tracker used before: a single exponential moving
// average with a fixed 77 ms time constant, time-corrected so its behaviour
// does not drift with the sample rate. A constant tau of 77 ms is a constant
// cutoff of 1 / (2*pi*0.077) = 2.07 Hz, which is the number the One Euro
// defaults are positioned around — below it at rest, above it in motion.
//
// Not exported from the package. It exists to be beaten.

const LEGACY_TAU_MS = 77;

export class LegacyEma {
  private x: number | null = null;
  private y: number | null = null;

  filter(x: number, y: number, dtSec: number): { x: number; y: number } {
    if (this.x === null || this.y === null) {
      this.x = x;
      this.y = y;
      return { x, y };
    }
    const alpha = 1 - Math.exp(-(dtSec * 1000) / LEGACY_TAU_MS);
    this.x = alpha * x + (1 - alpha) * this.x;
    this.y = alpha * y + (1 - alpha) * this.y;
    return { x: this.x, y: this.y };
  }
}

/** The constant cutoff, in Hz, that the legacy time constant corresponds to. */
export const LEGACY_CUTOFF_HZ = 1000 / (2 * Math.PI * LEGACY_TAU_MS);
