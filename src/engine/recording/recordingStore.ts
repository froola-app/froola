import { supabase } from '../../supabase';

// Persists codec payloads to the public.recordings table (0004_recordings.sql)
// so share links can be /replay?r=<short-id> instead of carrying the whole
// recording. Both functions degrade to null — callers fall back to the
// self-contained ?d=<payload> link when Supabase is unconfigured, the user
// is signed out, or the network fails.

const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 10; // must match the format CHECK in 0004_recordings.sql

export function newRecordingId(): string {
  const bytes = new Uint8Array(ID_LENGTH);
  crypto.getRandomValues(bytes);
  // 256 % 62 ≠ 0 gives a slight bias toward early alphabet chars — harmless
  // here; ids only need to be unguessable, not uniformly distributed.
  return Array.from(bytes, b => ID_ALPHABET[b % ID_ALPHABET.length]).join('');
}

export type RecordingMeta = { id: string; createdAt: number; durationMs: number | null };

async function saveRecordingRow(encoded: string, durationMs?: number): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return null;
    const id = newRecordingId();
    const { error } = await supabase.from('recordings').insert({
      id,
      user_id: userId,
      data: encoded,
      created_at: Date.now(),
      duration_ms: durationMs ?? null,
    });
    return error ? null : id;
  } catch {
    return null;
  }
}

/** Stores the payload; resolves to the new short id, or null on any failure. */
export async function saveRecording(encoded: string): Promise<string | null> {
  return saveRecordingRow(encoded);
}

/** The caller's own recordings, newest first. [] on any failure. */
export async function listRecordings(): Promise<RecordingMeta[]> {
  if (!supabase) return [];
  try {
    const { data: s } = await supabase.auth.getSession();
    const userId = s.session?.user.id;
    if (!userId) return [];
    const { data, error } = await supabase
      .from('recordings')
      .select('id, created_at, duration_ms')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(r => ({ id: r.id, createdAt: r.created_at, durationMs: r.duration_ms ?? null }));
  } catch {
    return [];
  }
}

export async function deleteRecording(id: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data: s } = await supabase.auth.getSession();
    const userId = s.session?.user.id;
    if (!userId) return false;
    const { error } = await supabase.from('recordings').delete().eq('id', id).eq('user_id', userId);
    return !error;
  } catch {
    return false;
  }
}

/** Saves within the plan's slot cap: evicts oldest rows first (their share
 *  links die — the UI confirms before recording starts). Never exceeds the
 *  cap client-side; the 0006 trigger backstops server-side. */
export async function saveRecordingCapped(
  encoded: string,
  durationMs: number,
  cap: number,
): Promise<string | null> {
  if (!supabase) return null;
  if (Number.isFinite(cap)) {
    const held = await listRecordings();
    const evict = held.slice(cap - 1); // newest-first: keep cap-1, evict the rest
    for (const r of evict) {
      if (!(await deleteRecording(r.id))) return null; // never insert past cap
    }
  }
  return saveRecordingRow(encoded, durationMs);
}

/** Resolves to the stored payload, or null if unknown/unreachable. */
export async function fetchRecording(id: string): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('recordings')
      .select('data')
      .eq('id', id)
      .maybeSingle();
    return error || !data ? null : data.data;
  } catch {
    return null;
  }
}
