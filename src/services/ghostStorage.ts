import { SessionArchive } from './sessionRecorder';

/**
 * ghostStorage.ts
 *
 * IndexedDB storage driver for recorded training sessions (ghost replays).
 *
 * Recorded session archives are delta-compressed but a full workout can still
 * reach hundreds of KB to MBs once serialized. localStorage caps out around
 * 5 MB total for the whole origin, so an archive-heavy ghost session can throw
 * "QuotaExceededError" and silently discard the recording. IndexedDB lifts that
 * limit to a fraction of the disk, so unlimited session history files can be
 * recorded and replayed completely offline.
 */

export interface GhostStats {
  reps: number;
  accuracy: number;
  totalReps: number;
}

export interface StoredGhostSession {
  exerciseKey: string;
  stats: GhostStats;
  archive: SessionArchive;
  updatedAt: number;
}

const DB_NAME = 'spectrax_ghost_db';
const DB_VERSION = 1;
const STORE = 'ghost_sessions';

let dbPromise: Promise<IDBDatabase> | null = null;

export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openGhostDB(): Promise<IDBDatabase> {
  if (!isIndexedDBAvailable()) {
    return Promise.reject(new Error('IndexedDB is not available in this environment'));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          // keyPath exerciseKey → one ghost per exercise (the best session)
          db.createObjectStore(STORE, { keyPath: 'exerciseKey' });
        }
      };

      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        db.onclose = () => {
          dbPromise = null;
        };
        resolve(db);
      };

      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }

  return dbPromise;
}

/**
 * Persists a ghost session. Overwrites any previous best for that exercise.
 */
export async function saveGhostSession(session: StoredGhostSession): Promise<void> {
  const db = await openGhostDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(session);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Loads the stored ghost session for an exercise, or null when none exists.
 */
export async function loadGhostSession(
  exerciseKey: string,
): Promise<StoredGhostSession | null> {
  const db = await openGhostDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(exerciseKey);
    req.onsuccess = () => resolve((req.result as StoredGhostSession) || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Removes the stored ghost session for an exercise.
 */
export async function deleteGhostSession(exerciseKey: string): Promise<void> {
  const db = await openGhostDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(exerciseKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Wipes the entire ghost store (used in tests / user account reset).
 */
export async function clearGhostSessions(): Promise<void> {
  const db = await openGhostDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
