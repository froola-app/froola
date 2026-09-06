import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMySong, saveMySong, deleteMySong } from './songStore';
import type { SavedLoop } from '../looper';

const h = vi.hoisted(() => ({
  auth: { getSession: vi.fn() },
  from: vi.fn(),
}));

vi.mock('../../supabase', () => ({
  supabase: { auth: h.auth, from: h.from },
}));

type Row = { title: string; sheet_source: string; loops: SavedLoop[]; updated_at: number };

/** A stateful mock of supabase.from('songs') that supports the
 *  select/eq/maybeSingle (get), upsert (save), and delete/eq (delete)
 *  chains used by songStore.ts, tracking the last upsert payload and
 *  deleted user ids so tests can assert on them. */
function makeSongsMock() {
  let row: Row | null = null;
  let deleteShouldFail = false;
  const deletedUserIds: string[] = [];
  let upserted: Record<string, unknown> | null = null;
  let upsertOptions: Record<string, unknown> | null = null;

  h.from.mockImplementation(() => {
    let mode: 'select' | 'delete' | 'upsert' | null = null;
    let pendingDeleteUserId: string | null = null;
    const builder = {
      select: vi.fn(() => {
        mode = 'select';
        return builder;
      }),
      eq: vi.fn((col: string, val: string) => {
        if (mode === 'delete' && col === 'user_id') pendingDeleteUserId = val;
        return builder;
      }),
      maybeSingle: vi.fn(() => builder),
      delete: vi.fn(() => {
        mode = 'delete';
        return builder;
      }),
      upsert: vi.fn((payload: Record<string, unknown>, options: Record<string, unknown>) => {
        mode = 'upsert';
        upserted = payload;
        upsertOptions = options;
        return builder;
      }),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        let result: { data?: unknown; error?: unknown };
        if (mode === 'select') {
          result = { data: row, error: null };
        } else if (mode === 'delete') {
          if (deleteShouldFail) {
            result = { error: { message: 'boom' } };
          } else {
            if (pendingDeleteUserId) deletedUserIds.push(pendingDeleteUserId);
            result = { error: null };
          }
        } else if (mode === 'upsert') {
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
    setRow: (r: Row | null) => { row = r; },
    setDeleteFails: (v: boolean) => { deleteShouldFail = v; },
    deletedUserIds,
    get upserted() { return upserted; },
    get upsertOptions() { return upsertOptions; },
  };
}

describe('songStore', () => {
  let mock: ReturnType<typeof makeSongsMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    mock = makeSongsMock();
    h.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
  });

  describe('getMySong', () => {
    it('maps a row to MySong', async () => {
      const loops: SavedLoop[] = [{ name: 'verse', bpm: 100, beatsPerSlot: 2, slots: [], savedAt: 123 }];
      mock.setRow({ title: 'My Tune', sheet_source: '[C]hello', loops, updated_at: 5000 });
      await expect(getMySong()).resolves.toEqual({
        title: 'My Tune',
        sheetSource: '[C]hello',
        loops,
        updatedAt: 5000,
      });
      expect(h.from).toHaveBeenCalledWith('songs');
    });

    it('resolves to null when signed out', async () => {
      h.auth.getSession.mockResolvedValue({ data: { session: null } });
      await expect(getMySong()).resolves.toBeNull();
      expect(h.from).not.toHaveBeenCalled();
    });

    it('resolves to null when no row', async () => {
      mock.setRow(null);
      await expect(getMySong()).resolves.toBeNull();
    });

    it('resolves to null when supabase is unconfigured', async () => {
      vi.resetModules();
      vi.doMock('../../supabase', () => ({ supabase: null }));
      const unconfigured = await import('./songStore');
      await expect(unconfigured.getMySong()).resolves.toBeNull();
      vi.doUnmock('../../supabase');
      vi.resetModules();
    });
  });

  describe('saveMySong', () => {
    it('upserts with onConflict user_id and both timestamps', async () => {
      const loops: SavedLoop[] = [];
      const ok = await saveMySong({ title: 'My Tune', sheetSource: '[C]hello', loops });
      expect(ok).toBe(true);
      expect(mock.upserted).toMatchObject({
        user_id: 'u1',
        title: 'My Tune',
        sheet_source: '[C]hello',
        loops,
      });
      expect(mock.upserted!.created_at).toBe(mock.upserted!.updated_at);
      expect(typeof mock.upserted!.created_at).toBe('number');
      expect(mock.upsertOptions).toMatchObject({ onConflict: 'user_id', ignoreDuplicates: false });
    });

    it('resolves to false when signed out', async () => {
      h.auth.getSession.mockResolvedValue({ data: { session: null } });
      const ok = await saveMySong({ title: 'x', sheetSource: 'y', loops: [] });
      expect(ok).toBe(false);
      expect(h.from).not.toHaveBeenCalled();
    });
  });

  describe('deleteMySong', () => {
    it('returns true on no error', async () => {
      const ok = await deleteMySong();
      expect(ok).toBe(true);
      expect(mock.deletedUserIds).toEqual(['u1']);
    });

    it('returns false on error', async () => {
      mock.setDeleteFails(true);
      const ok = await deleteMySong();
      expect(ok).toBe(false);
    });

    it('returns false when signed out', async () => {
      h.auth.getSession.mockResolvedValue({ data: { session: null } });
      const ok = await deleteMySong();
      expect(ok).toBe(false);
      expect(h.from).not.toHaveBeenCalled();
    });
  });
});
