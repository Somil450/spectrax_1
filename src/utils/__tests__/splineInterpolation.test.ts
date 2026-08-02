import { describe, it, expect } from "vitest";
import { catmullRom, catmullRomSmooth, interpolateFrames, type SplineFrame } from "../splineInterpolation";

function frame(x: number): SplineFrame {
  return [{ x, y: 0.5, z: 0, visibility: 0.9 }];
}

describe("catmullRom", () => {
  it("passes exactly through the inner control points", () => {
    expect(catmullRom(0, 10, 20, 30, 0)).toBe(10);
    expect(catmullRom(0, 10, 20, 30, 1)).toBe(20);
  });

  it("is symmetric at the midpoint for equally spaced points", () => {
    expect(catmullRom(0, 10, 20, 30, 0.5)).toBe(15);
  });
});

describe("catmullRomSmooth", () => {
  it("returns endpoints at t=0 and t=1", () => {
    expect(catmullRomSmooth(0, 10, 20, 30, 0)).toBe(10);
    expect(catmullRomSmooth(0, 10, 20, 30, 1)).toBe(20);
  });
});

describe("interpolateFrames", () => {
  it("returns null for empty frames", () => {
    expect(interpolateFrames([], 0.5)).toBeNull();
  });

  it("returns the exact frame at integer indices", () => {
    const frames = [frame(0), frame(10), frame(20)];
    expect(interpolateFrames(frames, 1)?.[0].x).toBe(10);
    expect(interpolateFrames(frames, 0)?.[0].x).toBe(0);
  });

  it("clamps to the first frame below range", () => {
    const frames = [frame(0), frame(10)];
    expect(interpolateFrames(frames, -2)?.[0].x).toBe(0);
  });

  it("clamps to the last frame above range", () => {
    const frames = [frame(0), frame(10), frame(20)];
    expect(interpolateFrames(frames, 99)?.[0].x).toBe(20);
  });

  it("splines the midpoint between two linear frames", () => {
    const frames = [frame(0), frame(10), frame(20), frame(30)];
    const mid = interpolateFrames(frames, 1.5)?.[0].x;
    // Linear midpoint of 10 and 20 is 15; Catmull-Rom preserves it for even spacing.
    expect(mid).toBeCloseTo(15, 5);
  });

  it("interpolates all coordinates, not just x", () => {
    const frames: SplineFrame[] = [
      [{ x: 0, y: 0, z: 0, visibility: 0.9 }],
      [{ x: 10, y: 20, z: 30, visibility: 0.8 }],
      [{ x: 20, y: 40, z: 60, visibility: 0.7 }],
      [{ x: 30, y: 60, z: 90, visibility: 0.6 }],
    ];
    const mid = interpolateFrames(frames, 1.5)![0];
    expect(mid.y).toBeCloseTo(30, 5);
    expect(mid.z).toBeCloseTo(45, 5);
    expect(mid.visibility).toBe(0.8);
  });

  it("handles landmark counts with missing entries", () => {
    const frames: SplineFrame[] = [
      [{ x: 0, y: 0, z: 0 }, { x: 5, y: 5, z: 5 }],
      [{ x: 10, y: 10, z: 10 }],
      [{ x: 20, y: 20, z: 20 }],
    ];
    const result = interpolateFrames(frames, 1.5)!;
    expect(result).toHaveLength(1);
    // Clamped end control point causes slight overshoot, but the result must
    // stay between the two bounding frames.
    expect(result[0].x).toBeGreaterThan(10);
    expect(result[0].x).toBeLessThan(20);
  });
});
