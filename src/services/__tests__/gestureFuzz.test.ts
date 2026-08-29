/**
 * gestureFuzz.test.ts
 *
 * Fuzzing for the gesture classifier (issue #961).
 *
 * Generates 1000 arbitrary landmark configurations (random positions,
 * visibilities, lengths) plus 1000 composed chaos configurations (random
 * gesture pose blended with random completeness, occlusion and noise) and
 * verifies the classifier's safety invariants:
 *   - never throws,
 *   - always returns a valid command (one of START/PAUSE/STOP) or null,
 *   - never returns an `undefined`/unexpected command string,
 *   - all confidence values stay within [0, 1],
 *   - identical seed → identical results (reproducibility).
 *
 * All randomness is seeded (see gestureChaosEngine.seededRandom).
 */

import { gestureService, GESTURE_BUFFER_SIZE } from '../gestureService';
import type { GestureCommand } from '../gestureService';
import {
  buildLandmarks,
  CHAOS_POSES,
  injectPartialGesture,
  injectOcclusion,
  injectNoise,
  randomOcclusionMask,
  seededRandom,
} from '../gestureChaosEngine';
import { isValidGestureCommand } from '../gestureTestOracle';

const COMMANDS: GestureCommand[] = ['START', 'PAUSE', 'STOP'];

function randBetween(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Fully arbitrary landmarks — the classifier must not crash on garbage. */
function arbitraryLandmarks(rng: () => number): unknown[] {
  return Array.from({ length: 33 }, () => ({
    x: randBetween(rng, 0, 1),
    y: randBetween(rng, 0, 1),
    z: randBetween(rng, 0, 0.5),
    visibility: rng() < 0.3 ? 0 : randBetween(rng, 0.4, 1),
  }));
}

/** Randomly-composed chaos configuration built from the engine primitives. */
function composedChaosLandmarks(rng: () => number): unknown[] {
  const gesture = COMMANDS[Math.floor(rng() * COMMANDS.length)];
  let lm = buildLandmarks(CHAOS_POSES[gesture]);
  if (rng() < 0.5) lm = injectPartialGesture(gesture, randBetween(rng, 0, 1));
  if (rng() < 0.4) lm = injectOcclusion(lm, randomOcclusionMask(rng, randBetween(rng, 0.1, 0.6)));
  if (rng() < 0.4) lm = injectNoise(lm, randBetween(rng, 0.005, 0.08), rng);
  return lm;
}

/** Drive a landmarks array until a command fires (or frames exhausted). */
function driveFuzz(landmarks: unknown[]): string | null {
  gestureService.reset();
  for (let i = 0; i < GESTURE_BUFFER_SIZE + 2; i++) {
    const cmd = gestureService.parseCommand(landmarks);
    if (cmd !== null) return cmd;
  }
  return null;
}

describe('Fuzz — arbitrary landmark configurations (1000 cases)', () => {
  it('never throws and always returns a valid command or null', () => {
    for (let i = 0; i < 1000; i++) {
      const rng = seededRandom(0xF022 + i);
      const lm = arbitraryLandmarks(rng);

      const cmd = gestureService.parseCommand(lm);
      expect(isValidGestureCommand(cmd)).toBe(true);
      expect(cmd).not.toBeUndefined();

      const result = gestureService.analyze(lm);
      expect(result.command).toBeNull();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      for (const conf of Object.values(result.gestureConfidences)) {
        expect(conf).toBeGreaterThanOrEqual(0);
        expect(conf).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('Fuzz — composed chaos configurations (1000 cases)', () => {
  it('never throws and never emits an invalid command', () => {
    for (let i = 0; i < 1000; i++) {
      const rng = seededRandom(0x0C4A + i);
      const cmd = driveFuzz(composedChaosLandmarks(rng));
      expect(isValidGestureCommand(cmd)).toBe(true);
      expect(cmd).not.toBeUndefined();
    }
  });
});

describe('Fuzz — truncated landmark arrays', () => {
  it('returns null / isPoseLost for arrays shorter than 33 entries', () => {
    for (let len = 0; len < 33; len++) {
      const lm = Array.from({ length: len }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
      expect(gestureService.parseCommand(lm)).toBeNull();
      const result = gestureService.analyze(lm);
      expect(result.isPoseLost).toBe(true);
      expect(result.command).toBeNull();
      expect(result.confidence).toBe(0);
    }
  });
});

describe('Fuzz — seeded reproducibility', () => {
  it('produces identical results for identical seeds', () => {
    const run = (): string[] => {
      const out: string[] = [];
      for (let i = 0; i < 200; i++) {
        const rng = seededRandom(0x51E + i);
        out.push(driveFuzz(composedChaosLandmarks(rng)));
      }
      return out;
    };
    expect(run()).toEqual(run());
  });
});
