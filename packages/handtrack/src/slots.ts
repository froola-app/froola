// Assigning detected hands to stable slots.
//
// The rule this preserves: a hand's slot comes from *where it is on screen*,
// never from the hand model's own left/right label. That label flickers frame
// to frame, and when it flips it swaps which control a hand is driving
// mid-gesture. Screen position does not have that failure mode.
//
// What position-only assignment does have is a seam. Assigning each frame
// independently means a hand sitting near the boundary between two anchors
// re-decides every frame, and tiny landmark noise is enough to flip it. The
// consumer sees the two hands trade places several times a second while both
// are being held still.
//
// So: position still decides, but a switch has to earn it. The assignment that
// preserves last frame's identities is held unless a different one beats it by
// a real margin, and keeps beating it for long enough that noise cannot be the
// cause. A hand that genuinely crosses over still switches — it just crosses
// once instead of twenty times.

import type { Point } from './types';

export type SlotAssignerOptions = {
  /**
   * How much closer (in target-space units) a competing assignment must be
   * before identities are allowed to swap. Roughly "how far past the midpoint
   * the hand must commit", so it scales with the 0-1 viewport: 0.05 is 5% of
   * the shorter axis.
   */
  switchMargin?: number;
  /** How long (ms) that margin must hold before the swap is adopted. */
  switchDwellMs?: number;
  /**
   * After this long (ms) without a detection, a slot's remembered position is
   * treated as stale and stops anchoring identity — the next hand to appear is
   * assigned purely by position, with no history to be dragged by.
   */
  memoryMs?: number;
  /**
   * How quickly a slot's remembered position follows the hand, per frame.
   *
   * This has to be a running average rather than simply last frame's position,
   * and that is the crux of the whole mechanism. When two hands are held closer
   * together than the landmark noise, *last frame's position tells you nothing*
   * about which hand is which — it inverts as often as the raw ordering does,
   * so matching against it inherits exactly the chatter it was meant to fix.
   * Averaging over several frames pushes the noise below the separation and
   * makes identity recoverable again.
   *
   * Lower is steadier but slower to follow real motion. 0.35 settles within a
   * few frames, which is well inside the dwell a genuine swap has to serve.
   */
  memoryAlpha?: number;
};

export const DEFAULT_SLOT_ASSIGNER: Required<SlotAssignerOptions> = {
  switchMargin: 0.05,
  switchDwellMs: 120,
  memoryMs: 300,
  memoryAlpha: 0.35,
};

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Every way to give `k` points distinct slots out of `n`. Hand tracking runs
 * with n = 2, so this is 2 candidates at most; the general form just avoids a
 * special case for the one-hand path.
 */
function injections(k: number, n: number): number[][] {
  const out: number[][] = [];
  const current: number[] = [];
  const used = new Array(n).fill(false);
  (function walk(depth: number) {
    if (depth === k) { out.push(current.slice()); return; }
    for (let s = 0; s < n; s++) {
      if (used[s]) continue;
      used[s] = true;
      current.push(s);
      walk(depth + 1);
      current.pop();
      used[s] = false;
    }
  })(0);
  return out;
}

export class SlotAssigner {
  private readonly opts: Required<SlotAssignerOptions>;
  /** Last reported position per slot, and when it was last seen. */
  private readonly memory: ({ point: Point; seenMs: number } | null)[];
  private pendingKey: string | null = null;
  private pendingSinceMs = 0;

  readonly slotCount: number;

  constructor(slotCount: number, options: SlotAssignerOptions = {}) {
    this.slotCount = slotCount;
    this.opts = { ...DEFAULT_SLOT_ASSIGNER, ...options };
    this.memory = new Array(slotCount).fill(null);
  }

  /**
   * Assign this frame's points to slots.
   *
   * @param points  detected hand positions in target space
   * @param anchors one reference position per slot — for froola, the two wheel
   *                centers. Passed per call because they move with the
   *                viewport; a portrait layout stacks them diagonally, where an
   *                x-axis split would misassign a hand reaching for the lower
   *                wheel.
   * @returns slot index per input point, parallel to `points`
   */
  assign(points: Point[], anchors: Point[], nowMs: number): number[] {
    const k = Math.min(points.length, this.slotCount);
    if (k === 0) return [];
    const pts = points.slice(0, k);

    const candidates = injections(k, this.slotCount);
    const anchorCost = (perm: number[]) =>
      perm.reduce((sum, slot, i) => sum + dist(pts[i], anchors[slot]), 0);

    // What position alone says, ignoring history.
    let byPosition = candidates[0];
    let bestCost = anchorCost(byPosition);
    for (const perm of candidates.slice(1)) {
      const c = anchorCost(perm);
      if (c < bestCost) { bestCost = c; byPosition = perm; }
    }

    // What continuity says: the assignment keeping each hand on the slot whose
    // remembered position it is nearest. Only slots seen recently participate.
    const fresh = this.memory.map(m => (m && nowMs - m.seenMs <= this.opts.memoryMs ? m : null));
    const usable = candidates.filter(perm => perm.some(slot => fresh[slot]));
    let chosen = byPosition;

    if (usable.length > 0) {
      let byHistory = usable[0];
      let historyCost = Infinity;
      for (const perm of usable) {
        let c = 0;
        let matched = 0;
        perm.forEach((slot, i) => {
          const m = fresh[slot];
          if (m) { c += dist(pts[i], m.point); matched++; }
        });
        // Compare like with like: an assignment that only matches one slot
        // would otherwise win on having fewer terms to add up.
        const normalized = matched > 0 ? c / matched : Infinity;
        if (normalized < historyCost) { historyCost = normalized; byHistory = perm; }
      }

      if (key(byHistory) === key(byPosition)) {
        // History and position agree: nothing to arbitrate.
        this.pendingKey = null;
        chosen = byPosition;
      } else {
        // They disagree. Hold the identities we already have unless position
        // wins by the margin, for the dwell.
        const gain = anchorCost(byHistory) - anchorCost(byPosition);
        if (gain > this.opts.switchMargin) {
          if (this.pendingKey !== key(byPosition)) {
            this.pendingKey = key(byPosition);
            this.pendingSinceMs = nowMs;
          }
          chosen = nowMs - this.pendingSinceMs >= this.opts.switchDwellMs ? byPosition : byHistory;
          if (chosen === byPosition) this.pendingKey = null;
        } else {
          this.pendingKey = null;
          chosen = byHistory;
        }
      }
    }

    // Fold this frame into each slot's running average. A slot that went stale
    // restarts from the observation rather than blending across the gap.
    chosen.forEach((slot, i) => {
      const prev = fresh[slot];
      const a = this.opts.memoryAlpha;
      const point = prev
        ? { x: prev.point.x + (pts[i].x - prev.point.x) * a, y: prev.point.y + (pts[i].y - prev.point.y) * a }
        : { x: pts[i].x, y: pts[i].y };
      this.memory[slot] = { point, seenMs: nowMs };
    });
    return chosen;
  }

  /** Last remembered position for a slot, if it is still fresh. */
  remembered(slot: number, nowMs: number): Point | null {
    const m = this.memory[slot];
    return m && nowMs - m.seenMs <= this.opts.memoryMs ? m.point : null;
  }

  reset(): void {
    this.memory.fill(null);
    this.pendingKey = null;
  }
}

function key(perm: number[]): string {
  return perm.join(',');
}
