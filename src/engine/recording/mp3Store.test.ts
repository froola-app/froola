import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { saveMp3, listMp3s, getMp3Blob, deleteMp3 } from './mp3Store';

// jsdom has no IndexedDB — fake-indexeddb provides a spec-compliant in-memory
// one. A fresh IDBFactory per test isolates the database between tests.
beforeEach(() => {
  vi.clearAllMocks();
  globalThis.indexedDB = new IDBFactory();
});

const blob = (s: string) => new Blob([s], { type: 'audio/mpeg' });

describe('mp3Store', () => {
  it('saves an mp3 and returns a non-empty id', async () => {
    const id = await saveMp3(blob('take-1'), 12_000);
    expect(id).toBeTruthy();
  });

  it('lists saved mp3s newest first with metadata only', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(1_000);
      const older = await saveMp3(blob('old'), 5_000);
      vi.setSystemTime(2_000);
      const newer = await saveMp3(blob('new'), 7_000);
      const rows = await listMp3s();
      expect(rows.map(r => r.id)).toEqual([newer, older]);
      expect(rows[0]).toEqual({ id: newer, createdAt: 2_000, durationMs: 7_000 });
      expect(Object.keys(rows[0])).not.toContain('blob');
    } finally {
      vi.useRealTimers();
    }
  });

  it('round-trips the blob through getMp3Blob', async () => {
    const id = await saveMp3(blob('take-bytes'), 3_000);
    const out = await getMp3Blob(id!);
    expect(out).not.toBeNull();
    expect(await out!.text()).toBe('take-bytes');
    expect(out!.type).toBe('audio/mpeg');
  });

  it('returns null for an unknown id', async () => {
    expect(await getMp3Blob('nope')).toBeNull();
  });

  it('deletes an mp3 and drops it from the list', async () => {
    const id = await saveMp3(blob('gone'), 1_000);
    expect(await deleteMp3(id!)).toBe(true);
    expect(await listMp3s()).toEqual([]);
    expect(await getMp3Blob(id!)).toBeNull();
  });

  it('degrades without throwing when IndexedDB is unavailable', async () => {
    // @ts-expect-error simulating a browser context with no IndexedDB
    delete globalThis.indexedDB;
    expect(await saveMp3(blob('x'), 1_000)).toBeNull();
    expect(await listMp3s()).toEqual([]);
    expect(await getMp3Blob('id')).toBeNull();
    expect(await deleteMp3('id')).toBe(false);
  });
});
