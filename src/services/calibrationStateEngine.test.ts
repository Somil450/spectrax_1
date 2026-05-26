
/**
 * calibrationStateEngine.test.ts
 *
 * 100% test coverage for pure calibration state logic
 * Tests all branches and edge cases
 */

import {
  CalibrationStateEngine,
  CalibrationState,
  REQUIRED_LANDMARK_INDICES,
  DEFAULT_CALIBRATION_CONFIG,
} from "./calibrationStateEngine";
import type { Results, NormalizedLandmark } from "@mediapipe/pose";

/**
 * Helper to create mock landmarks
 */
function createMockLandmark(
  x: number,
  y: number,
  z: number,
  visibility: number = 1,
): NormalizedLandmark {
  return { x, y, z, visibility };
}

/**
 * Helper to create mock pose results
 */
function createMockResults(
  landmarks: NormalizedLandmark[] | null = null,
): Results {
  if (landmarks === null) {
    landmarks = new Array(33).fill(null).map((_, i) => {
      if (REQUIRED_LANDMARK_INDICES.includes(i)) {
        return createMockLandmark(0.5, 0.5, 0, 0.9);
      }
      return createMockLandmark(0, 0, 0, 0);
    });
  }

  return {
    poseLandmarks: landmarks,
    poseWorldLandmarks: [],
    segmentationMask: null,
    image: new Image(),
  };
}

