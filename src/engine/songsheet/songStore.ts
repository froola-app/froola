import { supabase } from '../../supabase';
import type { SavedLoop } from '../looper';

// Persists "My Song" (Plus+ single saved project — pasted sheet + loops) to
// the public.songs table (0007_songs.sql). One row per user (user_id is the
// primary key), so save is always an upsert. All functions degrade to
// null/false when Supabase is unconfigured, the user is signed out, or the
// network fails.

export type MySong = {
  title: string
  sheetSource: string
  loops: SavedLoop[]
  updatedAt: number
}

export async function getMySong(): Promise<MySong | null> {
  if (!supabase) return null;
  try {
    const { data: s } = await supabase.auth.getSession();
    const userId = s.session?.user.id;
    if (!userId) return null;
    const { data, error } = await supabase
      .from('songs')
      .select('title, sheet_source, loops, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      title: data.title,
      sheetSource: data.sheet_source,
      loops: data.loops,
      updatedAt: data.updated_at,
    };
  } catch {
    return null;
  }
}

export async function saveMySong(song: Omit<MySong, 'updatedAt'>): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data: s } = await supabase.auth.getSession();
    const userId = s.session?.user.id;
    if (!userId) return false;
    const now = Date.now();
    const { error } = await supabase.from('songs').upsert({
      user_id: userId,
      title: song.title,
      sheet_source: song.sheetSource,
      loops: song.loops,
      // created_at is overwritten on every save (there's only one row per
      // user, no separate insert path), so it tracks "last full save", not
      // the original creation time.
      created_at: now,
      updated_at: now,
    }, { onConflict: 'user_id', ignoreDuplicates: false });
    return !error;
  } catch {
    return false;
  }
}

export async function deleteMySong(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data: s } = await supabase.auth.getSession();
    const userId = s.session?.user.id;
    if (!userId) return false;
    const { error } = await supabase.from('songs').delete().eq('user_id', userId);
    return !error;
  } catch {
    return false;
  }
}
