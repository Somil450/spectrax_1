import type { Results } from '@mediapipe/pose';

/**
 * calibrationLogic.ts
 * Rules engine to determine if user position is correct for workout tracking.
 */

export interface CalibrationResult {
  status: 'red' | 'yellow' | 'green';
  message: string;
  isReady: boolean;
}

export class CalibrationLogic {
  private readonly visibilityThreshold = 0.5;

  /**
   * Processes current pose results and returns a calibration status.
   */
  evaluate(results: Results): CalibrationResult {
    if (!results.poseLandmarks) {
      return {
        status: 'red',
        message: 'No body detected. Step into frame.',
        isReady: false
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
        isReady: false
      };
    }

    if (visibleCount < 8) {
      return {
        status: 'yellow',
        message: 'Adjust position. Ankles or knees not clear.',
        isReady: false
      };
    }

    // Check centering (shoulders horizontal center)
    const midShoulderX = (landmarks[11].x + landmarks[12].x) / 2;
    if (midShoulderX < 0.2 || midShoulderX > 0.8) {
      return {
        status: 'yellow',
        message: 'Center your body in the frame.',
        isReady: false
      };
    }

    // High confidence + full body
    return {
      status: 'green',
      message: 'Good position. Calibration complete.',
      isReady: true
    };
  }
}

export const calibrationLogic = new CalibrationLogic();
