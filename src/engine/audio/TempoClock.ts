// A tempo clock built on the classic Web Audio "lookahead scheduler" pattern
// (Chris Wilson, "A Tale of Two Clocks"): a coarse setInterval wakes up
// periodically and schedules the *precise* upcoming steps against the audio
// clock (AudioContext.currentTime), so timing never drifts with the JS event
// loop. Consumers (the chord looper, later arpeggiation) register a callback
// that receives each step's exact audio time and can schedule sound for it.

// Only the bit of AudioContext we need — keeps the class trivially testable
// with a fake clock.
export type AudioClock = Pick<AudioContext, 'currentTime'>;

export type ClockStep = {
  /** AudioContext time (seconds) this step should sound at. */
  time: number;
  /** Monotonic step counter since start() (0-based). */
  step: number;
};

export type StepCallback = (e: ClockStep) => void;

export type TempoClockOptions = {
  /** Beats per minute. Clamped to [MIN_BPM, MAX_BPM]. */
  bpm?: number;
  /** Steps emitted per beat — 1 = quarter notes, 4 = sixteenths. */
  stepsPerBeat?: number;
  /** How often the scheduler wakes to look ahead (ms). */
  lookaheadMs?: number;
  /** How far ahead of the audio clock steps are scheduled (seconds). */
  scheduleAheadSec?: number;
};

export const MIN_BPM = 30;
export const MAX_BPM = 300;

const DEFAULTS = {
  bpm: 90,
  stepsPerBeat: 4,
  lookaheadMs: 25,
  scheduleAheadSec: 0.1,
};

const clampBpm = (bpm: number) => Math.max(MIN_BPM, Math.min(MAX_BPM, bpm));

export class TempoClock {
  private ctx: AudioClock;
  private cb: StepCallback;
  private bpm: number;
  private stepsPerBeat: number;
  private lookaheadMs: number;
  private scheduleAheadSec: number;

  private timer: ReturnType<typeof setInterval> | null = null;
  private nextStepTime = 0;
  private step = 0;

  constructor(ctx: AudioClock, cb: StepCallback, opts: TempoClockOptions = {}) {
    this.ctx = ctx;
    this.cb = cb;
    this.bpm = clampBpm(opts.bpm ?? DEFAULTS.bpm);
    this.stepsPerBeat = Math.max(1, Math.floor(opts.stepsPerBeat ?? DEFAULTS.stepsPerBeat));
    this.lookaheadMs = opts.lookaheadMs ?? DEFAULTS.lookaheadMs;
    this.scheduleAheadSec = opts.scheduleAheadSec ?? DEFAULTS.scheduleAheadSec;
  }

  /** Seconds between steps at the current tempo. */
  get stepDuration(): number {
    return 60 / this.bpm / this.stepsPerBeat;
  }

  getBpm(): number {
    return this.bpm;
  }

  /** Change tempo; takes effect from the next scheduled step (no glitch). */
  setBpm(bpm: number): void {
    this.bpm = clampBpm(bpm);
  }

  get running(): boolean {
    return this.timer !== null;
  }

  /** Start the clock at step 0, beginning at the current audio time. */
  start(): void {
    if (this.timer !== null) return;
    this.step = 0;
    this.nextStepTime = this.ctx.currentTime;
    this.timer = setInterval(() => this.schedule(), this.lookaheadMs);
    // Fill the first lookahead window immediately rather than waiting a tick.
    this.schedule();
  }

  stop(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  // Emit every step whose time falls within the lookahead window. Reading
  // stepDuration each iteration means a mid-run setBpm() smoothly retimes the
  // remaining steps.
  private schedule(): void {
    while (this.nextStepTime < this.ctx.currentTime + this.scheduleAheadSec) {
      this.cb({ time: this.nextStepTime, step: this.step });
      this.nextStepTime += this.stepDuration;
      this.step += 1;
    }
  }
}
