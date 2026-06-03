import { describe, it, expect, beforeEach } from "vitest";
import { getFeedback, resetFeedbackEngine } from "../feedbackEngine";

beforeEach(() => {
  // Clear smoothing history between every test
  resetFeedbackEngine();
});

describe("getFeedback", () => {
  it("returns good-form result for an unknown exercise key", () => {
    const result = getFeedback({}, "unknownExercise");
    expect(result.score).toBe(100);
    expect(result.color).toBe("green");
    expect(result.message).toBe("Good form ✅");
    expect(result.issues).toHaveLength(0);
  });

  it("returns green and good-form message when no squat rules fire", () => {
    // knee=90 clears the <70 check; no depth issue (stage='up')
    const result = getFeedback({ knee: 90, stage: "up" }, "squat");
    expect(result.color).toBe("green");
    expect(result.message).toBe("Good form ✅");
  });

  it("fires the over-bent-knee warning when knee < 70", () => {
    const result = getFeedback({ knee: 60, stage: "up" }, "squat");
    expect(result.issues).toHaveLength(1);
    expect(result.message).toBe("Don't over-bend knees ⚠️");
    // rawScore = 100 – 35 = 65, smoothed over 1 sample → 65 → yellow
    expect(result.color).toBe("yellow");
  });

  it("returns red when two high-penalty pushup rules fire simultaneously", () => {
    // bodyLine < 135 (–35) + horizontalStretch < 40 (–35) → rawScore 30 → red
    const result = getFeedback(
      { bodyLine: 120, horizontalStretch: 30, stage: "up" },
      "pushup"
    );
    expect(result.color).toBe("red");
    // High-severity issue must be surfaced first
    expect(result.message).toBe("Keep your back straight ❌");
  });

  it("resetFeedbackEngine clears accumulated smoothing history", () => {
    // Prime the history with a perfect score so the average rises
    getFeedback({ knee: 90, stage: "up" }, "squat"); // score 100 → history: [100]

    const beforeReset = getFeedback({ knee: 60, stage: "up" }, "squat");
    // history: [100, 65] → smoothed = 82 → green (>80)
    expect(beforeReset.score).toBe(83);

    resetFeedbackEngine();

    const afterReset = getFeedback({ knee: 60, stage: "up" }, "squat");
    // history: [65] → smoothed = 65 → yellow (<80)
    expect(afterReset.score).toBe(65);
    expect(afterReset.color).toBe("yellow");
  });
});

describe("getFeedback – flutterKicks", () => {
  it("returns green when flutter kick form is correct", () => {
    // knee >= 155 and bodyLine >= 120 → no rules fire → perfect score
    const result = getFeedback({ knee: 170, bodyLine: 150, stage: "up" }, "flutterKicks");
    expect(result.color).toBe("green");
    expect(result.message).toBe("Good form ✅");
    expect(result.issues).toHaveLength(0);
  });

  it("fires knee-bend warning when legs are not straight (knee < 155)", () => {
    const result = getFeedback({ knee: 140, bodyLine: 150, stage: "up" }, "flutterKicks");
    expect(result.issues).toHaveLength(1);
    expect(result.message).toBe("Keep your legs straight ⚠️");
    // rawScore = 100 – 30 = 70 → yellow
    expect(result.color).toBe("yellow");
  });

  it("fires leg-height warning when legs are raised too high (bodyLine < 120)", () => {
    const result = getFeedback({ knee: 170, bodyLine: 100, stage: "up" }, "flutterKicks");
    expect(result.issues).toHaveLength(1);
    expect(result.message).toBe("Keep legs lower for core engagement ⚠️");
    // rawScore = 100 – 25 = 75 → yellow
    expect(result.color).toBe("yellow");
  });

  it("returns red when both knee-bend and leg-height rules fire", () => {
    // knee < 155 (–30) + bodyLine < 120 (–25) → rawScore = 45 → red
    const result = getFeedback({ knee: 130, bodyLine: 100, stage: "up" }, "flutterKicks");
    expect(result.issues).toHaveLength(2);
    expect(result.color).toBe("red");
    expect(result.score).toBeLessThanOrEqual(60);
  });
});

describe("getFeedback – chestPressPunches", () => {
  it("returns green when chest press form is correct", () => {
    const result = getFeedback(
      { shoulder: 80, bodyLine: 165, stage: "down", downAngleReached: 80 },
      "chestPressPunches"
    );
    expect(result.color).toBe("green");
    expect(result.message).toBe("Good form ✅");
    expect(result.issues).toHaveLength(0);
  });

  it("fires arm level warning when arms are too low (shoulder < 65)", () => {
    const result = getFeedback(
      { shoulder: 50, bodyLine: 165, stage: "up" },
      "chestPressPunches"
    );
    expect(result.issues).toHaveLength(1);
    expect(result.message).toBe("Keep arms at shoulder level ⚠️");
    expect(result.color).toBe("yellow");
  });

  it("fires back straight error when body line sag is detected (bodyLine < 155)", () => {
    const result = getFeedback(
      { shoulder: 80, bodyLine: 140, stage: "up" },
      "chestPressPunches"
    );
    expect(result.issues).toHaveLength(1);
    expect(result.message).toBe("Keep your back straight ❌");
    expect(result.color).toBe("yellow");
  });

  it("fires range-of-motion warning when user fails to bring hands back to chest in down stage (downAngleReached > 110)", () => {
    const result = getFeedback(
      { shoulder: 80, bodyLine: 165, stage: "down", downAngleReached: 120 },
      "chestPressPunches"
    );
    expect(result.issues).toHaveLength(1);
    expect(result.message).toBe("Bring hands all the way back to chest ⚠️");
    expect(result.color).toBe("yellow");
  });
});