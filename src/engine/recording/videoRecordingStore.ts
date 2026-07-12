import { supabase } from '../../supabase';
import { newRecordingId } from './recordingStore';

// Stored video recordings (0005_video_recordings.sql): metadata row in
// public.video_recordings, the file itself in the public-but-unlisted
// 'recordings' storage bucket, shared via /watch?v=<id>. Everything degrades
// to null so callers can fall back to a plain local download when Supabase
// is unconfigured, the user is signed out, or the network fails.

export type VideoMime = 'video/mp4' | 'video/webm';

export interface VideoRecording {
  id: string;
  userId: string;
  mime: VideoMime;
  durationMs: number;
  sizeBytes: number;
  createdAt: number;
}

const BUCKET = 'recordings';

/** Mirrors public.video_object_path() in 0005 — keep the two in sync. */
export function objectPath(userId: string, id: string, mime: VideoMime): string {
  return `${userId}/${id}${mime === 'video/mp4' ? '.mp4' : '.webm'}`;
}

export function watchUrl(id: string): string {
  return `${window.location.origin}/watch?v=${id}`;
}

async function sessionUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** The signed-in user's recordings, newest first; null when unavailable. */
export async function listVideoRecordings(): Promise<VideoRecording[] | null> {
  if (!supabase) return null;
  try {
    if (!(await sessionUserId())) return null;
    const { data, error } = await supabase
      .from('video_recordings')
      .select('id, user_id, mime, duration_ms, size_bytes, created_at')
      .order('created_at', { ascending: false });
    if (error || !data) return null;
    return data.map(r => ({
      id: r.id as string,
      userId: r.user_id as string,
      mime: r.mime as VideoMime,
      durationMs: r.duration_ms as number,
      sizeBytes: r.size_bytes as number,
      createdAt: r.created_at as number,
    }));
  } catch {
    return null;
  }
}

/**
 * Persists a take: metadata row first (the quota trigger vets it, and the
 * storage upload policy requires the row to exist), then the file. A failed
 * upload rolls the row back so no dead share links are left behind.
 */
export async function saveVideoRecording(
  blob: Blob,
  mime: VideoMime,
  durationMs: number,
): Promise<VideoRecording | null> {
  if (!supabase) return null;
  try {
    const userId = await sessionUserId();
    if (!userId) return null;
    const rec: VideoRecording = {
      id: newRecordingId(),
      userId,
      mime,
      durationMs: Math.max(1, Math.round(durationMs)),
      sizeBytes: blob.size,
      createdAt: Date.now(),
    };
    const { error } = await supabase.from('video_recordings').insert({
      id: rec.id,
      user_id: rec.userId,
      mime: rec.mime,
      duration_ms: rec.durationMs,
      size_bytes: rec.sizeBytes,
      created_at: rec.createdAt,
    });
    if (error) return null;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath(userId, rec.id, mime), blob, { contentType: mime });
    if (uploadError) {
      await supabase.from('video_recordings').delete().eq('id', rec.id);
      return null;
    }
    return rec;
  } catch {
    return null;
  }
}

/** Deletes the file then the row; the share link dies with them. */
export async function deleteVideoRecording(rec: VideoRecording): Promise<boolean> {
  if (!supabase) return false;
  try {
    // Storage first: an orphaned file is a leak, an orphaned row is just a
    // broken link the owner can delete again.
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([objectPath(rec.userId, rec.id, rec.mime)]);
    if (storageError) return false;
    const { error } = await supabase.from('video_recordings').delete().eq('id', rec.id);
    return !error;
  } catch {
    return false;
  }
}

/** Public share lookup: playable URL + mime, or null if unknown/deleted. */
export async function fetchSharedVideo(
  id: string,
): Promise<{ url: string; mime: VideoMime } | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc('get_shared_video', { share_id: id });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) return null;
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(row.object_path as string);
    return { url: pub.publicUrl, mime: row.mime as VideoMime };
  } catch {
    return null;
  }
}
