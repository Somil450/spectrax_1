export type IntensityLevel = 'LOW' | 'MODERATE' | 'HIGH';

/**
 * Standard MET (Metabolic Equivalent of Task) values */
export const EXERCISE_METS: Record<string, Record<IntensityLevel, number>> = {
  SQUATS: { LOW: 3.5, MODERATE: 5.0, HIGH: 8.0 },
  JUMPING_JACKS: { LOW: 4.0, MODERATE: 7.5, HIGH: 11.0 },
  HIIT_RUN: { LOW: 6.0, MODERATE: 10.0, HIGH: 15.0 },
  
};

/**
 * Incremental calorie calculation per elapsed second.
 * Formula: Calories = MET * Weight (kg) * Time (hours)
 * Time in hours = seconds / 3600
 */
export function calculateIncrementalCalories(
  met: number,
  weightKg: number,
  secondsElapsed: number = 1
): number {
  return met * weightKg * (secondsElapsed / 3600);
}