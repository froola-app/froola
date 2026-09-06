import { describe, it, expect } from 'vitest';
import {
  capabilities, FULL_ACCESS, MAX_VIDEO_RECORD_MS, MAX_REPLAY_RECORD_MS,
} from './capabilities';

describe('capabilities', () => {
  it('unlocks every boolean feature, signed in or not', () => {
    const c = capabilities();
    // Asserted structurally rather than one by one: a flag added later is
    // covered automatically, which is the point of there being no plans.
    const gates = Object.entries(c).filter(([k, v]) =>
      typeof v === 'boolean' && !k.endsWith('Watermark'));
    expect(gates.length).toBeGreaterThan(8);
    for (const [name, value] of gates) expect([name, value]).toEqual([name, true]);
  });

  it('never watermarks a recording or an export', () => {
    expect(capabilities().replayWatermark).toBe(false);
    expect(capabilities().exportWatermark).toBe(false);
  });

  it('leaves stored recordings and loop slots unbounded', () => {
    expect(capabilities().maxSavedRecordings).toBe(Infinity);
    expect(capabilities().loopSlots).toBe(Infinity);
  });

  it('caps capture on browser memory and link size, not on a plan', () => {
    expect(capabilities().maxVideoRecordMs).toBe(MAX_VIDEO_RECORD_MS);
    expect(capabilities().maxReplayRecordMs).toBe(MAX_REPLAY_RECORD_MS);
  });

  it('returns the same set every call, with nothing to vary on', () => {
    expect(capabilities()).toBe(FULL_ACCESS);
    expect(capabilities.length).toBe(0);
  });
});
