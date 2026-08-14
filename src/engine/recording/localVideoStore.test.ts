import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  listLocalTakes,
  getLocalTake,
  putLocalTake,
  deleteLocalTake,
  type LocalTake,
} from './localVideoStore';

function take(id: string, createdAt: number): LocalTake {
  return {
    id,
    mime: 'video/webm',
    durationMs: 4_000,
    sizeBytes: 12,
    createdAt,
    blob: new Blob(['not-really-a-video'], { type: 'video/webm' }),
  };
}

beforeEach(async () => {
  for (const t of await listLocalTakes()) await deleteLocalTake(t.id);
});

describe('localVideoStore', () => {
  it('round-trips a take through IndexedDB', async () => {
    expect(await putLocalTake(take('aaa', 1))).toBe(true);

    const stored = await getLocalTake('aaa');
    expect(stored?.id).toBe('aaa');
    expect(stored?.mime).toBe('video/webm');
    expect(stored?.durationMs).toBe(4_000);
    // The blob comes back too, though fake-indexeddb's structured clone hands
    // back a plain object rather than a real Blob — browsers keep the class.
    expect(stored?.blob).toBeDefined();
  });

  it('lists takes newest first', async () => {
    await putLocalTake(take('older', 1_000));
    await putLocalTake(take('newer', 2_000));

    expect((await listLocalTakes()).map(t => t.id)).toEqual(['newer', 'older']);
  });

  it('deletes a take and forgets it', async () => {
    await putLocalTake(take('gone', 1));
    expect(await deleteLocalTake('gone')).toBe(true);
    expect(await getLocalTake('gone')).toBeNull();
  });

  it('reports nothing for an unknown id', async () => {
    expect(await getLocalTake('never-existed')).toBeNull();
  });
});

// Private browsing and non-browser runtimes can leave IndexedDB missing. Every
// call has to degrade instead of throwing, so callers can fall back to a plain
// device download.
describe('localVideoStore without IndexedDB', () => {
  const real = globalThis.indexedDB;
  beforeEach(() => {
    vi.stubGlobal('indexedDB', undefined);
  });
  afterEach(() => {
    vi.stubGlobal('indexedDB', real);
  });

  it('degrades to empty, null, and false', async () => {
    expect(await listLocalTakes()).toEqual([]);
    expect(await getLocalTake('aaa')).toBeNull();
    expect(await putLocalTake(take('aaa', 1))).toBe(false);
    expect(await deleteLocalTake('aaa')).toBe(false);
  });
});
