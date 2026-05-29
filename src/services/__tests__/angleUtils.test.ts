import { describe, it, expect } from "vitest";
import { getJointAngles } from "../angleUtils";

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

describe("getJointAngles", () => {
  it("returns a valid angles object", () => {
    const angles = getJointAngles(mockLandmarks());

    expect(typeof angles).toBe("object");
    expect(angles).toHaveProperty("knee");
    expect(angles).toHaveProperty("elbow");
    expect(angles).toHaveProperty("shoulder");
    expect(angles).toHaveProperty("bodyLine");
  });

  it("returns empty object when landmarks is null", () => {
    expect(getJointAngles(null)).toEqual({});
  });

  it("handles identical points safely", () => {
    const p = { x: 1, y: 1, z: 0, visibility: 1 };
    const landmarks = Array(33).fill(p);

    const angles = getJointAngles(landmarks);

    expect(typeof angles).toBe("object");
  });
});