import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  objectPath,
  isShareable,
  listVideoRecordings,
  saveVideoRecording,
  deleteVideoRecording,
  localVideoBlob,
  fetchSharedVideo,
} from './videoRecordingStore';
import { listLocalTakes, deleteLocalTake } from './localVideoStore';

// No Supabase project configured is the default way froola runs, so these
// exercise the local branch of every function.
vi.mock('../../supabase', () => ({ supabase: null, supabaseConfigured: false }));

function blob() {
  return new Blob(['not-really-a-video'], { type: 'video/webm' });
}

beforeEach(async () => {
  for (const t of await listLocalTakes()) await deleteLocalTake(t.id);
});

describe('objectPath', () => {
  // Must stay byte-identical to public.video_object_path() in
  // 0005_video_recordings.sql — the storage upload policy compares the two.
  it('builds user-folder paths with the mime-matched extension', () => {
    const uid = 'a1b2c3d4-0000-0000-0000-000000000000';
    expect(objectPath(uid, 'AbC123xyZ9', 'video/mp4')).toBe(`${uid}/AbC123xyZ9.mp4`);
    expect(objectPath(uid, 'AbC123xyZ9', 'video/webm')).toBe(`${uid}/AbC123xyZ9.webm`);
  });
});

describe('recordings with no backend', () => {
  it('starts empty rather than failing', async () => {
    expect(await listVideoRecordings()).toEqual([]);
  });

  it('saves a take locally and marks it unshareable', async () => {
    const rec = await saveVideoRecording(blob(), 'video/webm', 4_200);
    expect(rec).not.toBeNull();
    expect(rec!.userId).toBeNull();
    expect(rec!.durationMs).toBe(4_200);
    expect(isShareable(rec!)).toBe(false);
  });

  it('lists what it saved, newest first, with no cap', async () => {
    for (let i = 0; i < 4; i++) await saveVideoRecording(blob(), 'video/webm', 1_000 + i);

    const list = await listVideoRecordings();
    expect(list).toHaveLength(4);
    const times = list!.map(r => r.createdAt);
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it('hands back the stored file for download', async () => {
    const rec = await saveVideoRecording(blob(), 'video/webm', 1_000);
    expect(await localVideoBlob(rec!.id)).not.toBeNull();
  });

  it('deletes a local take', async () => {
    const rec = await saveVideoRecording(blob(), 'video/webm', 1_000);
    expect(await deleteVideoRecording(rec!)).toBe(true);
    expect(await listVideoRecordings()).toEqual([]);
  });

  it('resolves a /watch link for a take made in this browser', async () => {
    // fake-indexeddb's structured clone hands back a plain object, which the
    // real createObjectURL rejects; the store's job here is finding the take.
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local');

    const rec = await saveVideoRecording(blob(), 'video/webm', 1_000);
    const shared = await fetchSharedVideo(rec!.id);
    expect(shared?.local).toBe(true);
    expect(shared?.mime).toBe('video/webm');
    expect(shared?.url).toBe('blob:local');
  });

  it('returns nothing for a link it has never seen', async () => {
    expect(await fetchSharedVideo('someone-elses-id')).toBeNull();
  });
});
