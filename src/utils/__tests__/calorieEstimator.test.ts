import { describe, it, expect } from "vitest";
import { estimateCalories } from "../calorieEstimator";

const base = {
  exerciseName: "Squat",
  totalReps: 30,
  durationSeconds: 60,
  accuracyScore: 100,
  userWeightKg: 70,
};

describe("estimateCalories", () => {
  it("scales with reps for a fixed exercise, weight, and duration", () => {
    const few = estimateCalories({ ...base, totalReps: 10 });
    const many = estimateCalories({ ...base, totalReps: 30 });
    expect(many.calories).toBeGreaterThan(few.calories);
  });

  it("uses 1.5 kcal/rep for a default-intensity exercise at the reference weight", () => {
    const result = estimateCalories(base);
    expect(result.calories).toBe(45); // 30 reps * 1.5 * (5/5) * (70/70) * 1.0
  });

  it("credits higher-MET exercises more for the same reps", () => {
    const pushup = estimateCalories({ ...base, exerciseName: "Push Up", durationSeconds: 30 });
    const curl = estimateCalories({ ...base, exerciseName: "Bicep Curl", durationSeconds: 30 });
    expect(pushup.calories).toBeGreaterThan(curl.calories);
  });

  it("scales with body weight", () => {
    const heavier = estimateCalories({ ...base, userWeightKg: 100 });
    const lighter = estimateCalories({ ...base, userWeightKg: 70 });
    expect(heavier.calories).toBeGreaterThan(lighter.calories);
  });

  it("applies the accuracy multiplier", () => {
    const sloppy = estimateCalories({ ...base, accuracyScore: 0 });
    const clean = estimateCalories({ ...base, accuracyScore: 100 });
    expect(clean.calories).toBeGreaterThan(sloppy.calories);
  });

  it("falls back to the duration term for isometric holds with no reps", () => {
    const plank = estimateCalories({
      exerciseName: "Plank",
      totalReps: 0,
      durationSeconds: 120,
      accuracyScore: 100,
      userWeightKg: 70,
    });
    expect(plank.calories).toBe(9); // 4 * 70 * (120/3600)
  });

  it("never returns less than 1 calorie", () => {
    const result = estimateCalories({
      exerciseName: "Squat",
      totalReps: 0,
      durationSeconds: 0,
      accuracyScore: 100,
      userWeightKg: 70,
    });
    expect(result.calories).toBe(1);
  });

  it("uses the default MET for an unknown exercise", () => {
    const result = estimateCalories({ ...base, exerciseName: "Burpee" });
    expect(result.met).toBe(5.0);
    expect(result.calories).toBe(45);
  });

  it("treats a non-finite rep count as zero work", () => {
    const result = estimateCalories({ ...base, totalReps: NaN, durationSeconds: 60 });
    expect(Number.isFinite(result.calories)).toBe(true);
    expect(result.calories).toBeGreaterThanOrEqual(1);
  });
});
