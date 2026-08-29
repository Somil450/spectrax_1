import { VelocityProfiler, classifyTempo } from "./velocityProfiler";

describe("classifyTempo", () => {
  it("classifies slow below the slow ratio of baseline", () => {
    expect(classifyTempo(0.2, 1.0)).toBe("slow");
  });

  it("classifies fast above the fast ratio of baseline", () => {
    expect(classifyTempo(1.3, 1.0)).toBe("fast");
  });

  it("classifies moderate in between", () => {
    expect(classifyTempo(0.8, 1.0)).toBe("moderate");
  });

  it("uses absolute bands before baseline calibration", () => {
    expect(classifyTempo(1.5, 0)).toBe("fast");
    expect(classifyTempo(0.1, 0)).toBe("slow");
    expect(classifyTempo(0.5, 0)).toBe("moderate");
  });
});

describe("VelocityProfiler", () => {
  let profiler: VelocityProfiler;

  beforeEach(() => {
    profiler = new VelocityProfiler();
  });

  it("starts empty with no deceleration", () => {
    const profile = profiler.getProfile();
    expect(profile.samples).toBe(0);
    expect(profile.curve).toEqual([]);
    expect(profile.tempo).toBe("slow");
    expect(profile.decelerating).toBe(false);
    expect(profile.pacing).toBe("steady");
  });

  it("ignores invalid samples", () => {
    profiler.addSample(NaN);
    profiler.addSample(-1);
    profiler.addSample(Infinity);
    expect(profiler.getProfile().samples).toBe(0);
  });

  it("tracks the rolling velocity curve with a bounded size", () => {
    for (let i = 0; i < 100; i++) {
      profiler.addSample(i % 2);
    }
    const profile = profiler.getProfile();
    expect(profile.curve.length).toBe(30);
    expect(profile.currentSpeed).toBe(profile.curve[profile.curve.length - 1]);
  });

  it("calibrates baseline from the first rep peaks then classifies tempo", () => {
    // Rep 1-3: peak ~1.0 → baseline builds
    for (let rep = 0; rep < 3; rep++) {
      for (let i = 0; i < 10; i++) {
        profiler.addSample(1.0);
      }
      profiler.onRepComplete();
    }

    // Rep 4 at half speed → slow vs baseline 1.0
    for (let i = 0; i < 10; i++) {
      profiler.addSample(0.5);
    }
    expect(profiler.getProfile().tempo).toBe("slow");
    expect(profiler.getProfile().baselineSpeed).toBeCloseTo(1.0, 1);
  });

  it("detects deceleration when the current rep's velocity collapses", () => {
    for (let i = 0; i < 10; i++) {
      profiler.addSample(1.0);
    }
    for (let i = 0; i < 6; i++) {
      profiler.addSample(0.2);
    }

    const profile = profiler.getProfile();
    expect(profile.decelerating).toBe(true);
    expect(profile.decelerationPct).toBeGreaterThan(30);
  });

  it("does not flag deceleration on steady velocity", () => {
    for (let i = 0; i < 20; i++) {
      profiler.addSample(0.9);
    }
    expect(profiler.getProfile().decelerating).toBe(false);
  });

  it("flags erratic pacing for high-variance motion", () => {
    for (let i = 0; i < 12; i++) {
      profiler.addSample(i % 2 === 0 ? 1.0 : 0.05);
    }
    expect(profiler.getProfile().pacing).toBe("erratic");
  });

  it("flags steady pacing for consistent motion", () => {
    for (let i = 0; i < 12; i++) {
      profiler.addSample(0.9 + (i % 3) * 0.05);
    }
    expect(profiler.getProfile().pacing).toBe("steady");
  });

  it("onRepComplete resets rep peak but keeps session baseline", () => {
    for (let i = 0; i < 10; i++) {
      profiler.addSample(1.0);
    }
    profiler.onRepComplete();

    for (let i = 0; i < 10; i++) {
      profiler.addSample(1.0);
    }
    profiler.onRepComplete();
    expect(profiler.getProfile().baselineSpeed).toBeCloseTo(1.0, 1);

    // A new rep starts fresh: rep peak falls back to the rolling curve max
    expect(profiler.getProfile().peakSpeed).toBeCloseTo(1.0, 1);
  });

  it("reset clears all state", () => {
    for (let i = 0; i < 10; i++) {
      profiler.addSample(0.8);
    }
    profiler.onRepComplete();
    profiler.reset();

    const profile = profiler.getProfile();
    expect(profile.samples).toBe(0);
    expect(profile.baselineSpeed).toBe(0);
    expect(profile.curve).toEqual([]);
  });
});
