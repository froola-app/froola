// Lesson and review progress for people running froola with no backend, which
// is the default. Both are small keyed maps, so localStorage is the right size
// of tool; the video takes are the ones that need IndexedDB.
//
// When someone does sign in, Supabase becomes the source of truth and these
// keys keep the copy that was made before the account existed. Reads merge the
// two, so signing in never looks like losing your progress.

const KEYS = {
  lesson: 'froola.lessonProgress',
  review: 'froola.reviewProgress',
} as const;

export type ProgressKind = keyof typeof KEYS;

export function readProgress<T>(kind: ProgressKind): Record<string, T> {
  try {
    const raw = localStorage.getItem(KEYS[kind]);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, T>;
  } catch {
    // Private mode, disabled storage, or someone else's malformed value.
    return {};
  }
}

export function writeProgress<T>(kind: ProgressKind, map: Record<string, T>): void {
  try {
    localStorage.setItem(KEYS[kind], JSON.stringify(map));
  } catch { /* storage full or unavailable; progress is best-effort */ }
}

/** Records one entry without disturbing the rest of the map. */
export function saveProgressEntry<T>(kind: ProgressKind, id: string, value: T): void {
  const map = readProgress<T>(kind);
  map[id] = value;
  writeProgress(kind, map);
}
