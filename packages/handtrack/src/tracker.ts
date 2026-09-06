// The tracker: landmarks in, stable hand signals out.
//
// Nothing in here touches the DOM, React, a camera, or MediaPipe. It is fed
// landmarks and a timestamp and returns what the hands are doing, which is what
// makes the whole pipeline testable — every behaviour below is exercised in CI
// against synthetic traces, with no device and no camera permission. See
// `bench/` for the traces and the numbers they hold the filters to.

import { curlScore } from './curl';
import { classifyHandFacing } from './facing';
import { FistGate, type FistGateOptions } from './fist';
import { OneEuroPoint, type OneEuroOptions } from './oneEuro';
import { palmCenter } from './palm';
import { SlotAssigner, type SlotAssignerOptions } from './slots';
import type { HandFrame, Point, TrackedHand } from './types';

/** Index fingertip: what an open hand points with. */
const INDEX_TIP = 8;

export type HandTrackerOptions = {
  /** How many hands can be tracked at once. froola uses 2, one per wheel. */
  slotCount?: number;
  oneEuro?: OneEuroOptions;
  fist?: FistGateOptions;
  slots?: SlotAssignerOptions;
  /**
   * How far ahead (ms) to extrapolate along the filtered velocity.
   *
   * Inference is slower than the display: detection runs around 30 Hz while the
   * page paints at 60, so by the time a position is drawn it describes where
   * the hand *was*, roughly half an inference ago plus the model's own latency.
   * Projecting forward along the velocity the filter already computes cancels
   * most of that at no extra cost.
   *
   * The reason to keep it small: prediction is wrong at exactly the moment a
   * hand reverses direction, where it overshoots. `maxPredictDistance` bounds
   * how bad that can get. At rest the velocity is ~0, so this contributes
   * nothing to jitter. Set to 0 to disable.
   */
  predictMs?: number;
  /** Hard cap (target-space units) on how far prediction may move a hand. */
  maxPredictDistance?: number;
  /**
   * How long (ms) to keep reporting a hand after detection loses it.
   *
   * A single missed frame used to blank the hand entirely, which read as the
   * cursor vanishing and the idle state flashing back for one frame. Holding
   * the last position across a brief gap is both less distracting and more
   * accurate: the hand did not actually go anywhere.
   */
  coastMs?: number;
  /**
   * A gap longer than this (ms) means the next appearance is a *new* hand, so
   * the filters are seeded at its position instead of blending from a stale
   * one. Without this the cursor slides in from wherever the hand last was.
   */
  reappearGapMs?: number;
};

export const DEFAULT_TRACKER: Required<Omit<HandTrackerOptions, 'oneEuro' | 'fist' | 'slots'>> = {
  slotCount: 2,
  predictMs: 16,
  maxPredictDistance: 0.04,
  coastMs: 120,
  reappearGapMs: 300,
};

/** Everything about this frame that is not the hands themselves. */
export type FrameContext = {
  /** One reference position per slot, in target space. */
  anchors: Point[];
  /** Frame space to target space. See `coverTransform`. */
  mapPoint: (p: Point) => Point;
  /** Monotonic timestamp in ms (`performance.now()`). */
  nowMs: number;
};

