import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  newRecordingId,
  listRecordings,
  deleteRecording,
  saveRecordingCapped,
  saveRecording,
} from './recordingStore';

const h = vi.hoisted(() => ({
  auth: { getSession: vi.fn() },
  from: vi.fn(),
}));

vi.mock('../../supabase', () => ({
  supabase: { auth: h.auth, from: h.from },
}));

type Row = { id: string; created_at: number; duration_ms: number | null };

/** A stateful mock of supabase.from('recordings') that supports the
 *  select/order (list), delete/eq (delete), and insert (save) chains used
 *  by recordingStore.ts, tracking deleted ids and the last insert payload
 *  so tests can assert on them. */
function makeRecordingsMock() {
  let rows: Row[] = [];
  let deleteShouldFail = false;
  const deletedIds: string[] = [];
  let inserted: Record<string, unknown> | null = null;

  h.from.mockImplementation(() => {
    let mode: 'select' | 'delete' | 'insert' | null = null;
    let pendingDeleteId: string | null = null;
    const builder = {
      select: vi.fn(() => {
        mode = 'select';
        return builder;
      }),
      eq: vi.fn((col: string, val: string) => {
        if (mode === 'delete' && col === 'id') pendingDeleteId = val;
        return builder;
      }),
      order: vi.fn(() => builder),
      delete: vi.fn(() => {
        mode = 'delete';
        return builder;
      }),
      insert: vi.fn((payload: Record<string, unknown>) => {
        mode = 'insert';
        inserted = payload;
        return builder;
      }),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        let result: { data?: unknown; error?: unknown };
        if (mode === 'select') {
          result = { data: rows, error: null };
        } else if (mode === 'delete') {
          if (deleteShouldFail) {
            result = { error: { message: 'boom' } };
          } else {
            if (pendingDeleteId) deletedIds.push(pendingDeleteId);
            result = { error: null };
          }
        } else if (mode === 'insert') {
          result = { error: null };
        } else {
          result = { data: null, error: null };
        }
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return builder;
  });

  return {
    setRows: (r: Row[]) => { rows = r; },
    setDeleteFails: (v: boolean) => { deleteShouldFail = v; },
    deletedIds,
    get inserted() { return inserted; },
  };
}

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

describe('recordingStore', () => {
  let mock: ReturnType<typeof makeRecordingsMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    mock = makeRecordingsMock();
    h.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
  });

  describe('listRecordings', () => {
    it('maps rows to RecordingMeta, newest first', async () => {
      mock.setRows([
        { id: 'a', created_at: 2000, duration_ms: 1000 },
        { id: 'b', created_at: 1000, duration_ms: null },
      ]);
      await expect(listRecordings()).resolves.toEqual([
        { id: 'a', createdAt: 2000, durationMs: 1000 },
        { id: 'b', createdAt: 1000, durationMs: null },
      ]);
      expect(h.from).toHaveBeenCalledWith('recordings');
    });

    it('resolves to [] when signed out', async () => {
      h.auth.getSession.mockResolvedValue({ data: { session: null } });
      await expect(listRecordings()).resolves.toEqual([]);
    });

    it('resolves to [] when supabase is unconfigured', async () => {
      vi.resetModules();
      vi.doMock('../../supabase', () => ({ supabase: null }));
      const unconfigured = await import('./recordingStore');
      await expect(unconfigured.listRecordings()).resolves.toEqual([]);
      vi.doUnmock('../../supabase');
      vi.resetModules();
    });
  });

  describe('deleteRecording', () => {
    it('deletes by id and user_id, returns true on success', async () => {
      const ok = await deleteRecording('rec1');
      expect(ok).toBe(true);
      expect(mock.deletedIds).toEqual(['rec1']);
    });

    it('returns false on error', async () => {
      mock.setDeleteFails(true);
      const ok = await deleteRecording('rec1');
      expect(ok).toBe(false);
    });

    it('returns false when signed out', async () => {
      h.auth.getSession.mockResolvedValue({ data: { session: null } });
      const ok = await deleteRecording('rec1');
      expect(ok).toBe(false);
      expect(h.from).not.toHaveBeenCalled();
    });
  });

  describe('saveRecordingCapped', () => {
    it('at cap deletes oldest then inserts', async () => {
      mock.setRows([{ id: 'OLDOLDOLD1', created_at: 1, duration_ms: 5000 }]);
      const id = await saveRecordingCapped('payload', 12_000, 1);
      expect(mock.deletedIds).toEqual(['OLDOLDOLD1']);
      expect(mock.inserted).toMatchObject({ duration_ms: 12_000, data: 'payload' });
      expect(id).toHaveLength(10);
    });

    it('with multiple rows at cap, deletes oldest and inserts', async () => {
      // Seed with 5 rows in newest-first order (matching listRecordings behavior)
      mock.setRows([
        { id: 'AAAAAAAAAA', created_at: 5000, duration_ms: 1000 },
        { id: 'BBBBBBBBBB', created_at: 4000, duration_ms: 2000 },
        { id: 'CCCCCCCCCC', created_at: 3000, duration_ms: 1500 },
        { id: 'DDDDDDDDDD', created_at: 2000, duration_ms: 2500 },
        { id: 'EEEEEEEEEE', created_at: 1000, duration_ms: 1800 },
      ]);
      // Cap is 3: keep 2 newest, evict 3 oldest
      const id = await saveRecordingCapped('payload', 9_000, 3);
      // Should delete the 3 oldest (indices 2, 3, 4 in newest-first list)
      expect(new Set(mock.deletedIds)).toEqual(
        new Set(['CCCCCCCCCC', 'DDDDDDDDDD', 'EEEEEEEEEE']),
      );
      expect(mock.inserted).toMatchObject({ duration_ms: 9_000, data: 'payload' });
      expect(id).toHaveLength(10);
    });

    it('aborts (returns null, no insert) if the delete fails', async () => {
      mock.setRows([{ id: 'OLDOLDOLD1', created_at: 1, duration_ms: 5000 }]);
      mock.setDeleteFails(true);
      const id = await saveRecordingCapped('payload', 12_000, 1);
      expect(id).toBeNull();
      expect(mock.inserted).toBeNull();
    });

    it('cap Infinity skips list/delete entirely', async () => {
      const id = await saveRecordingCapped('payload', 12_000, Infinity);
      expect(mock.deletedIds).toEqual([]);
      expect(mock.inserted).toMatchObject({ duration_ms: 12_000, data: 'payload' });
      expect(id).toHaveLength(10);
      // only the insert call should have happened, no select/order for list
      expect(h.from).toHaveBeenCalledTimes(1);
    });
  });

  describe('saveRecording (legacy)', () => {
    it('inserts with duration_ms null', async () => {
      const id = await saveRecording('payload');
      expect(mock.inserted).toMatchObject({ duration_ms: null, data: 'payload' });
      expect(id).toHaveLength(10);
    });
  });
});
