// Recordings for people running froola with no backend, which is the default:
// the take lives in IndexedDB on this device, keyed by the same slug the cloud
// store uses, so /watch?v=<id> resolves locally in the browser that made it.
// Nothing here talks to the network.
//
// IndexedDB rather than localStorage because a take is a multi-megabyte Blob.
// Every call degrades to a null / false / empty result when IndexedDB is
// missing (jsdom, private-mode quirks) so callers never have to special-case it.

import type { VideoMime } from './videoRecordingStore';

const DB_NAME = 'froola';
const DB_VERSION = 1;
const STORE = 'video-takes';

export interface LocalTake {
  id: string;
  mime: VideoMime;
  durationMs: number;
  sizeBytes: number;
  createdAt: number;
  blob: Blob;
}

function available(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase | null> {
  if (!available()) return Promise.resolve(null);
  return new Promise(resolve => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return openDb().then(db => {
    if (!db) return null;
    return new Promise<T | null>(resolve => {
      let req: IDBRequest<T>;
      try {
        req = work(db.transaction(STORE, mode).objectStore(STORE));
      } catch {
        db.close();
        resolve(null);
        return;
      }
      req.onsuccess = () => { db.close(); resolve(req.result); };
      req.onerror = () => { db.close(); resolve(null); };
    });
  });
}

/** Every take on this device, newest first. */
export async function listLocalTakes(): Promise<LocalTake[]> {
  const all = await run<LocalTake[]>('readonly', s => s.getAll() as IDBRequest<LocalTake[]>);
  return (all ?? []).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getLocalTake(id: string): Promise<LocalTake | null> {
  const take = await run<LocalTake | undefined>(
    'readonly',
    s => s.get(id) as IDBRequest<LocalTake | undefined>,
  );
  return take ?? null;
}

/** Returns false when IndexedDB is unavailable, so callers can fall back to a
    plain device download rather than silently dropping the take. */
export async function putLocalTake(take: LocalTake): Promise<boolean> {
  const key = await run<IDBValidKey>('readwrite', s => s.put(take) as IDBRequest<IDBValidKey>);
  return key != null;
}

export async function deleteLocalTake(id: string): Promise<boolean> {
  if (!available()) return false;
  const done = await run<undefined>('readwrite', s => s.delete(id) as IDBRequest<undefined>);
  return done === undefined;
}