type SlotState = {
  filter: OneEuroPoint;
  gate: FistGate;
  lastSeenMs: number;
  wasFist: boolean;
  /** Position held while a fist is closed, or null when open. */
  frozen: Point | null;
  /** Last emitted signal, replayed while coasting. */
  last: TrackedHand | null;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class HandTracker {
  private readonly opts: Required<Omit<HandTrackerOptions, 'oneEuro' | 'fist' | 'slots'>>;
  private readonly assigner: SlotAssigner;
  private readonly state: SlotState[];

  constructor(options: HandTrackerOptions = {}) {
    this.opts = { ...DEFAULT_TRACKER, ...options };
    this.assigner = new SlotAssigner(this.opts.slotCount, options.slots);
    this.state = Array.from({ length: this.opts.slotCount }, () => ({
      filter: new OneEuroPoint(options.oneEuro),
      gate: new FistGate(options.fist),
      lastSeenMs: -Infinity,
      wasFist: false,
      frozen: null,
      last: null,
    }));
  }

  /**
   * Advance one frame.
   *
   * @returns one entry per live hand, ordered by slot. A hand missing from
   *          `hands` may still be reported for up to `coastMs`, flagged
   *          `coasting`.
   */
  update(hands: HandFrame[], ctx: FrameContext): TrackedHand[] {
    const { anchors, mapPoint, nowMs } = ctx;
    const seen = hands.slice(0, this.opts.slotCount);

    // Curl and palm center first: both are independent of which slot a hand
    // ends up on, and assignment needs a position that does not lurch when a
    // hand opens or closes. The palm center is that position; the fingertip is
    // not, which is why assignment does not use the reported point.
    const observed = seen.map(h => {
      const palm = palmCenter(h.landmarks);
      return {
        frame: h,
        curl: curlScore(h.landmarks),
        palm,
        tip: h.landmarks[INDEX_TIP] ?? palm,
        anchorPoint: mapPoint(palm),
      };
    });

    const slots = this.assigner.assign(observed.map(o => o.anchorPoint), anchors, nowMs);

    const out: TrackedHand[] = [];
    const filled = new Set<number>();

    for (let i = 0; i < observed.length; i++) {
      const o = observed[i];
      const slot = slots[i];
      const st = this.state[slot];
      filled.add(slot);

      const gapMs = nowMs - st.lastSeenMs;
      const isNew = gapMs > this.opts.reappearGapMs;

      const fist = isNew
        ? (st.gate.seed(o.curl), st.gate.isFist)
        : st.gate.update(o.curl, nowMs);

      // An open hand points with its fingertip; a closed one reports its palm,
      // so a curled index finger cannot drag the held position sideways.
      const raw = fist ? o.anchorPoint : mapPoint(o.tip);

      let smoothed: Point;
      if (isNew) {
        st.filter.reset();
        smoothed = st.filter.seedAt(raw.x, raw.y);
        st.frozen = null;
        st.wasFist = fist;
        if (fist) st.frozen = { ...raw };
      } else {
        smoothed = st.filter.filter(raw.x, raw.y, Math.max(gapMs, 1) / 1000);
      }

      // Fist edges. Closing snaps to this frame's palm rather than the smoothed
      // value, because the filter is still carrying fingertip positions from
      // the open-hand frames just before it.
      if (fist && !st.wasFist) {
        st.filter.seedAt(raw.x, raw.y);
        smoothed = { x: raw.x, y: raw.y };
        st.frozen = { ...raw };
      } else if (!fist && st.wasFist) {
        st.frozen = null;
        // Release from wherever the fist was held, so opening the hand does not
        // teleport the cursor back to a stale fingertip position.
        smoothed = st.filter.seedAt(raw.x, raw.y);
      }
      st.wasFist = fist;

      let x: number;
      let y: number;
      if (st.frozen) {
        x = st.frozen.x;
        y = st.frozen.y;
      } else {
        const v = st.filter.velocity;
        const ahead = this.opts.predictMs / 1000;
        let dx = v.x * ahead;
        let dy = v.y * ahead;
        const step = Math.hypot(dx, dy);
        const cap = this.opts.maxPredictDistance;
        if (step > cap && step > 0) {
          const k = cap / step;
          dx *= k;
          dy *= k;
        }
        x = smoothed.x + dx;
        y = smoothed.y + dy;
      }

      const signal: TrackedHand = {
        slot,
        x: clamp01(x),
        y: clamp01(y),
        vx: st.filter.velocity.x,
        vy: st.filter.velocity.y,
        curl: o.curl,
        fist,
        facing: classifyHandFacing(o.frame.worldLandmarks),
        coasting: false,
      };
      st.lastSeenMs = nowMs;
      st.last = signal;
      out.push(signal);
    }

    // Slots that went missing this frame: replay the last signal briefly rather
    // than blanking, so a one-frame detection miss is invisible.
    for (let slot = 0; slot < this.opts.slotCount; slot++) {
      if (filled.has(slot)) continue;
      const st = this.state[slot];
      if (!st.last || nowMs - st.lastSeenMs > this.opts.coastMs) {
        st.last = null;
        continue;
      }
      out.push({ ...st.last, coasting: true });
    }

    out.sort((a, b) => a.slot - b.slot);
    return out;
  }

  /** Drop all history. Call when the camera restarts or the layout changes. */
  reset(): void {
    this.assigner.reset();
    for (const st of this.state) {
      st.filter.reset();
      st.gate.reset();
      st.lastSeenMs = -Infinity;
      st.wasFist = false;
      st.frozen = null;
      st.last = null;
    }
  }
}
