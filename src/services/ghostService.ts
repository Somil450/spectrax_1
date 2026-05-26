import { SessionArchive, RLDCompressionDriver, FrameData } from './sessionRecorder';

const GHOST_STORAGE_PREFIX = 'spectrax_ghost_';

export interface GhostStats {
  reps: number;
  accuracy: number;
  totalReps: number;
}

export class GhostService {
  /**
   * Attempts to save a session as the new ghost.
   * Only saves if the new session has more correct reps, or equal correct reps with better accuracy.
   */
  public saveBestGhost(
    exerciseKey: string,
    stats: { reps: number; accuracy: number; totalReps: number },
    archive: SessionArchive
  ): boolean {
    if (typeof window === 'undefined') return false;

    const statsKey = `${GHOST_STORAGE_PREFIX}${exerciseKey}_stats`;
    const archiveKey = `${GHOST_STORAGE_PREFIX}${exerciseKey}_archive`;

    try {
      const existingStatsStr = window.localStorage.getItem(statsKey);
      if (existingStatsStr) {
        const existingStats: GhostStats = JSON.parse(existingStatsStr);
        // Correct reps calculation
        const existingCorrectReps = existingStats.reps;
        const newCorrectReps = stats.reps;

        // Better if more correct reps, or same correct reps but higher accuracy
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
      console.warn("GhostService: Failed to save ghost session. Storage might be full.", error);
      return false;
    }
  }

  /**
   * Loads the ghost archive for the given exercise.
   */
  public loadGhost(exerciseKey: string): { stats: GhostStats; frames: FrameData[] } | null {
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

    // Binary search for the closest frame, or just a linear scan since it's fast 
    // and usually we're looking near the end. Let's do a simple binary search.
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
    // Let's just return the closest one
    if (high < 0) return frames[0];
    if (low >= frames.length) return frames[frames.length - 1];

    const diffHigh = targetTimestamp - frames[high].timestamp;
    const diffLow = frames[low].timestamp - targetTimestamp;

    return diffLow < diffHigh ? frames[low] : frames[high];
  }
}

export const ghostService = new GhostService();
