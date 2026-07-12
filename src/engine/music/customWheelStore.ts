import { supabase } from '../../supabase';
import type { CustomWheel, WheelSlice, TriadQuality } from './keyScale';

const QUALITIES: TriadQuality[] = ['maj', 'min', 'dim', 'aug'];

// `slices` is free-form jsonb in the DB — a malformed row (hand-edited,
// migration drift) must never reach the rAF loop, where a missing interval
// would NaN the audio path every frame. Only exactly-7 well-formed slices pass.
function isWellFormedWheel(row: unknown): row is CustomWheel {
  if (typeof row !== 'object' || row === null) return false;
  const { id, name, slices } = row as Record<string, unknown>;
  return typeof id === 'string' && typeof name === 'string' &&
    Array.isArray(slices) && slices.length === 7 &&
    slices.every(s =>
      typeof s === 'object' && s !== null &&
      typeof (s as WheelSlice).interval === 'number' &&
      Number.isFinite((s as WheelSlice).interval) &&
      QUALITIES.includes((s as WheelSlice).quality));
}

// Persists custom wheels to public.custom_wheels (0005_custom_wheels.sql).
// Everything degrades gracefully — unconfigured Supabase, signed-out user,
// or network failure resolves to the empty/null case and the UI just shows
// no saved wheels (same philosophy as recording/recordingStore.ts).

export async function listWheels(): Promise<CustomWheel[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('custom_wheels')
      .select('id, name, slices')
      .order('created_at', { ascending: true });
    return error || !data ? [] : (data as unknown[]).filter(isWellFormedWheel);
  } catch {
    return [];
  }
}

/** Insert (no id) or update (with id). Resolves to the saved wheel, or null. */
export async function saveWheel(
  name: string,
  slices: WheelSlice[],
  id?: string,
): Promise<CustomWheel | null> {
  if (!supabase) return null;
  try {
    if (id) {
      const { data, error } = await supabase
        .from('custom_wheels')
        .update({ name, slices })
        .eq('id', id)
        .select('id')
        .single();
      return error || !data ? null : { id, name, slices };
    }
    const { data: s } = await supabase.auth.getSession();
    const userId = s.session?.user.id;
    if (!userId) return null;
    const { data, error } = await supabase
      .from('custom_wheels')
      .insert({ user_id: userId, name, slices, created_at: Date.now() })
      .select('id')
      .single();
    return error || !data ? null : { id: data.id as string, name, slices };
  } catch {
    return null;
  }
}

export async function deleteWheel(id: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('custom_wheels').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}
