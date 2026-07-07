import { describe, it, expect } from 'vitest';
import { newRecordingId } from './recordingStore';

describe('newRecordingId', () => {
  it('matches the format the recordings table CHECK enforces', () => {
    for (let i = 0; i < 50; i++) {
      expect(newRecordingId()).toMatch(/^[A-Za-z0-9]{10}$/);
    }
  });

  it('does not repeat', () => {
    const ids = new Set(Array.from({ length: 1000 }, newRecordingId));
    expect(ids.size).toBe(1000);
  });
});
