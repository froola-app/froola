import { describe, it, expect } from 'vitest';
import { HandTracker } from './tracker';
import { makeHand } from './bench/traces';
import type { FrameContext } from './tracker';
import type { Point } from './types';

// Two wheel centers side by side, as on a desktop layout.
const ANCHORS: Point[] = [{ x: 0.25, y: 0.6 }, { x: 0.75, y: 0.6 }];
const FRAME_MS = 1000 / 30;

// Identity mapping keeps the assertions readable: the tracker's coordinate
// remap is `coverTransform`'s job and is tested separately.
const ctx = (nowMs: number): FrameContext => ({
  anchors: ANCHORS,
  mapPoint: (p: Point) => p,
  nowMs,
});

/** Where makeHand puts the index fingertip for an open hand centered at c. */
function openTipOf(c: Point): Point {
  return { x: c.x - 0.06, y: c.y - 0.09 };
}

/** Feed the same hand for n frames, returning the last result. */
function hold(tracker: HandTracker, centers: Point[], curls: number[], frames: number, startMs = 0) {
  let out = tracker.update([], ctx(startMs));
  let t = startMs;
  for (let i = 0; i < frames; i++) {
    t = startMs + i * FRAME_MS;
    out = tracker.update(
      centers.map((c, j) => ({ landmarks: makeHand(c, curls[j] ?? 0) })),
      ctx(t)
    );
  }
  return { out, t };
}

