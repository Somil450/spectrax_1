import { describe, it, expect } from "vitest";
import {
  CalibrationLogic,
  CalibrationResult,
  CALIBRATION_JOINTS,
  CALIBRATION_REQUIRED_INDICES,
  calculateJointAngle,
  trackMovementRange,
  computeCalibrationThreshold,
  buildCalibrationProfile,
  calibrationLogic,
} from "../calibrationLogic";
import type { Results } from "@mediapipe/pose";

function makeLandmarks(count: number, visibility = 1.0, x = 0.5): any[] {
  return Array.from({ length: count }, (_, i) => ({
    x: i % 2 === 0 ? x : x + 0.01,
    y: 0.5 - (i % 4) * 0.05,
    z: 0.05,
    visibility,
  }));
}

function makeResults(landmarks: any[] | null | undefined): Results {
  return {
    poseLandmarks: landmarks as any,
    poseWorldLandmarks: null,
    image: null as any,
    segmentationMask: null as any,
  } as unknown as Results;
}

const fullVisibleLandmarks = (): any[] => {
  const l = makeLandmarks(33, 0.9);
  // center shoulders horizontally
  l[11].x = 0.5;
  l[12].x = 0.5;
  return l;
};

describe("CalibrationLogic.evaluate", () => {
  const logic = new CalibrationLogic();

  it("returns red 'no body detected' when poseLandmarks is absent", () => {
    const result = logic.evaluate(makeResults(null));
    expect(result.status).toBe("red");
    expect(result.isReady).toBe(false);
    expect(result.message).toContain("No body detected");
    expect(result.visibleCount).toBe(0);
  });

  it("returns red 'step back' when fewer than 4 joints are visible", () => {
    const l = makeLandmarks(33, 0.1);
    l[11].visibility = 0.9;
    l[12].visibility = 0.9;
    const result = logic.evaluate(makeResults(l));
    expect(result.status).toBe("red");
    expect(result.message).toContain("Step back");
    expect(result.visibleCount).toBeLessThan(4);
  });

  it("returns yellow 'adjust position' when some but not all joints visible", () => {
    const l = fullVisibleLandmarks();
    l[27].visibility = 0.2;
    l[28].visibility = 0.2;
    const result = logic.evaluate(makeResults(l));
    expect(result.status).toBe("yellow");
    expect(result.message).toContain("Adjust position");
    expect(result.visibleCount).toBe(6);
  });

  it("returns yellow 'center your body' when shoulders are off-center", () => {
    const l = fullVisibleLandmarks();
    l[11].x = 0.05;
    l[12].x = 0.05;
    const result = logic.evaluate(makeResults(l));
    expect(result.status).toBe("yellow");
    expect(result.message).toContain("Center your body");
  });

  it("returns green ready when full body is visible and centered", () => {
    const result = logic.evaluate(makeResults(fullVisibleLandmarks()));
    expect(result.status).toBe("green");
    expect(result.isReady).toBe(true);
    expect(result.message).toContain("Good position");
    expect(result.visibleCount).toBe(CALIBRATION_REQUIRED_INDICES.length);
  });

  it("propagates the adaptiveFactor through every result", () => {
    for (const landmarks of [null, makeLandmarks(33, 0.1), fullVisibleLandmarks()]) {
      const result = logic.evaluate(makeResults(landmarks), 1.05);
      expect(result.adaptiveFactor).toBe(1.05);
    }
  });
});

describe("calculateJointAngle", () => {
  it("returns 90 degrees for a perpendicular corner", () => {
    const landmarks = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 },
    ];
    expect(calculateJointAngle(landmarks, 0, 1, 2)).toBeCloseTo(90, 5);
  });

  it("returns ~180 degrees for a straight line", () => {
    const landmarks = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
    ];
    expect(calculateJointAngle(landmarks, 0, 1, 2)).toBeCloseTo(180, 5);
  });

  it("returns 0 when a landmark is missing", () => {
    const landmarks = [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }];
    expect(calculateJointAngle(landmarks, 0, 1, 2)).toBe(0);
  });

  it("returns 0 for degenerate zero-length vectors", () => {
    const landmarks = [
      { x: 1, y: 1, z: 0 },
      { x: 1, y: 1, z: 0 },
      { x: 1, y: 1, z: 0 },
    ];
    expect(calculateJointAngle(landmarks, 0, 1, 2)).toBe(0);
  });

  it("exports a joint triplet for every mapped exercise", () => {
    expect(CALIBRATION_JOINTS.squat).toEqual({ a: 23, b: 25, c: 27 });
    expect(CALIBRATION_JOINTS.pushup).toEqual({ a: 11, b: 13, c: 15 });
    expect(Object.keys(CALIBRATION_JOINTS).length).toBeGreaterThanOrEqual(5);
  });
});

describe("trackMovementRange", () => {
  it("widens an empty range from a valid sample", () => {
    expect(trackMovementRange(120, 180, 0)).toEqual({ minAngle: 120, maxAngle: 120 });
  });

  it("tightens the min/max bounds across samples", () => {
    let range = trackMovementRange(120, 180, 0);
    range = trackMovementRange(100, range.minAngle, range.maxAngle);
    range = trackMovementRange(160, range.minAngle, range.maxAngle);
    expect(range).toEqual({ minAngle: 100, maxAngle: 160 });
  });

  it("ignores degenerate angles outside the 5-179 window", () => {
    expect(trackMovementRange(2, 100, 160)).toEqual({ minAngle: 100, maxAngle: 160 });
    expect(trackMovementRange(180, 100, 160)).toEqual({ minAngle: 100, maxAngle: 160 });
  });
});

describe("computeCalibrationThreshold", () => {
  it("targets the deepest 10% of a meaningful range", () => {
    // range 100 -> threshold = round(180 - 90) = 90
    expect(computeCalibrationThreshold(80, 180, 140)).toBe(90);
  });

  it("falls back to the config threshold for a tiny range", () => {
    expect(computeCalibrationThreshold(175, 180, 140)).toBe(140);
  });
});

describe("buildCalibrationProfile", () => {
  it("builds the persisted profile shape with rounded angles", () => {
    const profile = buildCalibrationProfile("squat", 80.4, 179.6, 140);
    expect(profile.squat).toEqual({
      minAngle: 80,
      maxAngle: 180,
      calibratedThreshold: 90,
    });
  });

  it("uses the fallback threshold when the range is not meaningful", () => {
    const profile = buildCalibrationProfile("squat", 174, 178, 140);
    expect(profile.squat.calibratedThreshold).toBe(140);
  });
});

describe("calibrationLogic singleton", () => {
  it("is an instance of CalibrationLogic", () => {
    expect(calibrationLogic).toBeInstanceOf(CalibrationLogic);
  });
});
