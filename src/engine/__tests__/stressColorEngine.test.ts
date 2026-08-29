import { describe, it, expect } from "vitest";
import {
  STRESS_COLOR_STOPS,
  smoothstep,
  stressFromAngle,
  dynamicThresholds,
  sampleStressColor,
  exponentialSmooth,
  angleDegreesBetween,
  type AngleRamp,
} from "../stressColorEngine";

const ELBOW: AngleRamp = { low: 55, high: 170, decreasing: true };

describe("smoothstep", () => {
  it("hits exact endpoints and the midpoint", () => {
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 10);
  });

  it("clamps out-of-range input", () => {
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(2)).toBe(1);
  });
});

describe("stressFromAngle", () => {
  it("maps a decreasing ramp so smaller angles stress more", () => {
    expect(stressFromAngle(170, ELBOW)).toBe(0);
    expect(stressFromAngle(55, ELBOW)).toBe(1);
    expect(stressFromAngle((170 + 55) / 2, ELBOW)).toBeCloseTo(0.5, 10);
  });

  it("maps an increasing ramp so larger angles stress more", () => {
    const increasing: AngleRamp = { low: 60, high: 175, decreasing: false };
    expect(stressFromAngle(60, increasing)).toBe(0);
    expect(stressFromAngle(175, increasing)).toBe(1);
    expect(stressFromAngle(117.5, increasing)).toBeCloseTo(0.5, 10);
  });

  it("is monotonic across the window (no jumps)", () => {
    const values: number[] = [];
    for (let a = ELBOW.high; a >= ELBOW.low; a -= 5) values.push(stressFromAngle(a, ELBOW));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });
});

describe("dynamicThresholds", () => {
  it("preserves the base window at zero motion", () => {
    expect(dynamicThresholds(ELBOW, 0)).toEqual(ELBOW);
  });

  it("compresses the window as motion rises", () => {
    const dyn = dynamicThresholds(ELBOW, 1);
    expect(dyn.high).toBeLessThan(ELBOW.high);
    expect(dyn.low).toBeGreaterThan(ELBOW.low);
    expect(dyn.decreasing).toBe(true);
    expect(dyn.high - dyn.low).toBeLessThan(ELBOW.high - ELBOW.low);
  });

  it("does not mutate the input ramp", () => {
    const copy = { ...ELBOW };
    dynamicThresholds(ELBOW, 1);
    expect(ELBOW).toEqual(copy);
  });
});

describe("sampleStressColor", () => {
  const closeTuple = (a: number[], b: readonly number[]) => {
    expect(a[0]).toBeCloseTo(b[0], 6);
    expect(a[1]).toBeCloseTo(b[1], 6);
    expect(a[2]).toBeCloseTo(b[2], 6);
  };

  it("returns the exact stops at the three anchor points", () => {
    closeTuple(sampleStressColor(0), STRESS_COLOR_STOPS.good);
    closeTuple(sampleStressColor(0.5), STRESS_COLOR_STOPS.mid);
    closeTuple(sampleStressColor(1), STRESS_COLOR_STOPS.bad);
  });

  it("is continuous — consecutive samples differ smoothly, no jumps", () => {
    // Max smoothstep slope in stress space is 3; at a 0.025 sample stride the
    // largest legitimate step is ~0.11. A hard discontinuity would exceed this.
    const redChannel: number[] = [];
    for (let s = 0; s <= 1.0001; s += 0.025) redChannel.push(sampleStressColor(s)[0]);
    for (let i = 1; i < redChannel.length; i++) {
      expect(Math.abs(redChannel[i] - redChannel[i - 1])).toBeLessThan(0.12);
    }
  });

  it("ramps red upward and blue downward overall", () => {
    const start = sampleStressColor(0);
    const end = sampleStressColor(1);
    expect(end[0]).toBeGreaterThan(start[0]);
    expect(end[2]).toBeLessThan(start[2]);
  });
});

describe("exponentialSmooth", () => {
  it("returns the target on first observation (no history)", () => {
    expect(exponentialSmooth(undefined, 0.8, 0.16)).toBe(0.8);
  });

  it("eases toward the target each step", () => {
    let value = 0;
    value = exponentialSmooth(value, 1, 0.5);
    expect(value).toBe(0.5);
    value = exponentialSmooth(value, 1, 0.5);
    expect(value).toBe(0.75);
  });

  it("respects k=0 (hold) and k=1 (instant)", () => {
    expect(exponentialSmooth(0.2, 1, 0)).toBe(0.2);
    expect(exponentialSmooth(0.2, 1, 1)).toBe(1);
  });
});

describe("angleDegreesBetween", () => {
  it("computes a right angle", () => {
    expect(angleDegreesBetween({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBeCloseTo(90, 6);
  });

  it("computes a straight (0°) pair", () => {
    expect(angleDegreesBetween({ x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 })).toBeCloseTo(0, 6);
  });

  it("returns 180 for a degenerate zero-length vector", () => {
    expect(angleDegreesBetween({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBe(180);
  });
});