describe('HandTracker', () => {
  it('reports an open hand at its fingertip, seeded on first sight', () => {
    // No sliding in from the middle of the screen: the very first frame must
    // already be at the hand.
    const tracker = new HandTracker();
    const center = { x: 0.3, y: 0.5 };
    const [hand] = tracker.update([{ landmarks: makeHand(center, 0) }], ctx(0));
    const tip = openTipOf(center);
    expect(hand.x).toBeCloseTo(tip.x, 2);
    expect(hand.y).toBeCloseTo(tip.y, 2);
    expect(hand.coasting).toBe(false);
    expect(hand.fist).toBe(false);
  });

  it('puts two hands on the slots their positions imply', () => {
    const tracker = new HandTracker();
    const { out } = hold(tracker, [{ x: 0.25, y: 0.6 }, { x: 0.75, y: 0.6 }], [0, 0], 10);
    expect(out.map(h => h.slot)).toEqual([0, 1]);
    // Order of the input array must not matter.
    const other = new HandTracker();
    const { out: swapped } = hold(other, [{ x: 0.75, y: 0.6 }, { x: 0.25, y: 0.6 }], [0, 0], 10);
    expect(swapped.map(h => h.slot)).toEqual([0, 1]);
  });

  it('scores curl continuously rather than only at the fist boundary', () => {
    const tracker = new HandTracker();
    const c = { x: 0.3, y: 0.5 };
    const open = tracker.update([{ landmarks: makeHand(c, 0) }], ctx(0))[0];
    const half = tracker.update([{ landmarks: makeHand(c, 0.5) }], ctx(FRAME_MS))[0];
    const shut = tracker.update([{ landmarks: makeHand(c, 1) }], ctx(FRAME_MS * 2))[0];
    expect(open.curl).toBeLessThan(half.curl);
    expect(half.curl).toBeLessThan(shut.curl);
    expect(shut.curl).toBeGreaterThan(0.9);
  });

  it('holds position while a fist is closed, even as the fist moves', () => {
    // This is the chord lock. Once engaged, the reported point must not budge,
    // so the player can drop their arm without changing the chord.
    const tracker = new HandTracker();
    const start = { x: 0.3, y: 0.5 };
    const { t } = hold(tracker, [start], [1], 10);
    const locked = tracker.update([{ landmarks: makeHand(start, 1) }], ctx(t + FRAME_MS))[0];
    expect(locked.fist).toBe(true);

    let moved = locked;
    for (let i = 1; i <= 10; i++) {
      moved = tracker.update(
        [{ landmarks: makeHand({ x: start.x + i * 0.03, y: start.y + i * 0.02 }, 1) }],
        ctx(t + FRAME_MS * (1 + i))
      )[0];
    }
    expect(moved.fist).toBe(true);
    expect(moved.x).toBeCloseTo(locked.x, 5);
    expect(moved.y).toBeCloseTo(locked.y, 5);
  });

  it('releases the lock when the hand opens', () => {
    const tracker = new HandTracker();
    const c = { x: 0.4, y: 0.5 };
    const { t } = hold(tracker, [c], [1], 10);
    expect(tracker.update([{ landmarks: makeHand(c, 1) }], ctx(t + FRAME_MS))[0].fist).toBe(true);
    let released = tracker.update([{ landmarks: makeHand(c, 0) }], ctx(t + FRAME_MS * 2))[0];
    for (let i = 3; i < 10; i++) {
      released = tracker.update([{ landmarks: makeHand(c, 0) }], ctx(t + FRAME_MS * i))[0];
    }
    expect(released.fist).toBe(false);
    // And it resumes reporting the fingertip, not the palm it was holding.
    expect(released.x).toBeCloseTo(openTipOf(c).x, 2);
  });

  it('coasts through a dropped frame instead of blanking the hand', () => {
    // A single missed detection used to blank the cursor for a frame, which
    // read as a flicker. The hand did not actually go anywhere.
    const tracker = new HandTracker();
    const c = { x: 0.3, y: 0.5 };
    const { t } = hold(tracker, [c], [0], 10);
    const before = tracker.update([{ landmarks: makeHand(c, 0) }], ctx(t + FRAME_MS))[0];

    const gap = tracker.update([], ctx(t + FRAME_MS * 2));
    expect(gap).toHaveLength(1);
    expect(gap[0].coasting).toBe(true);
    expect(gap[0].x).toBeCloseTo(before.x, 5);
  });

  it('gives up on a hand that stays gone', () => {
    const tracker = new HandTracker();
    const c = { x: 0.3, y: 0.5 };
    const { t } = hold(tracker, [c], [0], 10);
    expect(tracker.update([], ctx(t + 50))).toHaveLength(1);   // still coasting
    expect(tracker.update([], ctx(t + 400))).toHaveLength(0);  // gone
  });

  it('re-seeds rather than sliding in when a hand returns after a long gap', () => {
    const tracker = new HandTracker();
    const { t } = hold(tracker, [{ x: 0.25, y: 0.5 }], [0], 10);
    // Away long enough to be a new hand, and back somewhere else entirely.
    const far = { x: 0.75, y: 0.5 };
    const back = tracker.update([{ landmarks: makeHand(far, 0) }], ctx(t + 2000))[0];
    expect(back.x).toBeCloseTo(openTipOf(far).x, 2);
    expect(back.coasting).toBe(false);
  });

  it('does not let prediction drift a hand that is holding still', () => {
    // Prediction only helps if it costs nothing at rest, where velocity is ~0.
    const tracker = new HandTracker();
    const c = { x: 0.4, y: 0.55 };
    const { out } = hold(tracker, [c], [0], 60);
    expect(out[0].x).toBeCloseTo(openTipOf(c).x, 3);
    expect(out[0].y).toBeCloseTo(openTipOf(c).y, 3);
  });

  it('keeps reported positions inside the viewport', () => {
    const tracker = new HandTracker();
    // A hand sweeping hard toward the edge: prediction must not push it out.
    let last = tracker.update([{ landmarks: makeHand({ x: 0.5, y: 0.5 }, 0) }], ctx(0))[0];
    for (let i = 1; i <= 20; i++) {
      last = tracker.update(
        [{ landmarks: makeHand({ x: 0.5 + i * 0.05, y: 0.5 }, 0) }],
        ctx(i * FRAME_MS)
      )[0];
    }
    expect(last.x).toBeGreaterThanOrEqual(0);
    expect(last.x).toBeLessThanOrEqual(1);
  });

  it('classifies facing only when world landmarks are supplied', () => {
    const tracker = new HandTracker();
    const c = { x: 0.3, y: 0.5 };
    const flat = tracker.update(
      [{ landmarks: makeHand(c, 0), worldLandmarks: makeHand({ x: 0, y: 0 }, 0) }],
      ctx(0)
    )[0];
    expect(flat.facing).toBe('ok');
    // Missing world landmarks must not throw or guess wrong.
    const none = tracker.update([{ landmarks: makeHand(c, 0) }], ctx(FRAME_MS))[0];
    expect(none.facing).toBe('ok');
  });

  it('forgets everything on reset', () => {
    const tracker = new HandTracker();
    const { t } = hold(tracker, [{ x: 0.25, y: 0.5 }], [1], 10);
    tracker.reset();
    expect(tracker.update([], ctx(t + FRAME_MS))).toHaveLength(0);
  });
});
