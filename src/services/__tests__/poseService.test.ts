import { describe, it, expect, beforeEach } from "vitest";
import { JointConfidenceHash } from "../poseService";

type LM = { x: number; y: number; z?: number; visibility?: number };

function makeLandmarks(partial: Partial<LM> = {}): LM[] {
  return Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.9,
    ...partial,
  }));
}

describe("JointConfidenceHash", () => {
  let hash: JointConfidenceHash;

  beforeEach(() => {
    hash = new JointConfidenceHash();
  });

  it("passes high-confidence coordinates through unchanged after priming", () => {
    const landmarks = makeLandmarks({ x: 0.5, visibility: 0.95 });
    hash.process(landmarks);
    const next = makeLandmarks({ x: 0.52, visibility: 0.95 });
    hash.process(next);
    expect(next[0].x).toBeCloseTo(0.52);
  });

  it("bypasses unstable coordinates (confidence below 0.45 floor)", () => {
    const good = makeLandmarks({ x: 0.5, visibility: 0.9 });
    hash.process(good);

    const bad = makeLandmarks({ x: 1.2, visibility: 0.1 });
    hash.process(bad);

    // The unstable reading must not propagate — it is replaced by an estimate
    expect(bad[0].x).not.toBe(1.2);
    expect(bad[0].x).toBeGreaterThan(0.5);
    expect(bad[0].x).toBeLessThan(1.2);
  });

  it("interpolates toward the last good value the longer tracking is lost", () => {
    const good = makeLandmarks({ x: 0.5, visibility: 0.9 });
    hash.process(good);

    const values: number[] = [];
    for (let i = 0; i < 5; i++) {
      const frame = makeLandmarks({ x: 1.0, visibility: 0.1 });
      hash.process(frame);
      values.push(frame[0].x);
    }

    // Estimates converge monotonically toward the last good value (0.5)
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
    }
    expect(values[values.length - 1]).toBeCloseTo(0.5, 1);
  });

  it("adapts the safety threshold to the local confidence level", () => {
    for (let i = 0; i < 5; i++) {
      hash.process(makeLandmarks({ visibility: 0.95 }));
    }
    // avg 0.95 * 0.8 = 0.76, floored at 0.45
    expect(hash.getThreshold(0, "x")).toBeCloseTo(0.76, 5);

    hash.reset();
    for (let i = 0; i < 5; i++) {
      hash.process(makeLandmarks({ visibility: 0.6 }));
    }
    // avg 0.6 * 0.8 = 0.48, floored at 0.45
    expect(hash.getThreshold(0, "x")).toBeCloseTo(0.48, 5);
  });

  it("never lets the safety threshold drop below the floor", () => {
    for (let i = 0; i < 20; i++) {
      hash.process(makeLandmarks({ visibility: 0.3 }));
    }
    expect(hash.getThreshold(0, "x")).toBe(0.45);
  });

  it("rejects readings that fall between floor and moving threshold", () => {
    for (let i = 0; i < 5; i++) {
      hash.process(makeLandmarks({ x: 0.5, visibility: 0.9 }));
    }
    // threshold is 0.72; a 0.6-confidence reading must be interpolated
    const frame = makeLandmarks({ x: 1.4, visibility: 0.6 });
    hash.process(frame);
    expect(frame[0].x).not.toBe(1.4);
  });

  it("returns null estimates before a coordinate is ever good", () => {
    const frame = makeLandmarks({ x: 1.2, visibility: 0.1 });
    hash.process(frame);
    expect(hash.getEstimate(0, "x")).toBeNull();
  });

  it("returns an estimate after a good value is seen", () => {
    hash.process(makeLandmarks({ x: 0.5, visibility: 0.9 }));
    expect(hash.getEstimate(0, "x")).toBe(0.5);
  });

  it("reset() clears all tracked entries", () => {
    hash.process(makeLandmarks({ x: 0.5, visibility: 0.9 }));
    hash.reset();
    expect(hash.getEstimate(0, "x")).toBeNull();
    expect(hash.getThreshold(0, "x")).toBe(0.45);
  });
});
