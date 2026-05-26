/**
 * Sync Queue Service
 * Handles syncing offline-queued replay sessions to the backend.
 */

import { getQueue, removeFromQueue } from "../utils/offlineQueue";
import type { ReplaySession } from "../utils/offlineQueue";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SyncResult {
  synced: number;
  failed: number;
}

// ── Sync Logic ───────────────────────────────────────────────────────────────

/**
 * Upload a single replay session to Firestore
 */
async function uploadReplaySession(session: ReplaySession): Promise<void> {
  const auth = getAuth();
  const userId = auth.currentUser?.uid;

  if (!userId) {
    throw new Error("User not authenticated");
  }

  const db = getFirestore();
  const replayRef = collection(db, "users", userId, "replaySessions");

  await addDoc(replayRef, {
    exerciseType: session.exerciseType,
    timestamp: session.timestamp,
    archive: JSON.stringify(session.archive),
    createdAt: serverTimestamp(),
  });
}

/**
 * Sync all queued offline replay sessions to the backend.
 * On success per session: removes it from the queue.
 * On failure: keeps it in the queue, logs the error, continues with remaining items.
 */
export async function syncOfflineQueue(): Promise<SyncResult> {
  const queue = getQueue();
  let synced = 0;
  let failed = 0;

  for (const session of queue) {
    try {
      await uploadReplaySession(session);
      removeFromQueue(session.id);
      synced++;
    } catch (error) {
      console.error(
        `[syncOfflineQueue] Failed to sync session ${session.id}:`,
        error,
      );
      failed++;
    }
  }

  return { synced, failed };
}
