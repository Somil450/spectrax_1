import { describe, it, expect } from "vitest";
import { calculateAngle, getJointAngles, getJointVisibility } from "../angleUtils";

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
    expect(calculateAngle(null as any, lm(0, 0), lm(1, 0))).toBe(0);
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

  it("returns default angles object when landmarks is null", () => {
    const angles = getJointAngles(null);
    expect(angles).toHaveProperty("knee");
    expect(angles).toHaveProperty("elbow");
    expect(angles).toHaveProperty("shoulder");
    expect(angles).toHaveProperty("bodyLine");
  });
});

describe("getJointAngles - lunge fields", () => {
  it("exposes lungeKnee, backKnee, and kneePastToes", () => {
    const angles = getJointAngles(mockLandmarks());
    expect(angles).toHaveProperty("lungeKnee");
    expect(angles).toHaveProperty("backKnee");
    expect(angles).toHaveProperty("kneePastToes");
  });

  it("falls back to safe defaults (180 / 180 / 0) when knee landmarks are missing", () => {
    const landmarks = mockLandmarks({
      25: undefined as any,
      26: undefined as any,
    });
    const angles = getJointAngles(landmarks);
    expect(angles.lungeKnee).toBe(180);
    expect(angles.backKnee).toBe(180);
    expect(angles.kneePastToes).toBe(0);
  });

  it("picks the more-bent leg as lungeKnee and the straighter leg as backKnee", () => {
    // Left leg at right angle (90°): hip above knee, ankle to the right of knee.
    // Right leg straight (180°): hip, knee, ankle vertically collinear.
    const landmarks = mockLandmarks({
      23: lm(0.4, 0.5),
      25: lm(0.4, 0.7),
      27: lm(0.6, 0.7),
      24: lm(0.6, 0.5),
      26: lm(0.6, 0.7),
      28: lm(0.6, 0.9),
    });
    const angles = getJointAngles(landmarks);
    expect(angles.lungeKnee).toBeCloseTo(90, 1);
    expect(angles.backKnee).toBeCloseTo(180, 1);
  });
});

describe("getJointVisibility - lunge fields", () => {
  it("exposes lungeKnee and backKnee visibility", () => {
    const vis = getJointVisibility(mockLandmarks());
    expect(vis).toHaveProperty("lungeKnee");
    expect(vis).toHaveProperty("backKnee");
  });

  it("returns 0 for lungeKnee/backKnee when required landmarks are missing", () => {
    const sparse = Array.from({ length: 33 }, () => undefined as any);
    const vis = getJointVisibility(sparse);
    expect(vis.lungeKnee).toBe(0);
    expect(vis.backKnee).toBe(0);
  });

  it("reports the active leg's knee visibility for lungeKnee (left bent, right straight)", () => {
    const landmarks = mockLandmarks({
      23: lm(0.4, 0.5, 0, 1),
      25: lm(0.4, 0.7, 0, 0.3),
      27: lm(0.6, 0.7, 0, 1),
      24: lm(0.6, 0.5, 0, 1),
      26: lm(0.6, 0.7, 0, 0.9),
      28: lm(0.6, 0.9, 0, 1),
    });
    const vis = getJointVisibility(landmarks);
    expect(vis.lungeKnee).toBeCloseTo(0.3, 5);
    expect(vis.backKnee).toBeCloseTo(0.9, 5);
  });

  it("reports the active leg's knee visibility for lungeKnee (right bent, left straight)", () => {
    const landmarks = mockLandmarks({
      24: lm(0.6, 0.5, 0, 1),
      26: lm(0.6, 0.7, 0, 0.4),
      32: lm(0.8, 0.7, 0, 1),
      28: lm(0.8, 0.7, 0, 1),
      23: lm(0.4, 0.5, 0, 1),
      25: lm(0.4, 0.7, 0, 0.85),
      27: lm(0.4, 0.9, 0, 1),
    });
    const vis = getJointVisibility(landmarks);
    expect(vis.lungeKnee).toBeCloseTo(0.4, 5);
    expect(vis.backKnee).toBeCloseTo(0.85, 5);
  });
});