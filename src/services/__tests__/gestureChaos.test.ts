/**
 * gestureChaos.test.ts
 *
 * Chaos-engineering test suite for the gesture classifier (issue #961).
 *
 * 1000 randomized cases per confusion category:
 *   1. Partial gestures   — completeness 0.1–0.9 (arms mid-motion)
 *   2. Multi-gesture      — two gesture poses blended (two actors / confusion)
 *   3. Transitions        — linear interp between the 6 directed pose pairs
 *   4. Occlusion          — random 10–50% of hand landmarks hidden
 *   5. Noise              — Gaussian jitter σ = 0.01–0.1 on every joint
 *
 * Every case is validated against the oracle in gestureTestOracle.ts:
 *   - "allowed set" check: a confusion input must never produce the WRONG
 *     command (e.g. a partial START being read as STOP).
 *   - "F1 gate" check: unambiguous inputs (full poses, clearly sub-threshold
 *     poses, fully-occluded hands) are scored and must reach F1 >= 0.95,
 *     the same gate the chaos.yml workflow enforces.
 *
 * All randomness is seeded, so the suite is fully reproducible.
 */

import { gestureService, GESTURE_BUFFER_SIZE } from '../gestureService';
import type { GestureCommand } from '../gestureService';
import {
  CHAOS_POSES,
  buildLandmarks,
  injectPartialGesture,
  injectMultiGesture,
  injectTransitionGesture,
  injectOcclusion,
  injectNoise,
  randomHandOcclusionMask,
  seededRandom,
} from '../gestureChaosEngine';
import {
  evaluateChaosCases,
  canonicalCommandFor,
  isAllowedCommandForPose,
  isAllowedCommandForTransition,
  isAllowedCommandForChaoticPose,
  CHAOS_F1_GATE,
} from '../gestureTestOracle';
import type { ChaosCase } from '../gestureTestOracle';

