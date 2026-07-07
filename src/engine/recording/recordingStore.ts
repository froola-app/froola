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

/** Stores the payload; resolves to the new short id, or null on any failure. */
export async function saveRecording(encoded: string): Promise<string | null> {
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
    });
    return error ? null : id;
  } catch {
    return null;
  }
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
