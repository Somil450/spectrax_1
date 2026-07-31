const {
  generateFeedback,
} = require("../../../../src/modules/pose/feedback.service");

describe("feedback.service", () => {
  it("returns acquisition feedback when no angles are available", () => {
    expect(generateFeedback({}, "squat")).toEqual({
      status: "yellow",
      message: "Acquiring pose...",
      corrections: [],
    });
  });

  it("returns acquisition feedback when all angle values are missing", () => {
    expect(
      generateFeedback(
        { knee: null, elbow: undefined, shoulder: null, bodyLine: undefined },
        "squat",
      ),
    ).toEqual({
      status: "yellow",
      message: "Acquiring pose...",
      corrections: [],
    });
  });

  it("returns green feedback for a clean squat frame", () => {
    expect(
      generateFeedback(
        { knee: 120, elbow: 90, shoulder: 10, bodyLine: 170, hipDepth: 40 },
        "squat",
      ),
    ).toEqual({
      status: "green",
      message: "Good form ✅",
      corrections: [],
    });
  });

  it("returns prioritized corrections for a poor pushup frame", () => {
    expect(
      generateFeedback(
        { knee: 120, elbow: 170, shoulder: 40, bodyLine: 140, hipDepth: 30 },
        "pushup",
      ),
    ).toEqual({
      status: "red",
      message: "Lower your chest to the ground",
      corrections: [
        "Lower your chest to the ground",
        "Keep your body in a straight line",
      ],
    });
  });

  it("skips correction checks for missing angle entries", () => {
    expect(
      generateFeedback(
        {
          knee: 120,
          elbow: 170,
          shoulder: null,
          bodyLine: undefined,
          hipDepth: 30,
        },
        "pushup",
      ),
    ).toEqual({
      status: "yellow",
      message: "Lower your chest to the ground",
      corrections: ["Lower your chest to the ground"],
    });
  });

  it("returns green feedback for a clean lunge frame", () => {
    expect(
      generateFeedback(
        { knee: 95, elbow: 90, shoulder: 15, bodyLine: 165, hipDepth: 130 },
        "lunge",
      ),
    ).toEqual({
      status: "green",
      message: "Good form ✅",
      corrections: [],
    });
  });

  it("returns red feedback when multiple lunge checks fail", () => {
    expect(
      generateFeedback(
        { knee: 70, elbow: 90, shoulder: 20, bodyLine: 140, hipDepth: 90 },
        "lunge",
      ),
    ).toEqual({
      status: "red",
      message: "Do not let knee pass your toes",
      corrections: [
        "Do not let knee pass your toes",
        "Keep your torso upright",
        "Lower your hips for a deeper lunge",
      ],
    });
  });

  it("returns yellow feedback when a single lunge check fails", () => {
    expect(
      generateFeedback(
        { knee: 70, elbow: 90, shoulder: 20, bodyLine: 165, hipDepth: 130 },
        "lunge",
      ),
    ).toEqual({
      status: "yellow",
      message: "Do not let knee pass your toes",
      corrections: ["Do not let knee pass your toes"],
    });
  });
});
