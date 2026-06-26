import { describe, it, expect } from "vitest";
import { KinematicEngine } from "../kinematicEngine";

function frame(primaryIndex: number, y: number) {
  const landmarks = Array.from({ length: 33 }, (_, i) => ({
    x: 0.5,
    y: i === primaryIndex ? y : 0.5 + (i % 5) * 0.05,
    z: 0,
    visibility: 1,
  }));
  return landmarks as never;
}

describe("KinematicEngine TUT time base", () => {
  it("computes realistic, non-negative TUT durations for a rep", () => {
    const engine = new KinematicEngine();
    const primary = 24;
    // exerciseEngine passes Date.now() to update(); use the same epoch scale here.
    const base = 1_700_000_000_000;

    const ys = [0.5, 0.45, 0.4, 0.35, 0.4, 0.45, 0.5];
    ys.forEach((y, i) => engine.update(frame(primary, y), base + i * 100, primary));
    engine.onRepComplete();

    const tut = engine.getLastRepTUT();
    expect(tut).not.toBeNull();

    // The bug mixed performance.now() (~1e4) with a Date.now()-based phaseStartTime
    // (~1.7e12), so a phase received ~ -1.7e12 ms every rep.
    expect(tut!.eccentricMs).toBeGreaterThanOrEqual(0);
    expect(tut!.concentricMs).toBeGreaterThanOrEqual(0);
    expect(tut!.isometricMs).toBeGreaterThanOrEqual(0);
    expect(tut!.totalRepMs).toBeGreaterThanOrEqual(0);
    // a sub-second rep, not billions of ms
    expect(tut!.totalRepMs).toBeLessThan(10_000);
  });
});
