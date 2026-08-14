import { supabase } from '../../supabase';
import { newRecordingId } from './recordingStore';
import {
  listLocalTakes,
  getLocalTake,
  putLocalTake,
  deleteLocalTake,
  type LocalTake,
} from './localVideoStore';

// One front door for stored takes, with two backends behind it.
//
// Local (the default, and what you get with no env file): the take lives in
// IndexedDB on this device. Nothing is uploaded, and a take is only playable in
// the browser that recorded it.
//
// Cloud (only when a Supabase project is configured AND someone is signed in):
// metadata row in public.video_recordings, file in the public-but-unlisted
// 'recordings' bucket, playable anywhere via /watch?v=<id>. See
// 0005_video_recordings.sql.
//
// `userId` is what tells the two apart: null means it never left this machine,
// which is why the UI offers a download there and a share link in the cloud.

export type VideoMime = 'video/mp4' | 'video/webm';

export interface VideoRecording {
  id: string;
  /** null for a local-only take. */
  userId: string | null;
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

/** Non-null only when there is both a Supabase project and a session. */
async function sessionUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

function fromLocal(take: LocalTake): VideoRecording {
  return {
    id: take.id,
    userId: null,
    mime: take.mime,
    durationMs: take.durationMs,
    sizeBytes: take.sizeBytes,
    createdAt: take.createdAt,
  };
}

/** True when this recording can be shared with someone else. */
export function isShareable(rec: VideoRecording): boolean {
  return rec.userId !== null;
}

/**
 * Stored takes, newest first. Local takes always come along: signing in later
 * shouldn't hide the recordings someone already made on this device.
 * Null means the cloud lookup failed, which is different from having none.
 */
export async function listVideoRecordings(): Promise<VideoRecording[] | null> {
  const local = (await listLocalTakes()).map(fromLocal);

  const userId = await sessionUserId();
  if (!userId || !supabase) return local;

  try {
    const { data, error } = await supabase
      .from('video_recordings')
      .select('id, user_id, mime, duration_ms, size_bytes, created_at')
      .order('created_at', { ascending: false });
    if (error || !data) return null;
    const remote: VideoRecording[] = data.map(r => ({
      id: r.id as string,
      userId: r.user_id as string,
      mime: r.mime as VideoMime,
      durationMs: r.duration_ms as number,
      sizeBytes: r.size_bytes as number,
      createdAt: r.created_at as number,
    }));
    return [...remote, ...local].sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return null;
  }
}

/**
 * Persists a take. Signed in, it goes to the cloud: metadata row first (the
 * storage upload policy requires the row to exist), then the file, rolling the
 * row back on a failed upload so no dead share links are left behind. Otherwise
 * it goes to IndexedDB. Null means neither worked and the caller should fall
 * back to a device download.
 */
export async function saveVideoRecording(
  blob: Blob,
  mime: VideoMime,
  durationMs: number,
): Promise<VideoRecording | null> {
  const id = newRecordingId();
  const durationRounded = Math.max(1, Math.round(durationMs));
  const createdAt = Date.now();

  const userId = await sessionUserId();
  if (!userId || !supabase) {
    const stored = await putLocalTake({
      id, mime, durationMs: durationRounded, sizeBytes: blob.size, createdAt, blob,
    });
    return stored
      ? { id, userId: null, mime, durationMs: durationRounded, sizeBytes: blob.size, createdAt }
      : null;
  }

  try {
    const rec: VideoRecording = {
      id, userId, mime, durationMs: durationRounded, sizeBytes: blob.size, createdAt,
    };
    const { error } = await supabase.from('video_recordings').insert({
      id: rec.id,
      user_id: userId,
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
  if (rec.userId === null) return deleteLocalTake(rec.id);
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

/** The playable file for a stored take, for download or offline playback. */
export async function localVideoBlob(id: string): Promise<Blob | null> {
  const take = await getLocalTake(id);
  return take?.blob ?? null;
}

/**
 * Resolves a /watch?v=<id> link. Local takes are checked first so the browser
 * that recorded one can always play it back, with or without a backend.
 */
export async function fetchSharedVideo(
  id: string,
): Promise<{ url: string; mime: VideoMime; local: boolean } | null> {
  const take = await getLocalTake(id);
  if (take) return { url: URL.createObjectURL(take.blob), mime: take.mime, local: true };

  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc('get_shared_video', { share_id: id });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) return null;
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(row.object_path as string);
    return { url: pub.publicUrl, mime: row.mime as VideoMime, local: false };
  } catch {
    return null;
  }
}
