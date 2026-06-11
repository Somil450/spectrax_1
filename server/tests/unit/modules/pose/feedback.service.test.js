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

  it("returns green feedback for a clean flutterKicks frame", () => {
    expect(
      generateFeedback(
        { knee: 160, elbow: 170, shoulder: 10, bodyLine: 130 },
        "flutterKicks",
      ),
    ).toEqual({
      status: "green",
      message: "Good form ✅",
      corrections: [],
    });
  });

  it("returns warnings for bent knees in flutterKicks", () => {
    expect(
      generateFeedback({ knee: 140, bodyLine: 130 }, "flutterKicks"),
    ).toEqual({
      status: "yellow",
      message: "Keep your legs straight",
      corrections: ["Keep your legs straight"],
    });
  });

  it("returns red status when both flutterKicks thresholds are violated", () => {
    expect(
      generateFeedback({ knee: 140, bodyLine: 110 }, "flutterKicks"),
    ).toEqual({
      status: "red",
      message: "Keep your legs straight",
      corrections: ["Keep your legs straight", "Keep legs lower for core engagement"],
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
});
