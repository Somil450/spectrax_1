import { describe, it, expect } from "vitest";
import { calculateAngle, getJointAngles } from "../angleUtils";

// Minimal landmark shape matching NormalizedLandmark
const lm = (x: number, y: number, z = 0, visibility = 1) => ({
  x,
  y,
  z,
  visibility,
});

// Build a 33-element landmarks array with sensible defaults
function mockLandmarks(overrides: Record<number, ReturnType<typeof lm>> = {}) {
  const base = Array.from({ length: 33 }, (_, i) =>
    lm(i * 0.03, i * 0.03, 0, 1)
  );
  for (const [idx, val] of Object.entries(overrides)) {
    base[+idx] = val;
  }
  return base;
}

describe("calculateAngle", () => {
  it("returns 180 for three collinear points", () => {
    const a = lm(0, 0);
    const b = lm(1, 0);
    const c = lm(2, 0);
    expect(calculateAngle(a, b, c)).toBeCloseTo(180, 5);
  });

  it("returns 90 for a right-angle joint", () => {
    const a = lm(0, 1);
    const b = lm(0, 0);
    const c = lm(1, 0);
    expect(calculateAngle(a, b, c)).toBeCloseTo(90, 5);
  });

  it("returns 0 when all three points are identical", () => {
    const p = lm(1, 1);
    expect(calculateAngle(p, p, p)).toBe(0);
  });

  it("returns 0 when a landmark is missing (null guard)", () => {
    // @ts-ignore — intentionally testing the null guard
    expect(calculateAngle(null, lm(0, 0), lm(1, 0))).toBe(0);
  });
});

describe("getJointAngles", () => {
  it("returns an object with keys knee, elbow, shoulder, and bodyLine", () => {
    const angles = getJointAngles(mockLandmarks());
    expect(angles).toHaveProperty("knee");
    expect(angles).toHaveProperty("elbow");
    expect(angles).toHaveProperty("shoulder");
    expect(angles).toHaveProperty("bodyLine");
  });

  it("returns an empty object when landmarks is null", () => {
    expect(getJointAngles(null)).toEqual({});
  });
});