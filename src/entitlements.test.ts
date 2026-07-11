import { describe, it, expect } from 'vitest';
import { effectivePlan, entitlementsFor } from './entitlements';

describe('entitlements', () => {
  it('treats a missing profile (signed out) as free', () => {
    expect(effectivePlan(null)).toBe('free');
    expect(entitlementsFor(null).pianoUnlocked).toBe(false);
  });

  it('locks piano, arp, and all recording on free', () => {
    const e = entitlementsFor({ plan: 'free', betaTester: false });
    expect(e.pianoUnlocked).toBe(false);
    expect(e.arpUnlocked).toBe(false);
    expect(e.replayWatermark).toBe(true);
    // Recording is paid-only in every form (owner decision, 2026-07-11).
    expect(e.videoRecordUnlocked).toBe(false);
    expect(e.replayRecordUnlocked).toBe(false);
  });

  it('unlocks piano, arp, 3-minute video, and 3-minute replays on plus', () => {
    const e = entitlementsFor({ plan: 'plus', betaTester: false });
    expect(e.pianoUnlocked).toBe(true);
    expect(e.videoRecordUnlocked).toBe(true);
    expect(e.replayRecordUnlocked).toBe(true);
    expect(e.arpUnlocked).toBe(true);
    expect(e.maxVideoRecordMs).toBe(180_000);
    expect(e.maxReplayRecordMs).toBe(180_000);
  });

  it('allows 5-minute video and replays on studio', () => {
    const e = entitlementsFor({ plan: 'studio', betaTester: false });
    expect(e.maxVideoRecordMs).toBe(300_000);
    expect(e.maxReplayRecordMs).toBe(300_000);
  });

  it('gives beta testers studio-level access regardless of plan', () => {
    expect(effectivePlan({ plan: 'free', betaTester: true })).toBe('studio');
    expect(entitlementsFor({ plan: 'free', betaTester: true }).pianoUnlocked).toBe(true);
  });
});