const COMMANDS: GestureCommand[] = ['START', 'PAUSE', 'STOP'];

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randBetween(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Drive a fixed landmarks array, return the first command that fires. */
function driveChaos(landmarks: unknown[]): string | null {
  gestureService.reset();
  for (let i = 0; i < GESTURE_BUFFER_SIZE + 2; i++) {
    const cmd = gestureService.parseCommand(landmarks);
    if (cmd !== null) return cmd;
  }
  return null;
}

/** Drive a fresh landmarks array every frame (temporal noise simulation). */
function driveChaosDynamic(factory: () => unknown[]): string | null {
  gestureService.reset();
  for (let i = 0; i < GESTURE_BUFFER_SIZE + 2; i++) {
    const cmd = gestureService.parseCommand(factory());
    if (cmd !== null) return cmd;
  }
  return null;
}

/** Sweep a from→to transition, collecting every command fired along the way. */
function sweepTransition(from: GestureCommand, to: GestureCommand): string[] {
  const fired: string[] = [];
  const steps = 21;
  for (let s = 0; s < steps; s++) {
    const cmd = driveChaos(injectTransitionGesture(from, to, s / (steps - 1)));
    if (cmd !== null) fired.push(cmd);
  }
  return fired;
}

const SEED_BASE = 0x961;

describe('Chaos — partial gestures (1000 cases)', () => {
  it('never fires the wrong command and passes the F1 gate', () => {
    const f1Cases: ChaosCase[] = [];
    let fired = 0;
    let silent = 0;

    for (let i = 0; i < 1000; i++) {
      const rng = seededRandom(SEED_BASE + i);
      const gesture = pick(rng, COMMANDS);
      const completeness = randBetween(rng, 0.1, 0.9);

      const cmd = driveChaos(injectPartialGesture(gesture, completeness));

      expect(isAllowedCommandForPose(cmd, gesture)).toBe(true);
      if (cmd === null) silent += 1;
      else fired += 1;

      if (completeness < 0.2) f1Cases.push({ actual: cmd, target: null });
      else if (completeness >= 0.8) f1Cases.push({ actual: cmd, target: canonicalCommandFor(gesture) });
    }

    expect(fired).toBeGreaterThan(0);
    expect(silent).toBeGreaterThan(0);

    const m = evaluateChaosCases(f1Cases);
    expect(m.f1).toBeGreaterThanOrEqual(CHAOS_F1_GATE);
  });
});

describe('Chaos — multi-gesture blends (1000 cases)', () => {
  it('stays inside the union of the two blended gestures', () => {
    for (let i = 0; i < 1000; i++) {
      const rng = seededRandom(SEED_BASE + 10_000 + i);
      const a = pick(rng, COMMANDS);
      const b = pick(rng, COMMANDS);
      const overlap = randBetween(rng, 0.1, 0.9);

      const cmd = driveChaos(injectMultiGesture(a, b, overlap));
      const allowed = cmd === null || cmd === a || cmd === b;
      expect(allowed).toBe(true);
    }
  });
});

describe('Chaos — gesture transitions (1000 cases)', () => {
  it('covers all 6 directed pairs and never fires the third command', () => {
    const pairCount: Record<string, number> = {};
    for (const from of COMMANDS) {
      for (const to of COMMANDS) {
        if (from !== to) pairCount[`${from}->${to}`] = 0;
      }
    }

    for (let i = 0; i < 1000; i++) {
      const rng = seededRandom(SEED_BASE + 20_000 + i);
      const from = pick(rng, COMMANDS);
      let to = pick(rng, COMMANDS);
      while (to === from) to = pick(rng, COMMANDS);
      pairCount[`${from}->${to}`] += 1;

      const fired = sweepTransition(from, to);
      for (const cmd of fired) {
        expect(isAllowedCommandForTransition(cmd, from, to)).toBe(true);
      }
    }

    for (const count of Object.values(pairCount)) {
      expect(count).toBeGreaterThan(50);
    }
  });
});

describe('Chaos — occlusion (1000 cases)', () => {
  it('never fires when both wrists are hidden and keeps F1 at the gate', () => {
    const f1Cases: ChaosCase[] = [];

    for (let i = 0; i < 1000; i++) {
      const rng = seededRandom(SEED_BASE + 30_000 + i);
      const gesture = pick(rng, COMMANDS);
      const fraction = randBetween(rng, 0.1, 0.5);

      const mask = randomHandOcclusionMask(rng, fraction);
      const base = buildLandmarks(CHAOS_POSES[gesture]);
      const cmd = driveChaos(injectOcclusion(base, mask));

      const leftWristHidden = mask[15];
      const rightWristHidden = mask[16];

      expect(isAllowedCommandForChaoticPose(cmd, gesture)).toBe(true);

      if (leftWristHidden && rightWristHidden) {
        expect(cmd).toBeNull();
        f1Cases.push({ actual: cmd, target: null });
      } else if (!leftWristHidden && !rightWristHidden) {
        f1Cases.push({ actual: cmd, target: canonicalCommandFor(gesture) });
      }
    }

    const m = evaluateChaosCases(f1Cases);
    expect(m.f1).toBeGreaterThanOrEqual(CHAOS_F1_GATE);
  });
});

describe('Chaos — sensor noise (1000 cases)', () => {
  it('stays robust under low noise and never fires the wrong command', () => {
    const f1Cases: ChaosCase[] = [];
    let fired = 0;
    let silent = 0;

    for (let i = 0; i < 1000; i++) {
      const rng = seededRandom(SEED_BASE + 40_000 + i);
      const gesture = pick(rng, COMMANDS);
      const sigma = randBetween(rng, 0.01, 0.1);

      const base = buildLandmarks(CHAOS_POSES[gesture]);
      const cmd = driveChaosDynamic(() => injectNoise(base, sigma, rng));

      expect(isAllowedCommandForChaoticPose(cmd, gesture)).toBe(true);
      if (cmd === null) silent += 1;
      else fired += 1;

      // Only gentle jitter has an unambiguous expectation: the pose fires.
      if (sigma <= 0.02) {
        f1Cases.push({ actual: cmd, target: canonicalCommandFor(gesture) });
      }
    }

    expect(fired).toBeGreaterThan(0);
    expect(silent).toBeGreaterThan(0);

    const m = evaluateChaosCases(f1Cases);
    expect(m.f1).toBeGreaterThanOrEqual(CHAOS_F1_GATE);
  });
});

describe('Chaos — overall F1 gate', () => {
  it('aggregates every unambiguous chaos case and meets the CI gate', () => {
    const f1Cases: ChaosCase[] = [];

    // Full, clean poses must always fire their canonical command.
    for (const gesture of COMMANDS) {
      for (let i = 0; i < 300; i++) {
        const cmd = driveChaos(buildLandmarks(CHAOS_POSES[gesture]));
        f1Cases.push({ actual: cmd, target: canonicalCommandFor(gesture) });
      }
    }

    // Clearly sub-threshold inputs must never fire.
    for (const gesture of COMMANDS) {
      for (let i = 0; i < 300; i++) {
        const cmd = driveChaos(injectPartialGesture(gesture, 0.05));
        f1Cases.push({ actual: cmd, target: null });
      }
    }

    const m = evaluateChaosCases(f1Cases);
    console.info(`[chaos] total=${m.total} TP=${m.truePositive} TN=${m.trueNegative} FP=${m.falsePositive} FN=${m.falseNegative} precision=${m.precision.toFixed(3)} recall=${m.recall.toFixed(3)} F1=${m.f1.toFixed(3)}`);
    expect(m.f1).toBeGreaterThanOrEqual(CHAOS_F1_GATE);
  });
});
