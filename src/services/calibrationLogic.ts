import type { Results } from '@mediapipe/pose';
import { computeAdaptiveFactor } from './bodyTypeEngine';

/**
 * calibrationLogic.ts
 * Rules engine to determine if user position is correct for workout tracking.
 */

export interface CalibrationResult {
  status: 'red' | 'yellow' | 'green';
  message: string;
  isReady: boolean;
  visibleCount: number;
  totalCount: number;
  adaptiveFactor: number;
  torsoToFemur?: number;
}

export class CalibrationLogic {
  private readonly visibilityThreshold = 0.5;

  /**
   * Processes current pose results and returns a calibration status.
   * @param adaptiveFactor - Body-type calibration factor (0.9–1.1) from bodyTypeEngine, applied to thresholds.
   * @param torsoToFemur - Measured torso-to-femur bone ratio used to derive a live
   *   ±10% adaptive factor during the calibration phase (overrides `adaptiveFactor`).
   */
  evaluate(
    results: Results,
    adaptiveFactor: number = 1.0,
    torsoToFemur?: number,
  ): CalibrationResult {
    if (torsoToFemur !== undefined && Number.isFinite(torsoToFemur) && torsoToFemur > 0) {
      adaptiveFactor = computeAdaptiveFactor(torsoToFemur);
    }

    if (!results.poseLandmarks) {
      return {
        status: 'red',
        message: 'No body detected. Step into frame.',
        isReady: false,
        visibleCount: 0,
        totalCount: 8,
        adaptiveFactor,
        torsoToFemur
      };
    }

    const landmarks = results.poseLandmarks;

    // Key indices for full body tracking
    // 11, 12 (shoulders), 23, 24 (hips), 25, 26 (knees), 27, 28 (ankles)
    const requiredIndices = [11, 12, 23, 24, 25, 26, 27, 28];
    const visibleCount = requiredIndices.filter(i => landmarks[i] && (landmarks[i].visibility || 0) > this.visibilityThreshold).length;

    // Check if full body is in frame
    if (visibleCount < 4) {
      return {
        status: 'red',
        message: 'Step back. Full body must be visible.',
        isReady: false,
        visibleCount,
        totalCount: requiredIndices.length,
        adaptiveFactor,
        torsoToFemur
      };
    }

    if (visibleCount < 8) {
      return {
        status: 'yellow',
        message: 'Adjust position. Ankles or knees not clear.',
        isReady: false,
        visibleCount,
        totalCount: requiredIndices.length,
        adaptiveFactor,
        torsoToFemur
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
        totalCount: requiredIndices.length,
        adaptiveFactor,
        torsoToFemur
      };
    }

    // High confidence + full body — include the adaptive factor
    return {
      status: 'green',
      message: 'Good position. Calibration complete.',
      isReady: true,
      visibleCount,
      totalCount: requiredIndices.length,
      adaptiveFactor,
      torsoToFemur
    };
  }
}

export const calibrationLogic = new CalibrationLogic();
