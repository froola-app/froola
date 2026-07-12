import { supabase } from '../../supabase';
import type { CustomWheel, WheelSlice } from './keyScale';

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
    return error || !data ? [] : (data as CustomWheel[]);
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
