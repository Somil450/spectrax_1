import { describe, it, expect } from "vitest";
import { getJointAngles, calculateAngle } from "../angleUtils";

const lm = (x: number, y: number, z = 0, visibility = 1) => ({
  x,
  y,
  z,
  visibility,
});

function mockLandmarks() {
  return Array.from({ length: 33 }, (_, i) =>
    lm(i * 0.03, i * 0.03, 0, 1)
  );
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
    expect(calculateAngle(null as any, lm(0, 0), lm(1, 0))).toBe(0);
  });
});
describe("getJointAngles", () => {
  it("returns a valid angles object", () => {
    const angles = getJointAngles(mockLandmarks());

    expect(typeof angles).toBe("object");
    expect(angles).toHaveProperty("knee");
    expect(angles).toHaveProperty("elbow");
    expect(angles).toHaveProperty("shoulder");
    expect(angles).toHaveProperty("bodyLine");
  });

it("returns default angles object reference when landmarks is null", () => {
  const angles = getJointAngles(null);
  expect(angles).toHaveProperty("knee");
  expect(angles).toHaveProperty("elbow");
});

  it("handles identical points safely", () => {
    const p = { x: 1, y: 1, z: 0, visibility: 1 };
    const landmarks = Array(33).fill(p);

    const angles = getJointAngles(landmarks);

    expect(typeof angles).toBe("object");
  });
});