import { describe, it, expect } from 'vitest';
import { capabilities, FULL_ACCESS, MAX_VIDEO_RECORD_MS } from './capabilities';

describe('capabilities', () => {
  it('unlocks every feature, signed in or not', () => {
    const c = capabilities();
    expect(c.pianoUnlocked).toBe(true);
    expect(c.visualThemesUnlocked).toBe(true);
    expect(c.loopUnlocked).toBe(true);
    expect(c.arpUnlocked).toBe(true);
    expect(c.exportUnlocked).toBe(true);
    expect(c.hideDialsUnlocked).toBe(true);
  });

  it('leaves recordings and loop slots unbounded', () => {
    const c = capabilities();
    expect(c.maxRecordings).toBe(Infinity);
    expect(c.loopSlots).toBe(Infinity);
  });

  it('caps video capture on browser memory, not on a plan', () => {
    expect(capabilities().maxVideoRecordMs).toBe(MAX_VIDEO_RECORD_MS);
    expect(MAX_VIDEO_RECORD_MS).toBe(600_000);
  });

  it('hands back the shared full-access set', () => {
    expect(capabilities()).toBe(FULL_ACCESS);
  });
});
