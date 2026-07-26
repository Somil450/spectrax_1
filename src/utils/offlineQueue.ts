/**
 * Offline Queue Utility (IndexedDB-backed)
 * Buffers replay sessions in IndexedDB when the device is offline.
 * Sessions are queued for sync when connectivity returns.
 */

import type { SessionArchive } from "../services/sessionRecorder";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReplaySession {
  id: string;
  userId: string;
  exerciseType: string;
  timestamp: number;
  archive: SessionArchive;
}

// ── IndexedDB Constants ──────────────────────────────────────────────────────

const DB_NAME = "spectrax_offline_replays_db";
const DB_VERSION = 1;
const REPLAY_STORE = "offline_replays";

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(REPLAY_STORE)) {
        db.createObjectStore(REPLAY_STORE, { keyPath: "id" });
      }
    };

    req.onsuccess = (e) => {
      resolve((e.target as IDBOpenDBRequest).result);
    };

    req.onerror = (e) => {
      dbPromise = null;
      reject((e.target as IDBOpenDBRequest).error);
    };
  });

  return dbPromise;
}

// ── Queue Operations ─────────────────────────────────────────────────────────

/**
 * Add a replay session to the offline queue
 */
export async function enqueueSession(session: ReplaySession): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(REPLAY_STORE, "readwrite");
    const store = tx.objectStore(REPLAY_STORE);
    const req = store.put(session);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get all pending replay sessions from the queue
 */
export async function getQueue(): Promise<ReplaySession[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(REPLAY_STORE, "readonly");
      const store = tx.objectStore(REPLAY_STORE);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/**
 * Clear the entire offline queue (after successful sync)
 */
export async function clearQueue(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(REPLAY_STORE, "readwrite");
    const store = tx.objectStore(REPLAY_STORE);
    const req = store.clear();

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Remove a single session from the queue by ID
 */
export async function removeFromQueue(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(REPLAY_STORE, "readwrite");
    const store = tx.objectStore(REPLAY_STORE);
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
