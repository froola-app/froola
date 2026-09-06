// Debounced fist detection: a Schmitt trigger with a dwell time.
//
// Two mechanisms, because they catch different failures:
//
// 1. Hysteresis (separate enter and exit thresholds). A single threshold makes
//    the boundary infinitely sharp, so a hand resting at exactly that curl
//    oscillates. Requiring more curl to engage than to release means there is
//    no curl value at which the state is unstable.
// 2. Dwell. Hysteresis alone still passes a one-frame spike straight through
//    if a blurry frame briefly scores as a fist. Requiring the new state to
//    hold for a couple of frames rejects those without adding meaningful
//    latency — 50 ms is under two frames of 30 Hz inference.

export type FistGateOptions = {
  /** Curl at or above which a fist engages. */
  enterThreshold?: number;
  /** Curl at or below which it releases. Must be below `enterThreshold`. */
  exitThreshold?: number;
  /** How long (ms) a candidate state must persist before it is adopted. */
  dwellMs?: number;
};

export const DEFAULT_FIST_GATE: Required<FistGateOptions> = {
  // The old boolean test flipped at roughly 0.70 on this scale (three of four
  // fingers past its ratio cutoff), so engaging there preserves the feel that
  // was tuned on a real camera. Release is well below it, which is the part
  // that is new.
  enterThreshold: 0.70,
  exitThreshold: 0.45,
  dwellMs: 50,
};

/** Stateful gate turning a continuous curl score into a stable boolean. */
export class FistGate {
  private readonly opts: Required<FistGateOptions>;
  private state = false;
  /** The state we are currently waiting out the dwell for, if any. */
  private pending: boolean | null = null;
  private pendingSinceMs = 0;

  constructor(options: FistGateOptions = {}) {
    this.opts = { ...DEFAULT_FIST_GATE, ...options };
  }

  get isFist(): boolean {
    return this.state;
  }

  /**
   * Feed this frame's curl score.
   * @param curl  0-1 curl, see `curlScore`
   * @param nowMs monotonic timestamp for the sample
   */
  update(curl: number, nowMs: number): boolean {
    // Which state does this sample argue for? Inside the hysteresis band it
    // argues for neither, which is the point: the current state simply holds.
    const wants = this.state
      ? (curl <= this.opts.exitThreshold ? false : null)
      : (curl >= this.opts.enterThreshold ? true : null);

    if (wants === null) {
      this.pending = null;
      return this.state;
    }
    if (this.pending !== wants) {
      this.pending = wants;
      this.pendingSinceMs = nowMs;
      return this.state;
    }
    if (nowMs - this.pendingSinceMs >= this.opts.dwellMs) {
      this.state = wants;
      this.pending = null;
    }
    return this.state;
  }

  /** Adopt a state immediately, skipping the dwell. */
  force(fist: boolean): void {
    this.state = fist;
    this.pending = null;
  }

  /**
   * Adopt whatever state this curl implies, immediately. Used when a hand
   * reappears after a gap: it may well have been closed the whole time it was
   * out of frame, and making the user wait out a dwell they already served
   * would feel like a dropped gesture.
   */
  seed(curl: number): void {
    this.force(curl >= this.opts.enterThreshold);
  }

  reset(): void {
    this.state = false;
    this.pending = null;
  }
}
