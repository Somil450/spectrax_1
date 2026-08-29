import { SessionArchive, RLDCompressionDriver, FrameData } from './sessionRecorder';
import {
  GhostStats,
  StoredGhostSession,
  saveGhostSession,
  loadGhostSession,
} from './ghostStorage';

export type { GhostStats } from './ghostStorage';

const GHOST_STORAGE_PREFIX = 'spectrax_ghost_';

export class GhostService {
  /**
   * Attempts to save a session as the new ghost.
   * Only saves if the new session has more correct reps, or equal correct reps with better accuracy.
   *
   * Sessions are persisted to IndexedDB (unlimited, offline) and fall back to
   * localStorage only when IndexedDB is unavailable (SSR / private browsing).
   */
  public async saveBestGhost(
    exerciseKey: string,
    stats: GhostStats,
    archive: SessionArchive
  ): Promise<boolean> {
    try {
      const existing = await loadGhostSession(exerciseKey);
      if (existing) {
        const existingCorrectReps = existing.stats.reps;
        const newCorrectReps = stats.reps;

        const isBetter =
          newCorrectReps > existingCorrectReps ||
          (newCorrectReps === existingCorrectReps && stats.accuracy > existing.stats.accuracy);

        if (!isBetter) {
          return false; // Not a new best
        }
      }

      const session: StoredGhostSession = {
        exerciseKey,
        stats,
        archive,
        updatedAt: Date.now(),
      };

      await saveGhostSession(session);
      return true;
    } catch (error) {
      // IndexedDB failed (unavailable, quota, private mode) — fall back.
      return this.saveBestGhostLegacy(exerciseKey, stats, archive, error);
    }
  }

  private saveBestGhostLegacy(
    exerciseKey: string,
    stats: GhostStats,
    archive: SessionArchive,
    cause: unknown
  ): boolean {
    if (typeof window === 'undefined') return false;

    const statsKey = `${GHOST_STORAGE_PREFIX}${exerciseKey}_stats`;
    const archiveKey = `${GHOST_STORAGE_PREFIX}${exerciseKey}_archive`;

    try {
      const existingStatsStr = window.localStorage.getItem(statsKey);
      if (existingStatsStr) {
        const existingStats: GhostStats = JSON.parse(existingStatsStr);
        const existingCorrectReps = existingStats.reps;
        const newCorrectReps = stats.reps;

        const isBetter =
          newCorrectReps > existingCorrectReps ||
          (newCorrectReps === existingCorrectReps && stats.accuracy > existingStats.accuracy);

        if (!isBetter) {
          return false; // Not a new best
        }
      }

      window.localStorage.setItem(statsKey, JSON.stringify(stats));
      window.localStorage.setItem(archiveKey, JSON.stringify(archive));
      return true;
    } catch (error) {
      console.warn("GhostService: Failed to save ghost session. Storage might be full.", error, cause);
      return false;
    }
  }

  /**
   * Loads the ghost archive for the given exercise. Prefers the IndexedDB copy
   * and falls back to legacy localStorage ghosts so previously recorded
   * sessions keep working after the migration.
   */
  public async loadGhost(
    exerciseKey: string
  ): Promise<{ stats: GhostStats; frames: FrameData[] } | null> {
    try {
      const stored = await loadGhostSession(exerciseKey);
      if (stored) {
        const frames = RLDCompressionDriver.decompress(stored.archive.frames);
        return { stats: stored.stats, frames };
      }
    } catch (error) {
      console.warn("GhostService: IndexedDB load failed, falling back to localStorage.", error);
    }

    return this.loadGhostLegacy(exerciseKey);
  }

  private loadGhostLegacy(
    exerciseKey: string
  ): { stats: GhostStats; frames: FrameData[] } | null {
    if (typeof window === 'undefined') return null;

    const statsKey = `${GHOST_STORAGE_PREFIX}${exerciseKey}_stats`;
    const archiveKey = `${GHOST_STORAGE_PREFIX}${exerciseKey}_archive`;

    try {
      const statsStr = window.localStorage.getItem(statsKey);
      const archiveStr = window.localStorage.getItem(archiveKey);

      if (!statsStr || !archiveStr) return null;

      const stats: GhostStats = JSON.parse(statsStr);
      const archive: SessionArchive = JSON.parse(archiveStr);

      // Pre-decompress all frames into memory for O(1) random access during the workout loop
      const frames = RLDCompressionDriver.decompress(archive.frames);

      return { stats, frames };
    } catch (error) {
      console.error("GhostService: Failed to load ghost session.", error);
      return null;
    }
  }

  /**
   * Given an array of decompressed frames and an elapsed time (ms),
   * returns the interpolated or closest frame.
   */
  public getGhostFrameAtTime(frames: FrameData[], elapsedMs: number): FrameData | null {
    if (!frames || frames.length === 0) return null;

    // Time-based lookup. The first frame's timestamp is the base.
    const baseTimestamp = frames[0].timestamp;
    const targetTimestamp = baseTimestamp + elapsedMs;

    // Binary search for the closest frame.
    let low = 0;
    let high = frames.length - 1;

    // If target is beyond the last frame, return the last frame (ghost is done)
    if (targetTimestamp >= frames[high].timestamp) {
      return frames[high];
    }

    // If target is before first frame (shouldn't happen), return first frame
    if (targetTimestamp <= baseTimestamp) {
      return frames[0];
    }

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const midTime = frames[mid].timestamp;

      if (midTime === targetTimestamp) {
        return frames[mid];
      } else if (midTime < targetTimestamp) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    // Now 'high' is the frame just before targetTimestamp, and 'low' is the frame just after
    if (high < 0) return frames[0];
    if (low >= frames.length) return frames[frames.length - 1];

    const diffHigh = targetTimestamp - frames[high].timestamp;
    const diffLow = frames[low].timestamp - targetTimestamp;

    return diffLow < diffHigh ? frames[low] : frames[high];
  }
}

export const ghostService = new GhostService();