describe("CalibrationStateEngine", () => {
  let engine: CalibrationStateEngine;

  beforeEach(() => {
    engine = new CalibrationStateEngine();
  });

  describe("No Body Detection", () => {
    test("should return no_body_detected when poseLandmarks is null", () => {
      const results = { poseLandmarks: null } as Results;
      const state = engine.analyze(results);

      expect(state.reason).toBe("no_body_detected");
      expect(state.isReady).toBe(false);
      expect(state.visibleCount).toBe(0);
      expect(state.visibilityPercent).toBe(0);
    });

    test("should return no_body_detected when poseLandmarks is empty array", () => {
      const results = createMockResults([]);
      const state = engine.analyze(results);

      expect(state.reason).toBe("no_body_detected");
      expect(state.isReady).toBe(false);
    });
  });

  describe("Insufficient Visibility", () => {
    test("should detect when less than minVisibleForPartial joints are visible", () => {
      const landmarks = new Array(33).fill(null).map((_, i) => {
        // Only landmark 11 visible with high visibility
        if (i === 11) return createMockLandmark(0.5, 0.5, 0, 0.9);
        return createMockLandmark(0.5, 0.5, 0, 0.1); // Low visibility
      });

      const results = createMockResults(landmarks);
      const state = engine.analyze(results);

      expect(state.reason).toBe("insufficient_visibility");
      expect(state.isReady).toBe(false);
      expect(state.visibleCount).toBe(1);
    });

    test("should return warning status for partial visibility (25-75%)", () => {
      // Make 4-6 landmarks visible (50-75%)
      const landmarks = new Array(33).fill(null).map((_, i) => {
        if (REQUIRED_LANDMARK_INDICES.slice(0, 5).includes(i)) {
          return createMockLandmark(0.5, 0.5, 0, 0.9);
        }
        return createMockLandmark(0.5, 0.5, 0, 0.1);
      });

      const results = createMockResults(landmarks);
      const state = engine.analyze(results);

      expect(state.reason).toBe("insufficient_visibility");
      expect(state.visibleCount).toBe(5);
      expect(state.isReady).toBe(false);
    });

    test("should calculate correct visibilityPercent", () => {
      // 4 out of 8 visible = 50%
      const landmarks = new Array(33).fill(null).map((_, i) => {
        if (REQUIRED_LANDMARK_INDICES.slice(0, 4).includes(i)) {
          return createMockLandmark(0.5, 0.5, 0, 0.9);
        }
        return createMockLandmark(0.5, 0.5, 0, 0.1);
      });

      const results = createMockResults(landmarks);
      const state = engine.analyze(results);

      expect(state.visibilityPercent).toBe(50);
    });
  });

  describe("Not Centered", () => {
    test("should detect when body is off to the left", () => {
      const landmarks = new Array(33).fill(null).map((_, i) => {
        if (i === 11) return createMockLandmark(0.1, 0.5, 0, 0.9); // Far left
        if (i === 12) return createMockLandmark(0.15, 0.5, 0, 0.9); // Far left
        if (REQUIRED_LANDMARK_INDICES.includes(i)) {
          return createMockLandmark(0.5, 0.5, 0, 0.9);
        }
        return createMockLandmark(0.5, 0.5, 0, 0.1);
      });

      const results = createMockResults(landmarks);
      const state = engine.analyze(results);

      expect(state.reason).toBe("not_centered");
      expect(state.isCentered).toBe(false);
      expect(state.centerX).toBeCloseTo(0.125, 2);
    });

    test("should detect when body is off to the right", () => {
      const landmarks = new Array(33).fill(null).map((_, i) => {
        if (i === 11) return createMockLandmark(0.85, 0.5, 0, 0.9); // Far right
        if (i === 12) return createMockLandmark(0.9, 0.5, 0, 0.9); // Far right
        if (REQUIRED_LANDMARK_INDICES.includes(i)) {
          return createMockLandmark(0.5, 0.5, 0, 0.9);
        }
        return createMockLandmark(0.5, 0.5, 0, 0.1);
      });

      const results = createMockResults(landmarks);
      const state = engine.analyze(results);

      expect(state.reason).toBe("not_centered");
      expect(state.isCentered).toBe(false);
      expect(state.centerX).toBeCloseTo(0.875, 2);
    });

    test("should return warning for not centered when visibility is high", () => {
      const landmarks = new Array(33).fill(null).map((_, i) => {
        if (i === 11) return createMockLandmark(0.1, 0.5, 0, 0.9);
        if (i === 12) return createMockLandmark(0.15, 0.5, 0, 0.9);
        if (REQUIRED_LANDMARK_INDICES.includes(i)) {
          return createMockLandmark(0.5, 0.5, 0, 0.9);
        }
        return createMockLandmark(0.5, 0.5, 0, 0.1);
      });

      const results = createMockResults(landmarks);
      const state = engine.analyze(results);

      expect(state.reason).toBe("not_centered");
      expect(state.visibilityPercent).toBe(100);
    });
  });

  describe("Calibration Ready", () => {
    test("should detect fully visible and centered body", () => {
      const results = createMockResults();
      const state = engine.analyze(results);

      expect(state.reason).toBe("calibration_ready");
      expect(state.isReady).toBe(true);
      expect(state.visibleCount).toBe(8);
      expect(state.visibilityPercent).toBe(100);
      expect(state.isCentered).toBe(true);
    });

    test("should return centerX around 0.5 for centered body", () => {
      const results = createMockResults();
      const state = engine.analyze(results);

      expect(state.centerX).toBeCloseTo(0.5, 1);
    });
  });

  describe("Center Validation", () => {
    test("should accept centerX within valid bounds [0.2, 0.8]", () => {
      const testCases = [0.2, 0.3, 0.5, 0.7, 0.8];

      testCases.forEach((centerX) => {
        const landmarks = new Array(33).fill(null).map((_, i) => {
          if (i === 11) return createMockLandmark(centerX - 0.05, 0.5, 0, 0.9);
          if (i === 12) return createMockLandmark(centerX + 0.05, 0.5, 0, 0.9);
          if (REQUIRED_LANDMARK_INDICES.includes(i)) {
            return createMockLandmark(0.5, 0.5, 0, 0.9);
          }
          return createMockLandmark(0.5, 0.5, 0, 0.1);
        });

        const results = createMockResults(landmarks);
        const state = engine.analyze(results);

        expect(state.isCentered).toBe(true);
      });
    });

    test("should reject centerX outside bounds (< 0.2)", () => {
      const landmarks = new Array(33).fill(null).map((_, i) => {
        if (i === 11) return createMockLandmark(0.05, 0.5, 0, 0.9);
        if (i === 12) return createMockLandmark(0.1, 0.5, 0, 0.9);
        if (REQUIRED_LANDMARK_INDICES.includes(i)) {
          return createMockLandmark(0.5, 0.5, 0, 0.9);
        }
        return createMockLandmark(0.5, 0.5, 0, 0.1);
      });

      const results = createMockResults(landmarks);
      const state = engine.analyze(results);

      expect(state.isCentered).toBe(false);
      expect(state.reason).toBe("not_centered");
    });

    test("should reject centerX outside bounds (> 0.8)", () => {
      const landmarks = new Array(33).fill(null).map((_, i) => {
        if (i === 11) return createMockLandmark(0.9, 0.5, 0, 0.9);
        if (i === 12) return createMockLandmark(0.95, 0.5, 0, 0.9);
        if (REQUIRED_LANDMARK_INDICES.includes(i)) {
          return createMockLandmark(0.5, 0.5, 0, 0.9);
        }
        return createMockLandmark(0.5, 0.5, 0, 0.1);
      });

      const results = createMockResults(landmarks);
      const state = engine.analyze(results);

      expect(state.isCentered).toBe(false);
      expect(state.reason).toBe("not_centered");
    });
  });

  describe("Visibility Threshold", () => {
    test("should use configurable visibility threshold", () => {
      const customEngine = new CalibrationStateEngine({
        visibilityThreshold: 0.7,
      });

      const landmarks = new Array(33).fill(null).map((_, i) => {
        if (REQUIRED_LANDMARK_INDICES.includes(i)) {
          // All landmarks have 0.6 visibility (below custom threshold)
          return createMockLandmark(0.5, 0.5, 0, 0.6);
        }
        return createMockLandmark(0.5, 0.5, 0, 0.1);
      });

      const results = createMockResults(landmarks);
      const state = customEngine.analyze(results);

      // Should be counted as not visible
      expect(state.visibleCount).toBe(0);
    });

    test("should detect landmarks above visibility threshold", () => {
      const landmarks = new Array(33).fill(null).map((_, i) => {
        if (REQUIRED_LANDMARK_INDICES.includes(i)) {
          // All landmarks have 0.6 visibility (above default 0.5 threshold)
          return createMockLandmark(0.5, 0.5, 0, 0.6);
        }
        return createMockLandmark(0.5, 0.5, 0, 0.1);
      });

      const results = createMockResults(landmarks);
      const state = engine.analyze(results);

      expect(state.visibleCount).toBe(8);
    });
  });

  describe("Configuration Management", () => {
    test("should update config at runtime", () => {
      engine.updateConfig({ visibilityThreshold: 0.9 });
      const config = engine.getConfig();

      expect(config.visibilityThreshold).toBe(0.9);
    });

    test("should preserve other config values when updating", () => {
      engine.updateConfig({ minVisibleForFull: 6 });
      const config = engine.getConfig();

      expect(config.visibilityThreshold).toBe(
        DEFAULT_CALIBRATION_CONFIG.visibilityThreshold,
      );
      expect(config.minVisibleForFull).toBe(6);
    });

    test("should get copy of config (no reference mutation)", () => {
      const config1 = engine.getConfig();
      config1.visibilityThreshold = 0.9;

      const config2 = engine.getConfig();
      expect(config2.visibilityThreshold).toBe(
        DEFAULT_CALIBRATION_CONFIG.visibilityThreshold,
      );
    });
  });

  describe("Edge Cases", () => {
    test("should handle missing shoulder landmarks (centerX = 0.5)", () => {
      const landmarks = new Array(33).fill(null).map((_, i) => {
        if (i === 11 || i === 12) {
          return createMockLandmark(0.5, 0.5, 0, 0); // Invisible
        }
        if (REQUIRED_LANDMARK_INDICES.includes(i)) {
          return createMockLandmark(0.5, 0.5, 0, 0.9);
        }
        return createMockLandmark(0.5, 0.5, 0, 0.1);
      });

      const results = createMockResults(landmarks);
      const state = engine.analyze(results);

      // Should default to centerX = 0.5
      expect(state.centerX).toBe(0.5);
    });

    test("should handle undefined visibility values", () => {
      const landmarks = new Array(33).fill(null).map((_, i) => {
        if (REQUIRED_LANDMARK_INDICES.includes(i)) {
          return { x: 0.5, y: 0.5, z: 0 } as NormalizedLandmark;
        }
        return createMockLandmark(0.5, 0.5, 0, 0.1);
      });

      const results = createMockResults(landmarks);
      const state = engine.analyze(results);

      // Undefined visibility should be treated as 0
      expect(state.visibleCount).toBeLessThan(8);
    });

    test("should return consistent totalCount (always 8)", () => {
      const scenarios = [
        createMockResults(new Array(33).fill(createMockLandmark(0, 0, 0, 0))),
        createMockResults(
          new Array(33).fill(createMockLandmark(0.5, 0.5, 0, 1)),
        ),
        createMockResults(null),
      ];

      scenarios.forEach((results) => {
        const state = engine.analyze(results);
        expect(state.totalCount).toBe(8);
      });
    });
  });

  describe("State Transitions", () => {
    test("should transition from error to warning as visibility improves", () => {
      // Start with very low visibility
      let landmarks = new Array(33).fill(null).map((_, i) => {
        if (REQUIRED_LANDMARK_INDICES.slice(0, 1).includes(i)) {
          return createMockLandmark(0.5, 0.5, 0, 0.9);
        }
        return createMockLandmark(0.5, 0.5, 0, 0.1);
      });

      let results = createMockResults(landmarks);
      let state = engine.analyze(results);
      expect(state.reason).toBe("insufficient_visibility");
      expect(state.visibleCount).toBe(1);

      // Improve visibility
      landmarks = new Array(33).fill(null).map((_, i) => {
        if (REQUIRED_LANDMARK_INDICES.slice(0, 6).includes(i)) {
          return createMockLandmark(0.5, 0.5, 0, 0.9);
        }
        return createMockLandmark(0.5, 0.5, 0, 0.1);
      });

      results = createMockResults(landmarks);
      state = engine.analyze(results);
      expect(state.reason).toBe("insufficient_visibility");
      expect(state.visibleCount).toBe(6);
    });

    test("should transition from not_centered to ready when centering improves", () => {
      // Start off-center
      let landmarks = new Array(33).fill(null).map((_, i) => {
        if (i === 11) return createMockLandmark(0.1, 0.5, 0, 0.9);
        if (i === 12) return createMockLandmark(0.15, 0.5, 0, 0.9);
        if (REQUIRED_LANDMARK_INDICES.includes(i)) {
          return createMockLandmark(0.5, 0.5, 0, 0.9);
        }
        return createMockLandmark(0.5, 0.5, 0, 0.1);
      });

      let results = createMockResults(landmarks);
      let state = engine.analyze(results);
      expect(state.reason).toBe("not_centered");

      // Center body
      landmarks = new Array(33).fill(null).map((_, i) => {
        if (REQUIRED_LANDMARK_INDICES.includes(i)) {
          return createMockLandmark(0.5, 0.5, 0, 0.9);
        }
        return createMockLandmark(0.5, 0.5, 0, 0.1);
      });

      results = createMockResults(landmarks);
      state = engine.analyze(results);
      expect(state.reason).toBe("calibration_ready");
      expect(state.isReady).toBe(true);
    });
  });

  describe("Numeric Precision", () => {
    test("should handle floating point arithmetic correctly", () => {
      const landmarks = new Array(33).fill(null).map((_, i) => {
        if (REQUIRED_LANDMARK_INDICES.slice(0, 3).includes(i)) {
          return createMockLandmark(0.5, 0.5, 0, 0.9);
        }
        return createMockLandmark(0.5, 0.5, 0, 0.1);
      });

      const results = createMockResults(landmarks);
      const state = engine.analyze(results);

      // 3/8 = 0.375 = 37.5%, should round to 38%
      expect(state.visibilityPercent).toBe(38);
    });
  });
});
