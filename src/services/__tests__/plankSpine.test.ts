import {
  computePlankSpineRegression,
  initialPlankSpineState,
  updatePlankSpineState,
  PlankSpineState,
} from "../exerciseEngine";

interface Pt {
  x: number;
  y: number;
  visibility?: number;
}

function makeLandmarks(pts: { s: Pt; h: Pt; k: Pt }): Pt[] {
  const lms: Pt[] = [];
  for (let i = 0; i < 33; i++) lms.push({ x: 0, y: 0 });
  // shoulders 11/12, hips 23/24, knees 25/26
  lms[11] = { ...pts.s, x: pts.s.x - 0.05 };
  lms[12] = { ...pts.s, x: pts.s.x + 0.05 };
  lms[23] = { ...pts.h, x: pts.h.x - 0.06 };
  lms[24] = { ...pts.h, x: pts.h.x + 0.06 };
  lms[25] = { ...pts.k, x: pts.k.x - 0.06 };
  lms[26] = { ...pts.k, x: pts.k.x + 0.06 };
  return lms;
}

describe("computePlankSpineRegression", () => {
  it("returns 0 for missing landmarks", () => {
    expect(computePlankSpineRegression(undefined)).toBe(0);
    expect(computePlankSpineRegression([])).toBe(0);
  });

  it("returns ~0 for a straight plank line", () => {
    const straight = makeLandmarks({
      s: { x: 0.3, y: 0.4 },
      h: { x: 0.5, y: 0.4 },
      k: { x: 0.7, y: 0.4 },
    });
    expect(Math.abs(computePlankSpineRegression(straight))).toBeLessThan(0.01);
  });

  it("returns a positive residual for sagging hips", () => {
    const sagging = makeLandmarks({
      s: { x: 0.3, y: 0.4 },
      h: { x: 0.5, y: 0.55 },
      k: { x: 0.7, y: 0.4 },
    });
    expect(computePlankSpineRegression(sagging)).toBeGreaterThan(0.05);
  });

  it("returns a negative residual for hyperextended hips", () => {
    const hyper = makeLandmarks({
      s: { x: 0.3, y: 0.4 },
      h: { x: 0.5, y: 0.25 },
      k: { x: 0.7, y: 0.4 },
    });
    expect(computePlankSpineRegression(hyper)).toBeLessThan(-0.05);
  });
});

describe("updatePlankSpineState", () => {
  let state: PlankSpineState;

  beforeEach(() => {
    state = initialPlankSpineState();
  });

  it("ignores updates for non-plank exercises", () => {
    const next = updatePlankSpineState(state, 0.3, false);
    expect(next).toBe(state);
  });

  it("calibrates baseline over 30 frames", () => {
    for (let i = 0; i < 30; i++) {
      state = updatePlankSpineState(state, 0.05, true);
    }
    expect(state.isCalibrated).toBe(true);
    expect(state.calibrationFrames).toBe(30);
    expect(state.baselineDeviation).toBeCloseTo(0.05, 6);
  });

  it("flags sagging only past ±12% beyond baseline", () => {
    for (let i = 0; i < 30; i++) {
      state = updatePlankSpineState(state, 0.05, true);
    }
    // Deviation grows 10% past baseline → still ok
    state = updatePlankSpineState(state, 0.055, true);
    expect(state.status).toBe("ok");
    // Deviation grows 40% past baseline → sagging
    state = updatePlankSpineState(state, 0.07, true);
    expect(state.status).toBe("sagging");
    expect(state.deviationPct).toBeGreaterThan(12);
  });

  it("flags hyperextension for negative deviation past threshold", () => {
    for (let i = 0; i < 30; i++) {
      state = updatePlankSpineState(state, 0.05, true);
    }
    state = updatePlankSpineState(state, -0.06, true);
    expect(state.status).toBe("hyperextension");
  });

  it("reports current deviation and percent while calibrated", () => {
    for (let i = 0; i < 30; i++) {
      state = updatePlankSpineState(state, 0.05, true);
    }
    const next = updatePlankSpineState(state, 0.08, true);
    expect(next.currentDeviation).toBe(0.08);
    expect(next.deviationPct).toBeCloseTo(((0.08 - 0.05) / 0.05) * 100, 1);
  });

  it("returns a fresh state object from initializer", () => {
    expect(initialPlankSpineState()).toEqual({
      isCalibrated: false,
      calibrationFrames: 0,
      baselineDeviation: 0,
      currentDeviation: 0,
      deviationPct: 0,
      status: "ok",
    });
  });
});
