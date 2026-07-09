import { describe, it, expect } from 'vitest';
import { effectivePlan, entitlementsFor } from './entitlements';

describe('entitlements', () => {
  it('treats a missing profile (signed out) as free', () => {
    expect(effectivePlan(null)).toBe('free');
    expect(entitlementsFor(null).pianoUnlocked).toBe(false);
  });

  it('locks piano, video recording, and the arp, caps replays at 20s on free', () => {
    const e = entitlementsFor({ plan: 'free', betaTester: false });
    expect(e.pianoUnlocked).toBe(false);
    expect(e.videoRecordUnlocked).toBe(false);
    expect(e.arpUnlocked).toBe(false);
    expect(e.maxReplayRecordMs).toBe(20_000);
  });

  it('unlocks piano, arp, and 3-minute video on plus', () => {
    const e = entitlementsFor({ plan: 'plus', betaTester: false });
    expect(e.pianoUnlocked).toBe(true);
    expect(e.videoRecordUnlocked).toBe(true);
    expect(e.arpUnlocked).toBe(true);
    expect(e.maxVideoRecordMs).toBe(180_000);
  });

  it('removes the video length cap on studio', () => {
    const e = entitlementsFor({ plan: 'studio', betaTester: false });
    expect(e.maxVideoRecordMs).toBe(Infinity);
  });

  it('gives beta testers studio-level access regardless of plan', () => {
    expect(effectivePlan({ plan: 'free', betaTester: true })).toBe('studio');
    expect(entitlementsFor({ plan: 'free', betaTester: true }).pianoUnlocked).toBe(true);
  });
});
