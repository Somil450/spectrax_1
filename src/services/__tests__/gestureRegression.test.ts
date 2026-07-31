/**
 * gestureRegression.test.ts
 *
 * Regression suite for the gesture classifier (issue #961).
 *
 * Captures concrete failure modes surfaced by the chaos suites as fixed
 * behavioural contracts:
 *   - a partially-formed STOP must never terminate a workout,
 *   - an early (half-raised) START must not fire,
 *   - occluded hands must not produce commands,
 *   - gentle sensor noise must not flip one gesture into another,
 *   - a START→STOP hand motion must never be read as PAUSE,
 *   - clean poses and the thumbs-up alias keep working.
 *
 * If any of these regress, a workout can be accidentally terminated or
 * paused — the exact outages chaos testing is meant to prevent.
 */

import { gestureService, GESTURE_BUFFER_SIZE } from '../gestureService';
import type { GestureCommand } from '../gestureService';
import {
  CHAOS_POSES,
  buildLandmarks,
  thumbsUpPose,
  injectPartialGesture,
  injectOcclusion,
  injectNoise,
  injectTransitionGesture,
  fullHandOcclusionMask,
  seededRandom,
} from '../gestureChaosEngine';
import {
  isAllowedCommandForTransition,
  isValidGestureCommand,
} from '../gestureTestOracle';

/** Drive a fixed landmarks array, return the first command that fires. */
function drive(landmarks: unknown[]): string | null {
  gestureService.reset();
  for (let i = 0; i < GESTURE_BUFFER_SIZE + 2; i++) {
    const cmd = gestureService.parseCommand(landmarks);
    if (cmd !== null) return cmd;
  }
  return null;
}

describe('Regression — clean gestures still classify', () => {
  it('fires START / PAUSE / STOP for their full poses', () => {
    expect(drive(buildLandmarks(CHAOS_POSES.START))).toBe('START');
    expect(drive(buildLandmarks(CHAOS_POSES.PAUSE))).toBe('PAUSE');
    expect(drive(buildLandmarks(CHAOS_POSES.STOP))).toBe('STOP');
  });

  it('fires START for the thumbs-up alias', () => {
    expect(drive(buildLandmarks(thumbsUpPose()))).toBe('START');
  });
});

describe('Regression — buffer semantics (fix from chaos suite)', () => {
  it('a single PAUSE-positive frame must not fire (buffer must fill)', () => {
    gestureService.reset();
    expect(gestureService.parseCommand(buildLandmarks(CHAOS_POSES.PAUSE))).toBeNull();
    for (let i = 0; i < GESTURE_BUFFER_SIZE; i++) {
      expect(gestureService.parseCommand(buildLandmarks(CHAOS_POSES.NEUTRAL))).toBeNull();
    }
  });

  it('fires exactly when 9 of 12 buffer frames are positive', () => {
    const positive = buildLandmarks(CHAOS_POSES.START);
    const neutral = buildLandmarks(CHAOS_POSES.NEUTRAL);

    gestureService.reset();
    let cmd: string | null = null;
    for (let i = 0; i < GESTURE_BUFFER_SIZE; i++) {
      cmd = gestureService.parseCommand(i < 9 ? positive : neutral);
    }
    expect(cmd).toBe('START');

    gestureService.reset();
    cmd = null;
    for (let i = 0; i < GESTURE_BUFFER_SIZE; i++) {
      cmd = gestureService.parseCommand(i < 8 ? positive : neutral);
    }
    expect(cmd).toBeNull();
  });
});

describe('Regression — partial gestures', () => {
  it('a 15% STOP (barely crossed wrists) must not fire', () => {
    expect(drive(injectPartialGesture('STOP', 0.15))).toBeNull();
  });

  it('a 50% START (wrists mid-rise) must not fire', () => {
    expect(drive(injectPartialGesture('START', 0.5))).toBeNull();
  });

  it('a 50% PAUSE (single wrist mid-rise) must not fire', () => {
    expect(drive(injectPartialGesture('PAUSE', 0.5))).toBeNull();
  });

  it('a fully-formed gesture always fires its canonical command', () => {
    expect(drive(injectPartialGesture('START', 1.0))).toBe('START');
    expect(drive(injectPartialGesture('PAUSE', 1.0))).toBe('PAUSE');
    expect(drive(injectPartialGesture('STOP', 1.0))).toBe('STOP');
  });
});

describe('Regression — occlusion', () => {
  it('hands fully hidden behind the body must never fire a command', () => {
    for (const gesture of Object.keys(CHAOS_POSES) as GestureCommand[]) {
      const occluded = injectOcclusion(buildLandmarks(CHAOS_POSES[gesture]), fullHandOcclusionMask());
      expect(drive(occluded)).toBeNull();
    }
  });

  it('non-critical occlusion (elbows hidden) does not break START', () => {
    const mask = Array.from({ length: 33 }, () => false);
    mask[13] = true;
    mask[14] = true;
    const occluded = injectOcclusion(buildLandmarks(CHAOS_POSES.START), mask);
    expect(drive(occluded)).toBe('START');
  });
});

describe('Regression — sensor noise must not flip gestures', () => {
  it('a noisy START is never read as STOP or PAUSE', () => {
    for (let i = 0; i < 200; i++) {
      const rng = seededRandom(0x7A1 + i);
      const noisy = injectNoise(buildLandmarks(CHAOS_POSES.START), 0.02, rng);
      expect(drive(noisy)).not.toBe('STOP');
      expect(drive(noisy)).not.toBe('PAUSE');
    }
  });

  it('a noisy STOP is never read as START or PAUSE', () => {
    for (let i = 0; i < 200; i++) {
      const rng = seededRandom(0x5EED + i);
      const noisy = injectNoise(buildLandmarks(CHAOS_POSES.STOP), 0.02, rng);
      expect(drive(noisy)).not.toBe('START');
      expect(drive(noisy)).not.toBe('PAUSE');
    }
  });

  it('thumbs-up still fires START under gentle noise', () => {
    const rng = seededRandom(0x7B00);
    const noisy = injectNoise(buildLandmarks(thumbsUpPose()), 0.01, rng);
    expect(drive(noisy)).toBe('START');
  });
});

describe('Regression — transitions must never fire the third command', () => {
  it('a START→STOP hand motion is never read as PAUSE', () => {
    for (let s = 0; s <= 20; s++) {
      const lm = injectTransitionGesture('START', 'STOP', s / 20);
      const cmd = drive(lm);
      expect(isAllowedCommandForTransition(cmd, 'START', 'STOP')).toBe(true);
      expect(cmd).not.toBe('PAUSE');
    }
  });

  it('a STOP→START hand motion is never read as PAUSE', () => {
    for (let s = 0; s <= 20; s++) {
      const lm = injectTransitionGesture('STOP', 'START', s / 20);
      const cmd = drive(lm);
      expect(isAllowedCommandForTransition(cmd, 'STOP', 'START')).toBe(true);
      expect(cmd).not.toBe('PAUSE');
    }
  });
});

describe('Regression — command validity', () => {
  it('never returns an unexpected command string', () => {
    for (let i = 0; i < 500; i++) {
      const rng = seededRandom(0x0E + i);
      const lm = injectNoise(injectPartialGesture('STOP', 0.5), 0.03, rng);
      expect(isValidGestureCommand(drive(lm))).toBe(true);
    }
  });
});
