import { describe, it, expect } from "vitest";
import { analyzeDifficulty, getExerciseName } from "../difficultyEngine";
import type { WorkoutSession } from "../../useWorkoutHistory";

function session(partial: Partial<WorkoutSession>): WorkoutSession {
  return {
    exerciseType: "squat",
    totalReps: 15,
    accuracyScore: 90,
    duration: 60,
    timestamp: 1_700_000_000_000,
    ...partial,
  };
}

describe("analyzeDifficulty", () => {
  it("recommends progression for consistently strong performers", () => {
    const sessions = [
      session({ timestamp: 100 }),
      session({ timestamp: 200 }),
      session({ timestamp: 300 }),
    ];
    const result = analyzeDifficulty(sessions);
    expect(result).toHaveLength(1);
    expect(result[0].direction).toBe("progression");
    expect(result[0].title).toBe("🚀 Ready for Progression");
    expect(result[0].sessionCount).toBe(3);
  });

  it("recommends regression when form accuracy is low", () => {
    const sessions = [
      session({ accuracyScore: 55, totalReps: 8, timestamp: 100 }),
      session({ accuracyScore: 60, totalReps: 9, timestamp: 200 }),
    ];
    const result = analyzeDifficulty(sessions);
    expect(result).toHaveLength(1);
    expect(result[0].direction).toBe("regression");
    expect(result[0].title).toBe("⚠️ Technique Improvement Suggested");
  });

  it("recommends maintenance for moderate performance", () => {
    const sessions = [
      session({ accuracyScore: 75, timestamp: 100 }),
      session({ accuracyScore: 78, timestamp: 200 }),
    ];
    const result = analyzeDifficulty(sessions);
    expect(result[0].direction).toBe("maintenance");
    expect(result[0].title).toBe("📈 On the Right Track");
  });

  it("requires at least two sessions before assessing an exercise", () => {
    const result = analyzeDifficulty([session({})]);
    expect(result).toHaveLength(0);
  });

  it("skips warmup and cooldown exercises", () => {
    const sessions = [
      session({ exerciseType: "jumping_jack", accuracyScore: 95, timestamp: 100 }),
      session({ exerciseType: "jumping_jack", accuracyScore: 95, timestamp: 200 }),
      session({ exerciseType: "cooldown_stretch", accuracyScore: 95, timestamp: 300 }),
      session({ exerciseType: "cooldown_stretch", accuracyScore: 95, timestamp: 400 }),
    ];
    const result = analyzeDifficulty(sessions);
    expect(result).toHaveLength(0);
  });

  it("flags an improving trend when recent accuracy climbs", () => {
    const sessions = [
      session({ accuracyScore: 60, timestamp: 100 }),
      session({ accuracyScore: 62, timestamp: 200 }),
      session({ accuracyScore: 90, timestamp: 300 }),
      session({ accuracyScore: 92, timestamp: 400 }),
    ];
    const result = analyzeDifficulty(sessions);
    expect(result[0].trend).toBe("improving");
  });

  it("computes completion rate from the routine catalog defaults", () => {
    const lowReps = analyzeDifficulty([
      session({ totalReps: 5, accuracyScore: 85, timestamp: 100 }),
      session({ totalReps: 6, accuracyScore: 85, timestamp: 200 }),
    ]);
    expect(lowReps[0].completionRate).toBeLessThan(0.5);

    const overTarget = analyzeDifficulty([
      session({ totalReps: 30, accuracyScore: 85, timestamp: 100 }),
      session({ totalReps: 30, accuracyScore: 85, timestamp: 200 }),
    ]);
    expect(overTarget[0].completionRate).toBe(1.5);
  });

  it("groups and assesses each exercise independently", () => {
    const sessions = [
      session({ exerciseType: "squat", accuracyScore: 55, timestamp: 100 }),
      session({ exerciseType: "squat", accuracyScore: 55, timestamp: 200 }),
      session({ exerciseType: "pushup", accuracyScore: 92, timestamp: 300 }),
      session({ exerciseType: "pushup", accuracyScore: 92, timestamp: 400 }),
      session({ exerciseType: "pushup", accuracyScore: 92, timestamp: 500 }),
    ];
    const result = analyzeDifficulty(sessions);
    expect(result).toHaveLength(2);
    const squat = result.find((r) => r.exerciseKey === "squat");
    const pushup = result.find((r) => r.exerciseKey === "pushup");
    expect(squat?.direction).toBe("regression");
    expect(pushup?.direction).toBe("progression");
  });

  it("sorts progression assessments before regression ones", () => {
    const sessions = [
      session({ exerciseType: "squat", accuracyScore: 55, timestamp: 100 }),
      session({ exerciseType: "squat", accuracyScore: 55, timestamp: 200 }),
      session({ exerciseType: "pushup", accuracyScore: 92, timestamp: 300 }),
      session({ exerciseType: "pushup", accuracyScore: 92, timestamp: 400 }),
      session({ exerciseType: "pushup", accuracyScore: 92, timestamp: 500 }),
    ];
    const result = analyzeDifficulty(sessions);
    expect(result[0].exerciseKey).toBe("pushup");
    expect(result[1].exerciseKey).toBe("squat");
  });
});

describe("getExerciseName", () => {
  it("returns the catalog name for a known key", () => {
    expect(getExerciseName("squat")).toBe("Bodyweight Squats");
  });

  it("falls back to the key for unknown exercises", () => {
    expect(getExerciseName("unknown_exercise")).toBe("unknown_exercise");
  });
});
