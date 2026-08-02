import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveGhostSession,
  loadGhostSession,
  deleteGhostSession,
  clearGhostSessions,
  StoredGhostSession,
} from '../ghostStorage';
import { ghostService } from '../ghostService';
import { RLDCompressionDriver, FrameData, SessionArchive } from '../sessionRecorder';

function makeFrames(count: number): FrameData[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: 1000 + i * 500,
    landmarks: [
      { x: 0.1 + i * 0.01, y: 0.2, z: 0, visibility: 1 },
      { x: 0.3, y: 0.4, z: 0, visibility: 1 },
      { x: 0.5, y: 0.6, z: 0, visibility: 1 },
    ],
    angles: { knee: 90 + i, elbow: 160 - i },
    feedback: `ok${i}`,
    exercise: 'squat',
  }));
}

function makeArchive(frameCount: number): SessionArchive {
  return {
    codec: 'rld-delta-v1',
    frameCount,
    generatedAt: Date.now(),
    frames: RLDCompressionDriver.compress(makeFrames(frameCount)),
  };
}

function makeSession(exerciseKey: string, reps: number, accuracy: number): StoredGhostSession {
  return {
    exerciseKey,
    stats: { reps, accuracy, totalReps: reps + 2 },
    archive: makeArchive(10),
    updatedAt: Date.now(),
  };
}

describe('ghostStorage (IndexedDB driver)', () => {
  beforeEach(async () => {
    await clearGhostSessions();
  });

  it('saves and loads a ghost session roundtrip', async () => {
    await saveGhostSession(makeSession('squat', 10, 85));
    const loaded = await loadGhostSession('squat');
    expect(loaded).not.toBeNull();
    expect(loaded!.stats).toEqual({ reps: 10, accuracy: 85, totalReps: 12 });
    expect(loaded!.archive.frameCount).toBe(10);
    expect(loaded!.archive.frames.length).toBeGreaterThan(0);
  });

  it('returns null when no ghost exists for the key', async () => {
    expect(await loadGhostSession('pushup')).toBeNull();
  });

  it('overwrites the previous best for the same exercise key', async () => {
    await saveGhostSession(makeSession('squat', 10, 85));
    await saveGhostSession(makeSession('squat', 12, 90));
    const loaded = await loadGhostSession('squat');
    expect(loaded!.stats.reps).toBe(12);
    expect(await loadGhostSession('squat')).not.toBeNull();
  });

  it('keeps exercises isolated under their own keys', async () => {
    await saveGhostSession(makeSession('squat', 10, 85));
    await saveGhostSession(makeSession('plank', 5, 99));
    expect((await loadGhostSession('squat'))!.stats.reps).toBe(10);
    expect((await loadGhostSession('plank'))!.stats.reps).toBe(5);
  });

  it('deletes a single ghost session', async () => {
    await saveGhostSession(makeSession('squat', 10, 85));
    await deleteGhostSession('squat');
    expect(await loadGhostSession('squat')).toBeNull();
  });

  it('clears the whole ghost store', async () => {
    await saveGhostSession(makeSession('squat', 10, 85));
    await saveGhostSession(makeSession('plank', 5, 99));
    await clearGhostSessions();
    expect(await loadGhostSession('squat')).toBeNull();
    expect(await loadGhostSession('plank')).toBeNull();
  });
});

describe('GhostService over IndexedDB', () => {
  beforeEach(async () => {
    await clearGhostSessions();
  });

  it('saves a new best ghost and reloads decompressed frames', async () => {
    const archive = makeArchive(6);
    const saved = await ghostService.saveBestGhost('squat', { reps: 8, accuracy: 80, totalReps: 10 }, archive);
    expect(saved).toBe(true);

    const ghost = await ghostService.loadGhost('squat');
    expect(ghost).not.toBeNull();
    expect(ghost!.stats.reps).toBe(8);
    expect(ghost!.frames).toHaveLength(6);
    expect(ghost!.frames[0].exercise).toBe('squat');
  });

  it('rejects a worse session without overwriting the best', async () => {
    const better = await ghostService.saveBestGhost('squat', { reps: 10, accuracy: 90, totalReps: 12 }, makeArchive(4));
    expect(better).toBe(true);

    const worse = await ghostService.saveBestGhost('squat', { reps: 5, accuracy: 60, totalReps: 7 }, makeArchive(3));
    expect(worse).toBe(false);

    const ghost = await ghostService.loadGhost('squat');
    expect(ghost!.stats).toEqual({ reps: 10, accuracy: 90, totalReps: 12 });
    expect(ghost!.frames).toHaveLength(4);
  });

  it('keeps the higher-accuracy session when reps are equal', async () => {
    await ghostService.saveBestGhost('plank', { reps: 6, accuracy: 80, totalReps: 6 }, makeArchive(2));
    const replaced = await ghostService.saveBestGhost('plank', { reps: 6, accuracy: 92, totalReps: 6 }, makeArchive(5));
    expect(replaced).toBe(true);
    expect((await ghostService.loadGhost('plank'))!.stats.accuracy).toBe(92);
  });

  it('returns null when no ghost exists', async () => {
    expect(await ghostService.loadGhost('missing')).toBeNull();
  });

  it('getGhostFrameAtTime returns the closest frame', async () => {
    const frames = makeFrames(5); // timestamps 1000, 1500, ..., 3000
    const ghost = await (async () => {
      const archive = makeArchive(5);
      await ghostService.saveBestGhost('lunge', { reps: 4, accuracy: 70, totalReps: 4 }, archive);
      return ghostService.loadGhost('lunge');
    })();
    expect(ghost!.frames).toHaveLength(5);

    const f = ghostService.getGhostFrameAtTime(ghost!.frames, 2200);
    expect(f!.timestamp).toBe(3000); // closer to 3000 than 2000
  });
});
