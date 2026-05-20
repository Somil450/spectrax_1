/**
 * calibrationStateEngine.ts
 *
 * Pure state logic for calibration - NO visual elements.
 * Responsible for:
 * - Analyzing pose landmarks for visibility and positioning
 * - Calculating calibration readiness
 * - Returning structured data without colors/messages
 *
 * This module is 100% testable with no external dependencies on UI.
 */

import type { Results, NormalizedLandmark } from "@mediapipe/pose";

/**
 * Core calibration state - pure data, no visual elements
 */
export interface CalibrationState {
  /** Is full body visible and properly positioned? */
  isReady: boolean;

  /** Number of visible key joints (0-8) */
  visibleCount: number;

  /** Total key joints required (always 8) */
  totalCount: number;

  /** Visibility percentage (0-100) */
  visibilityPercent: number;

  /** Is body centered horizontally? */
  isCentered: boolean;

  /** Center X coordinate (0-1) */
  centerX: number;

  /** Reason for current state (machine-readable) */
  reason:
    | "no_body_detected"
    | "insufficient_visibility"
    | "not_centered"
    | "calibration_ready";
}

/**
 * Configuration for calibration analysis
 */
export interface CalibrationConfig {
  /** Visibility threshold (0-1) */
  visibilityThreshold: number;

  /** Minimum visible joints for partial calibration (0-8) */
  minVisibleForPartial: number;

  /** Minimum visible joints for full calibration (0-8) */
  minVisibleForFull: number;

  /** Center X bounds (left, right) */
  centerXBounds: [number, number];
}

/**
 * Default calibration configuration
 */
export const DEFAULT_CALIBRATION_CONFIG: CalibrationConfig = {
  visibilityThreshold: 0.5,
  minVisibleForPartial: 4,
  minVisibleForFull: 8,
  centerXBounds: [0.2, 0.8],
};

/**
 * Landmark indices for full body tracking
 * 11, 12 (shoulders), 23, 24 (hips), 25, 26 (knees), 27, 28 (ankles)
 */
export const REQUIRED_LANDMARK_INDICES = [11, 12, 23, 24, 25, 26, 27, 28];

/**
 * CalibrationStateEngine - Pure state calculation logic
 * No external dependencies, fully testable
 */
export class CalibrationStateEngine {
  private config: CalibrationConfig;

  constructor(config: Partial<CalibrationConfig> = {}) {
    this.config = { ...DEFAULT_CALIBRATION_CONFIG, ...config };
  }

  /**
   * Analyze pose results and return pure calibration state
   *
   * @param results - MediaPipe pose results
   * @returns CalibrationState - Pure data structure
   */
  analyze(results: Results): CalibrationState {
    // No body detected
    if (!results.poseLandmarks || results.poseLandmarks.length === 0) {
      return {
        isReady: false,
        visibleCount: 0,
        totalCount: REQUIRED_LANDMARK_INDICES.length,
        visibilityPercent: 0,
        isCentered: false,
        centerX: 0.5,
        reason: "no_body_detected",
      };
    }

    const landmarks = results.poseLandmarks;

    // Calculate visibility
    const visibilityData = this.calculateVisibility(landmarks);
    const { visibleCount, visibilityPercent } = visibilityData;

    // Check visibility thresholds
    if (visibleCount < this.config.minVisibleForPartial) {
      return {
        isReady: false,
        visibleCount,
        totalCount: REQUIRED_LANDMARK_INDICES.length,
        visibilityPercent,
        isCentered: false,
        centerX: this.calculateCenterX(landmarks),
        reason: "insufficient_visibility",
      };
    }

    // Calculate centering
    const centerX = this.calculateCenterX(landmarks);
    const isCentered = this.isCenterValid(centerX);

    // Check centering
    if (!isCentered && visibleCount >= this.config.minVisibleForFull) {
      return {
        isReady: false,
        visibleCount,
        totalCount: REQUIRED_LANDMARK_INDICES.length,
        visibilityPercent,
        isCentered: false,
        centerX,
        reason: "not_centered",
      };
    }

    // Calibration ready
    if (visibleCount >= this.config.minVisibleForFull && isCentered) {
      return {
        isReady: true,
        visibleCount,
        totalCount: REQUIRED_LANDMARK_INDICES.length,
        visibilityPercent: 100,
        isCentered: true,
        centerX,
        reason: "calibration_ready",
      };
    }

    // Partial visibility but not full
    return {
      isReady: false,
      visibleCount,
      totalCount: REQUIRED_LANDMARK_INDICES.length,
      visibilityPercent,
      isCentered,
      centerX,
      reason: "insufficient_visibility",
    };
  }

  /**
   * Calculate how many key joints are visible
   */
  private calculateVisibility(landmarks: NormalizedLandmark[]): {
    visibleCount: number;
    visibilityPercent: number;
  } {
    const visibleCount = REQUIRED_LANDMARK_INDICES.filter(
      (i) =>
        landmarks[i] &&
        (landmarks[i].visibility || 0) > this.config.visibilityThreshold,
    ).length;

    const visibilityPercent = Math.round(
      (visibleCount / REQUIRED_LANDMARK_INDICES.length) * 100,
    );

    return { visibleCount, visibilityPercent };
  }

  /**
   * Calculate shoulder center X coordinate (0-1)
   */
  private calculateCenterX(landmarks: NormalizedLandmark[]): number {
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];

    if (!leftShoulder || !rightShoulder) {
      return 0.5;
    }

    return (leftShoulder.x + rightShoulder.x) / 2;
  }

  /**
   * Check if center X is within valid bounds
   */
  private isCenterValid(centerX: number): boolean {
    const [minX, maxX] = this.config.centerXBounds;
    return centerX >= minX && centerX <= maxX;
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(config: Partial<CalibrationConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): CalibrationConfig {
    return { ...this.config };
  }
}

/**
 * Singleton instance
 */
export const calibrationStateEngine = new CalibrationStateEngine();
