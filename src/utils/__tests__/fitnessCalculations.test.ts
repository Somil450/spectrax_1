import { describe, it, expect } from "vitest";
import {
  calculateBMI,
  getCalorieRecommendations,
  MIN_SAFE_CALORIES,
} from "../fitnessCalculations";

describe("calculateBMI", () => {
  it("computes a normal BMI", () => {
    const result = calculateBMI(70, 175);
    expect(result.bmi).toBe(22.9);
    expect(result.category).toBe("Normal");
  });

  it("returns a finite value when height is zero instead of Infinity", () => {
    const result = calculateBMI(70, 0);
    expect(Number.isFinite(result.bmi)).toBe(true);
    expect(Number.isFinite(result.gaugePercent)).toBe(true);
  });

  it("returns a finite value when inputs are not numbers", () => {
    const result = calculateBMI(NaN, NaN);
    expect(Number.isFinite(result.bmi)).toBe(true);
    expect(Number.isFinite(result.gaugePercent)).toBe(true);
  });
});

describe("getCalorieRecommendations", () => {
  it("leaves deficits unchanged when they stay above the safe floor", () => {
    const recs = getCalorieRecommendations(2500);
    expect(recs.deficitMild).toBe(2200);
    expect(recs.deficitAggressive).toBe(2000);
  });

  it("clamps deficits to the safe minimum for a low TDEE", () => {
    const recs = getCalorieRecommendations(1400);
    expect(recs.deficitMild).toBe(MIN_SAFE_CALORIES);
    expect(recs.deficitAggressive).toBe(MIN_SAFE_CALORIES);
    expect(recs.deficitAggressive).toBeGreaterThanOrEqual(MIN_SAFE_CALORIES);
  });

  it("returns finite values when TDEE is not a number", () => {
    const recs = getCalorieRecommendations(NaN);
    expect(Number.isFinite(recs.tdee)).toBe(true);
    expect(Number.isFinite(recs.deficitMild)).toBe(true);
    expect(Number.isFinite(recs.surplusMild)).toBe(true);
  });
});
