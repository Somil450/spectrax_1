import type { Results } from '@mediapipe/pose';

/**
 * calibrationLogic.ts
 * Rules engine to determine if user position is correct for workout tracking.
 * Visual-element calculations (joint angles, movement range, thresholds) are
 * exposed as pure functions so they can be unit tested independently of the
 * component state that consumes them.
 */

export interface CalibrationResult {
  status: 'red' | 'yellow' | 'green';
  message: string;
  isReady: boolean;
  visibleCount: number;
  totalCount: number;
  adaptiveFactor: number;
}

// Joint triplets (vertex, arm) used to compute per-exercise joint angles.
// Shared between the calibration screen and the pure angle helpers.
export const CALIBRATION_JOINTS: Record<string, { a: number, b: number, c: number }> = {
  squat: { a: 23, b: 25, c: 27 },
  pushup: { a: 11, b: 13, c: 15 },
  bicepCurl: { a: 11, b: 13, c: 15 },
  lunge: { a: 23, b: 25, c: 27 },
  shoulderPress: { a: 11, b: 13, c: 15 },
};

// Key indices for full body tracking (shoulders, hips, knees, ankles).
export const CALIBRATION_REQUIRED_INDICES = [11, 12, 23, 24, 25, 26, 27, 28];

/**
 * Pure 3D joint-angle calculation (in degrees) between three landmarks.
 * Returns 0 when any landmark is missing or the vectors are degenerate.
 */
export function calculateJointAngle(
  landmarks: any[],
  aIdx: number,
  bIdx: number,
  cIdx: number
): number {
  const a = landmarks[aIdx];
  const b = landmarks[bIdx];
  const c = landmarks[cIdx];
  if (!a || !b || !c) return 0;
  const ab = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const cb = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z;
  const magAB = Math.sqrt(ab.x * ab.x + ab.y * ab.y + ab.z * ab.z);
  const magCB = Math.sqrt(cb.x * cb.x + cb.y * cb.y + cb.z * cb.z);
  if (magAB < 1e-6 || magCB < 1e-6) return 0;
  const cos = dot / (magAB * magCB);
  return Math.acos(Math.max(-1, Math.min(1, cos))) * (180 / Math.PI);
}

/**
 * Pure range-of-motion tracker. Ignores angles outside the 5–179° window
 * (mirror/mirrored degenerate readings) and returns the tightened bounds.
 */
export function trackMovementRange(
  currentAngle: number,
  minAngle: number,
  maxAngle: number
): { minAngle: number; maxAngle: number } {
  if (currentAngle <= 5 || currentAngle >= 179) {
    return { minAngle, maxAngle };
  }
  return {
    minAngle: Math.min(minAngle, currentAngle),
    maxAngle: Math.max(maxAngle, currentAngle),
  };
}

/**
 * Pure dynamic-threshold computation. When the measured range is meaningful
 * (>10°), targets the deepest 10% of the range; otherwise falls back to the
 * exercise's configured downThreshold.
 */
export function computeCalibrationThreshold(
  minAngle: number,
  maxAngle: number,
  fallbackThreshold: number
): number {
  const range = maxAngle - minAngle;
  return range > 10 ? Math.round(maxAngle - range * 0.9) : fallbackThreshold;
}

/**
 * Pure calibration-profile builder. Produces the exact object persisted in
 * settings.calibrationProfile for the given exercise.
 */
export function buildCalibrationProfile(
  exerciseKey: string,
  minAngle: number,
  maxAngle: number,
  fallbackThreshold: number
): Record<string, { minAngle: number; maxAngle: number; calibratedThreshold: number }> {
  return {
    [exerciseKey]: {
      minAngle: Math.round(minAngle),
      maxAngle: Math.round(maxAngle),
      calibratedThreshold: computeCalibrationThreshold(minAngle, maxAngle, fallbackThreshold),
    },
  };
}

export class CalibrationLogic {
  private readonly visibilityThreshold = 0.5;

  /**
   * Processes current pose results and returns a calibration status.
   * @param adaptiveFactor - Body-type calibration factor (0.9–1.1) from bodyTypeEngine, applied to thresholds.
   */
  evaluate(results: Results, adaptiveFactor: number = 1.0): CalibrationResult {
    if (!results.poseLandmarks) {
      return {
        status: 'red',
        message: 'No body detected. Step into frame.',
        isReady: false,
        visibleCount: 0,
        totalCount: CALIBRATION_REQUIRED_INDICES.length,
        adaptiveFactor
      };
    }

    const landmarks = results.poseLandmarks;
    const visibleCount = CALIBRATION_REQUIRED_INDICES.filter(i => landmarks[i] && (landmarks[i].visibility || 0) > this.visibilityThreshold).length;

    // Check if full body is in frame
    if (visibleCount < 4) {
      return {
        status: 'red',
        message: 'Step back. Full body must be visible.',
        isReady: false,
        visibleCount,
        totalCount: CALIBRATION_REQUIRED_INDICES.length,
        adaptiveFactor
      };
    }

    if (visibleCount < 8) {
      return {
        status: 'yellow',
        message: 'Adjust position. Ankles or knees not clear.',
        isReady: false,
        visibleCount,
        totalCount: CALIBRATION_REQUIRED_INDICES.length,
        adaptiveFactor
      };
    }

    // Check centering (shoulders horizontal center)
    const midShoulderX = (landmarks[11].x + landmarks[12].x) / 2;
    if (midShoulderX < 0.2 || midShoulderX > 0.8) {
      return {
        status: 'yellow',
        message: 'Center your body in the frame.',
        isReady: false,
        visibleCount,
        totalCount: CALIBRATION_REQUIRED_INDICES.length,
        adaptiveFactor
      };
    }

    // High confidence + full body — include the adaptive factor
    return {
      status: 'green',
      message: 'Good position. Calibration complete.',
      isReady: true,
      visibleCount,
      totalCount: CALIBRATION_REQUIRED_INDICES.length,
      adaptiveFactor
    };
  }
}

export const calibrationLogic = new CalibrationLogic();
