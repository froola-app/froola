import { supabase } from '../../supabase';

// Legacy gesture replays: the recorder is retired (recordings are video-only
// now — see videoRecordingStore.ts), but shared /replay?r=<id> links keep
// playing. Lookup goes through the get_shared_replay RPC (0005) so the table
// itself stays closed to anon SELECTs.

const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 10; // must match the format CHECKs in 0004/0005

/** Crypto-random base62 slug, shared with videoRecordingStore. */
export function newRecordingId(): string {
  const bytes = new Uint8Array(ID_LENGTH);
  crypto.getRandomValues(bytes);
  // 256 % 62 ≠ 0 gives a slight bias toward early alphabet chars — harmless
  // here; ids only need to be unguessable, not uniformly distributed.
  return Array.from(bytes, b => ID_ALPHABET[b % ID_ALPHABET.length]).join('');
}

/** Resolves to the stored payload, or null if unknown/unreachable. */
export async function fetchRecording(id: string): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc('get_shared_replay', { share_id: id });
    return error || !data ? null : (data as string);
  } catch {
    return null;
  }
}
