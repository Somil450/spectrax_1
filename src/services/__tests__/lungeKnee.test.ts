import {
  computeLungeKneeOverToe,
  initialLungeKneeState,
  LungeKneeState,
} from "../exerciseEngine";

interface Pt {
  x: number;
  y: number;
}

function makeLandmarks(pts: {
  kneeL?: Pt;
  kneeR?: Pt;
  toeL?: Pt;
  toeR?: Pt;
  heelL?: Pt;
  heelR?: Pt;
}): Pt[] {
  const lms: Pt[] = [];
  for (let i = 0; i < 33; i++) lms.push({ x: 0.5, y: 0.5 });
  // 25/26 knees, 29/30 toes, 31/32 heels
  lms[25] = pts.kneeL ?? { x: 0.3, y: 0.4 };
  lms[26] = pts.kneeR ?? { x: 0.7, y: 0.4 };
  lms[29] = pts.toeL ?? { x: 0.4, y: 0.6 };
  lms[30] = pts.toeR ?? { x: 0.6, y: 0.6 };
  lms[31] = pts.heelL ?? { x: 0.2, y: 0.6 };
  lms[32] = pts.heelR ?? { x: 0.8, y: 0.6 };
  return lms;
}

describe("computeLungeKneeOverToe", () => {
  it("returns a safe default for missing landmarks", () => {
    expect(computeLungeKneeOverToe(undefined)).toEqual(initialLungeKneeState());
    expect(computeLungeKneeOverToe([])).toEqual(initialLungeKneeState());
  });

  it("does not flag when knees stay behind their toes", () => {
    // Left leg: toe at 0.4, heel 0.2 → forward +x; knee 0.3 is behind toe
    const state = computeLungeKneeOverToe(makeLandmarks({}));
    expect(state.kneePastToes).toBe(0);
    expect(state.excess).toBe(0);
  });

  it("flags when the front knee extends past the toe along +x", () => {
    // Left toe 0.4, heel 0.2 → forward +x; knee 0.5 is 0.1 past the toe
    const state = computeLungeKneeOverToe(
      makeLandmarks({ kneeL: { x: 0.5, y: 0.4 } }),
    );
    expect(state.kneePastToes).toBe(1);
    expect(state.overshootsLeft).toBe(true);
    expect(state.excess).toBeGreaterThan(0.025);
    expect(state.frontLeg).toBe("left");
  });

  it("flags when the front knee extends past the toe along -x (mirrored lunge)", () => {
    // Right toe 0.4, heel 0.6 → forward -x; knee 0.3 is 0.1 past the toe
    const state = computeLungeKneeOverToe(
      makeLandmarks({
        toeR: { x: 0.4, y: 0.6 },
        heelR: { x: 0.6, y: 0.6 },
        kneeR: { x: 0.3, y: 0.4 },
      }),
    );
    expect(state.kneePastToes).toBe(1);
    expect(state.overshootsRight).toBe(true);
    expect(state.frontLeg).toBe("right");
  });

  it("does not flag when the knee is only marginally past the toe", () => {
    // Knee 0.015 past toe, below the 0.025 margin
    const state = computeLungeKneeOverToe(
      makeLandmarks({ kneeL: { x: 0.415, y: 0.4 } }),
    );
    expect(state.kneePastToes).toBe(0);
  });

  it("ignores feet pointing toward the camera (no horizontal direction)", () => {
    // toe.x ≈ heel.x → ambiguous forward direction → no flag
    const state = computeLungeKneeOverToe(
      makeLandmarks({
        toeL: { x: 0.4, y: 0.6 },
        heelL: { x: 0.4005, y: 0.6 },
        kneeL: { x: 0.7, y: 0.4 },
      }),
    );
    expect(state.kneePastToes).toBe(0);
  });

  it("flags both legs when both overshoot", () => {
    const state = computeLungeKneeOverToe(
      makeLandmarks({
        kneeL: { x: 0.5, y: 0.4 },
        kneeR: { x: 0.5, y: 0.4 },
      }),
    );
    expect(state.kneePastToes).toBe(1);
    expect(state.overshootsLeft).toBe(true);
    expect(state.overshootsRight).toBe(true);
    expect(state.frontLeg).toBe("left");
  });

  it("returns a fresh safe default from initializer", () => {
    expect(initialLungeKneeState()).toEqual({
      kneePastToes: 0,
      excess: 0,
      frontLeg: "none",
      overshootsLeft: false,
      overshootsRight: false,
    } as LungeKneeState);
  });
});
