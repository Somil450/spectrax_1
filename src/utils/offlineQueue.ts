/**
 * Offline Queue Utility
 * Buffers replay sessions in localStorage when the device is offline.
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

// ── Constants ────────────────────────────────────────────────────────────────

const QUEUE_KEY = "spectrax_offline_replay_queue";

// ── Queue Operations ─────────────────────────────────────────────────────────

/**
 * Add a replay session to the offline queue
 */
export function enqueueSession(session: ReplaySession): void {
  const queue = getQueue();
  queue.push(session);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Get all pending replay sessions from the queue
 */
export function getQueue(): ReplaySession[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ReplaySession[];
  } catch {
    return [];
  }
}

/**
 * Clear the entire offline queue (after successful sync)
 */
export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

/**
 * Remove a single session from the queue by ID
 */
export function removeFromQueue(id: string): void {
  const queue = getQueue();
  const filtered = queue.filter((session) => session.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
}
