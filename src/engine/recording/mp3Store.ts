// Local-only MP3 exports (owner decision, 2026-07-13 spec): blobs live in
// this device's IndexedDB, no auth or Supabase involved. Same degrade-to-
// null/empty error posture as recordingStore.ts — callers never see throws.

const DB_NAME = 'froola-mp3s';
const STORE = 'mp3s';

// bytes stored raw (not as a Blob) because Blob structured-clone support is
// unreliable (fake-indexeddb in tests; historically Safari in production).
type Mp3Row = { id: string; createdAt: number; durationMs: number; type: string; bytes: ArrayBuffer };
export type Mp3Meta = { id: string; createdAt: number; durationMs: number };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/** Stores the blob; resolves to the new id, or null on any failure. */
export async function saveMp3(blob: Blob, durationMs: number): Promise<string | null> {
  try {
    const id = crypto.randomUUID();
    const bytes = await blob.arrayBuffer();
    await withStore('readwrite', s =>
      s.put({ id, createdAt: Date.now(), durationMs, type: blob.type, bytes }),
    );
    return id;
  } catch {
    return null;
  }
}

/** Metadata for this device's mp3s, newest first. [] on any failure. */
export async function listMp3s(): Promise<Mp3Meta[]> {
  try {
    const rows = await withStore('readonly', s => s.getAll() as IDBRequest<Mp3Row[]>);
    return rows
      .map(({ id, createdAt, durationMs }) => ({ id, createdAt, durationMs }))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

/** Resolves to the stored blob, or null if unknown/unreachable. */
export async function getMp3Blob(id: string): Promise<Blob | null> {
  try {
    const row = await withStore('readonly', s => s.get(id) as IDBRequest<Mp3Row | undefined>);
    return row ? new Blob([row.bytes], { type: row.type }) : null;
  } catch {
    return null;
  }
}

export async function deleteMp3(id: string): Promise<boolean> {
  try {
    await withStore('readwrite', s => s.delete(id));
    return true;
  } catch {
    return false;
  }
}
