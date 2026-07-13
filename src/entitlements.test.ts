import { describe, it, expect } from 'vitest';
import { effectivePlan, entitlementsFor } from './entitlements';

describe('entitlements', () => {
  it('treats a missing profile (signed out) as free', () => {
    expect(effectivePlan(null)).toBe('free');
    expect(entitlementsFor(null).pianoUnlocked).toBe(false);
  });

  it('locks piano, arp, and video recording on free; replay recording is 20s watermarked', () => {
    const e = entitlementsFor({ plan: 'free', betaTester: false });
    expect(e.pianoUnlocked).toBe(false);
    expect(e.arpUnlocked).toBe(false);
    expect(e.replayWatermark).toBe(true);
    // Video (MP4) is paid-only (Plus+); replay recording reinstated on free (2026-07-12).
    expect(e.videoRecordUnlocked).toBe(false);
    expect(e.replayRecordUnlocked).toBe(true);
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

  it('gates custom wheels to plus and studio', () => {
    expect(entitlementsFor(null).customWheelsUnlocked).toBe(false);
    expect(entitlementsFor({ plan: 'plus', betaTester: false }).customWheelsUnlocked).toBe(true);
    expect(entitlementsFor({ plan: 'studio', betaTester: false }).customWheelsUnlocked).toBe(true);
    expect(entitlementsFor({ plan: 'free', betaTester: true }).customWheelsUnlocked).toBe(true); // beta → studio
  });
});

describe('tier matrix 2026-07-12', () => {
  const free = entitlementsFor(null);
  const plus = entitlementsFor({ plan: 'plus', betaTester: false });
  const studio = entitlementsFor({ plan: 'studio', betaTester: false });

  it('free gets one 20s watermarked replay recording back', () => {
    expect(free.replayRecordUnlocked).toBe(true);
    expect(free.maxReplayRecordMs).toBe(20_000);
    expect(free.replayWatermark).toBe(true);
    expect(free.videoRecordUnlocked).toBe(false); // mp4 stays Plus+
  });

  it('saved-recording caps are 1 / 3 / unlimited', () => {
    expect(free.maxSavedRecordings).toBe(1);
    expect(plus.maxSavedRecordings).toBe(3);
    expect(studio.maxSavedRecordings).toBe(Infinity);
  });

  it('exports: plus marked mp4 + mp3; studio clean', () => {
    expect(free.audioExportUnlocked).toBe(false);
    expect(plus.audioExportUnlocked).toBe(true);
    expect(free.exportWatermark).toBe(true);
    expect(plus.exportWatermark).toBe(true);
    expect(studio.exportWatermark).toBe(false);
  });

  it('lyrics import and My Song are Plus+', () => {
    expect(free.lyricsImportUnlocked).toBe(false);
    expect(plus.lyricsImportUnlocked).toBe(true);
    expect(free.mySongUnlocked).toBe(false);
    expect(plus.mySongUnlocked).toBe(true);
    expect(studio.mySongUnlocked).toBe(true);
  });
});
