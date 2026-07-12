import { describe, it, expect } from 'vitest';
import { effectivePlan, entitlementsFor } from './entitlements';

describe('entitlements', () => {
  it('treats a missing profile (signed out) as free', () => {
    expect(effectivePlan(null)).toBe('free');
    expect(entitlementsFor(null).pianoUnlocked).toBe(false);
  });

  it('gives free one 20s watermarked recording, no piano/arp/export', () => {
    const e = entitlementsFor({ plan: 'free', betaTester: false });
    expect(e.pianoUnlocked).toBe(false);
    expect(e.arpUnlocked).toBe(false);
    expect(e.maxRecordings).toBe(1);
    expect(e.maxVideoRecordMs).toBe(20_000);
    expect(e.recordingWatermark).toBe(true);
    expect(e.exportUnlocked).toBe(false);
  });

  it('gives plus 3 clean 3-minute recordings and watermarked exports', () => {
    const e = entitlementsFor({ plan: 'plus', betaTester: false });
    expect(e.pianoUnlocked).toBe(true);
    expect(e.arpUnlocked).toBe(true);
    expect(e.maxRecordings).toBe(3);
    expect(e.maxVideoRecordMs).toBe(180_000);
    expect(e.recordingWatermark).toBe(false);
    expect(e.exportUnlocked).toBe(true);
    expect(e.exportWatermark).toBe(true);
    expect(e.hideDialsUnlocked).toBe(false);
  });

  it('gives studio unlimited 5-minute recordings, clean exports, hide-dials', () => {
    const e = entitlementsFor({ plan: 'studio', betaTester: false });
    expect(e.maxRecordings).toBe(Infinity);
    expect(e.maxVideoRecordMs).toBe(300_000);
    expect(e.exportWatermark).toBe(false);
    expect(e.hideDialsUnlocked).toBe(true);
  });

  it('gives beta testers studio-level access regardless of plan', () => {
    expect(effectivePlan({ plan: 'free', betaTester: true })).toBe('studio');
    expect(entitlementsFor({ plan: 'free', betaTester: true }).pianoUnlocked).toBe(true);
  });
});
