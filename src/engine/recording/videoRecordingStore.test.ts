import { describe, it, expect } from 'vitest';
import { objectPath } from './videoRecordingStore';

describe('objectPath', () => {
  // Must stay byte-identical to public.video_object_path() in
  // 0005_video_recordings.sql — the storage upload policy compares the two.
  it('builds user-folder paths with the mime-matched extension', () => {
    const uid = 'a1b2c3d4-0000-0000-0000-000000000000';
    expect(objectPath(uid, 'AbC123xyZ9', 'video/mp4')).toBe(`${uid}/AbC123xyZ9.mp4`);
    expect(objectPath(uid, 'AbC123xyZ9', 'video/webm')).toBe(`${uid}/AbC123xyZ9.webm`);
  });
});
