import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listWheels, saveWheel, deleteWheel } from './customWheelStore';
import type { WheelSlice } from './keyScale';

const h = vi.hoisted(() => ({
  auth: { getSession: vi.fn() },
  from: vi.fn(),
}));

vi.mock('../../supabase', () => ({
  supabase: { auth: h.auth, from: h.from },
}));

/** A chainable Postgrest-style query builder mock: every method returns
 *  itself except the terminal `.single()`, and the builder itself is
 *  thenable so `await` on any intermediate step resolves to `result`. */
function makeBuilder(result: { data?: unknown; error?: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    update: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (v: typeof result) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

const slices: WheelSlice[] = Array.from({ length: 7 }, (_, i) => ({
  interval: i,
  quality: 'maj' as const,
}));

describe('customWheelStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listWheels', () => {
    it('resolves to [] when supabase is null (unconfigured)', async () => {
      vi.resetModules();
      vi.doMock('../../supabase', () => ({ supabase: null }));
      const unconfigured = await import('./customWheelStore');
      await expect(unconfigured.listWheels()).resolves.toEqual([]);
      vi.doUnmock('../../supabase');
      vi.resetModules();
    });

    it('maps rows { id, name, slices } to CustomWheel[]', async () => {
      const rows = [
        { id: 'w1', name: 'My Wheel', slices },
        { id: 'w2', name: 'Other Wheel', slices },
      ];
      h.from.mockReturnValue(makeBuilder({ data: rows, error: null }));
      await expect(listWheels()).resolves.toEqual(rows);
      expect(h.from).toHaveBeenCalledWith('custom_wheels');
    });

    it('drops malformed rows so bad jsonb never reaches the rAF loop', async () => {
      const good = { id: 'w1', name: 'Good Wheel', slices };
      const rows = [
        good,
        { id: 'w2', name: 'short', slices: slices.slice(0, 6) },              // only 6 slices
        { id: 'w3', name: 'not-array', slices: { interval: 0 } },             // slices not an array
        { id: 'w4', name: 'bad-interval', slices: slices.map(s => ({ ...s, interval: 'five' })) },
        { id: 'w5', name: 'bad-quality', slices: slices.map(s => ({ ...s, quality: 'sus' })) },
        { id: 'w6', name: 'null-slice', slices: [...slices.slice(0, 6), null] },
      ];
      h.from.mockReturnValue(makeBuilder({ data: rows, error: null }));
      await expect(listWheels()).resolves.toEqual([good]);
    });

    it('resolves to [] on query error', async () => {
      h.from.mockReturnValue(makeBuilder({ data: null, error: { message: 'boom' } }));
      await expect(listWheels()).resolves.toEqual([]);
    });
  });

  describe('saveWheel', () => {
    it('without id: inserts using the session user_id and Date.now() created_at, resolves the new wheel', async () => {
      h.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
      const insertBuilder = makeBuilder({ data: { id: 'new-id' }, error: null });
      h.from.mockReturnValue(insertBuilder);

      const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(123456789);
      const result = await saveWheel('My Wheel', slices);
      nowSpy.mockRestore();

      expect(h.from).toHaveBeenCalledWith('custom_wheels');
      expect(insertBuilder.insert).toHaveBeenCalledWith({
        user_id: 'u1',
        name: 'My Wheel',
        slices,
        created_at: 123456789,
      });
      expect(result).toEqual({ id: 'new-id', name: 'My Wheel', slices });
    });

    it('without id: resolves null when signed out', async () => {
      h.auth.getSession.mockResolvedValue({ data: { session: null } });
      const result = await saveWheel('My Wheel', slices);
      expect(result).toBeNull();
      expect(h.from).not.toHaveBeenCalled();
    });

    it('with id: updates name+slices for that id', async () => {
      const updateBuilder = makeBuilder({ data: { id: 'w1' }, error: null });
      h.from.mockReturnValue(updateBuilder);
      const result = await saveWheel('Renamed', slices, 'w1');

      expect(h.from).toHaveBeenCalledWith('custom_wheels');
      expect(updateBuilder.update).toHaveBeenCalledWith({ name: 'Renamed', slices });
      expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'w1');
      expect(result).toEqual({ id: 'w1', name: 'Renamed', slices });
    });

    it('with id: resolves null on update error', async () => {
      const updateBuilder = makeBuilder({ error: { message: 'boom' } });
      h.from.mockReturnValue(updateBuilder);
      const result = await saveWheel('Renamed', slices, 'w1');
      expect(result).toBeNull();
    });

    it('with id: resolves null when update matches no row (RLS/ownership mismatch)', async () => {
      const updateBuilder = makeBuilder({ data: null, error: { code: 'PGRST116' } });
      h.from.mockReturnValue(updateBuilder);
      const result = await saveWheel('Renamed', slices, 'w1');
      expect(result).toBeNull();
    });
  });

  describe('deleteWheel', () => {
    it('resolves true on success', async () => {
      const deleteBuilder = makeBuilder({ error: null });
      h.from.mockReturnValue(deleteBuilder);
      await expect(deleteWheel('w1')).resolves.toBe(true);
      expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'w1');
    });

    it('resolves false on error', async () => {
      const deleteBuilder = makeBuilder({ error: { message: 'boom' } });
      h.from.mockReturnValue(deleteBuilder);
      await expect(deleteWheel('w1')).resolves.toBe(false);
    });
  });
});
