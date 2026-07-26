/**
 * fitnessCalculations.ts
 *
 * Pure, frontend-only fitness calculation utilities.
 * Covers BMI, TDEE (Mifflin-St Jeor), Deficit, and Surplus recommendations.
 * No side-effects — every function is a pure transformation.
 */

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export type Gender = 'male' | 'female';

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';

export type BMICategory =
  | 'Underweight'
  | 'Normal'
  | 'Overweight'
  | 'Obese';

export interface BMIResult {
  bmi: number;
  category: BMICategory;
  /** 0–100 gauge position for UI rendering */
  gaugePercent: number;
}

export interface TDEEResult {
  bmr: number;
  tdee: number;
  activityLabel: string;
}

export interface CalorieRecommendations {
  tdee: number;
  /** Mild cut */
  deficitMild: number;
  /** Aggressive cut */
  deficitAggressive: number;
  /** Lean bulk */
  surplusMild: number;
  /** Standard bulk */
  surplusAggressive: number;
}

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary (little or no exercise)',
  light: 'Light (1–3 days/week)',
  moderate: 'Moderate (3–5 days/week)',
  active: 'Active (6–7 days/week)',
  very_active: 'Very Active (hard exercise + physical job)',
};

export const MIN_SAFE_CALORIES = 1200;

// ─────────────────────────────────────────────────────────────────
// BMI
// ─────────────────────────────────────────────────────────────────

/**
 * Calculate BMI using the standard formula:
 *   BMI = weight(kg) / height(m)²
 */
export function calculateBMI(weightKg: number, heightCm: number): BMIResult {
  const heightM = heightCm / 100;
  const bmi = Number.isFinite(weightKg) && heightM > 0 ? weightKg / (heightM * heightM) : 0;
  const rounded = Math.round(bmi * 10) / 10;

  let category: BMICategory;
  if (bmi < 18.5) category = 'Underweight';
  else if (bmi < 25) category = 'Normal';
  else if (bmi < 30) category = 'Overweight';
  else category = 'Obese';

  // Map BMI 10–45 → 0–100% for gauge
  const gaugePercent = Math.min(100, Math.max(0, ((bmi - 10) / 35) * 100));

  return { bmi: rounded, category, gaugePercent };
}

// ─────────────────────────────────────────────────────────────────
// TDEE — Mifflin-St Jeor
// ─────────────────────────────────────────────────────────────────

/**
 * Calculate BMR using Mifflin-St Jeor equation, then multiply by
 * the activity factor to get TDEE.
 *
 * Male:   BMR = 10w + 6.25h − 5a + 5
 * Female: BMR = 10w + 6.25h − 5a − 161
 */
export function calculateTDEE(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  gender: Gender,
  activityLevel: ActivityLevel,
): TDEEResult {
  const genderOffset = gender === 'male' ? 5 : -161;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + genderOffset;
  const factor = ACTIVITY_FACTORS[activityLevel];
  const tdee = bmr * factor;

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    activityLabel: ACTIVITY_LABELS[activityLevel],
  };
}

// ─────────────────────────────────────────────────────────────────
// CALORIE RECOMMENDATIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Derive deficit and surplus targets from a TDEE value.
 */
export function getCalorieRecommendations(tdee: number): CalorieRecommendations {
  const safeTdee = Number.isFinite(tdee) && tdee > 0 ? tdee : 0;
  return {
    tdee: safeTdee,
    deficitMild: Math.max(MIN_SAFE_CALORIES, safeTdee - 300),
    deficitAggressive: Math.max(MIN_SAFE_CALORIES, safeTdee - 500),
    surplusMild: safeTdee + 300,
    surplusAggressive: safeTdee + 500,
  };
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

/** Return a CSS variable name for the BMI category accent colour */
export function bmiCategoryColor(category: BMICategory): string {
  switch (category) {
    case 'Underweight': return 'var(--neon-cyan)';
    case 'Normal':      return 'var(--neon-green)';
    case 'Overweight':  return 'var(--neon-yellow)';
    case 'Obese':       return 'var(--neon-red)';
  }
}
