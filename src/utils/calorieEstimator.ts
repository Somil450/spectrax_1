// src/utils/calorieEstimator.ts

// MET (Metabolic Equivalent of Task) values per exercise type
const MET_VALUES: Record<string, number> = {
  squat: 5.0,
  squats: 5.0,
  pushup: 8.0,
  push_up: 8.0,
  pushups: 8.0,
  plank: 4.0,
  lunge: 6.0,
  lunges: 6.0,
  bicep_curl: 3.5,
  bicep_curls: 3.5,
  shoulder_press: 4.5,
  deadlift: 6.0,
  default: 5.0,
};

export interface CalorieEstimateInput {
  exerciseName: string;   // e.g. "Squat", "Push Up"
  totalReps: number;
  durationSeconds: number;
  accuracyScore: number;  // 0–100, from existing stats
  userWeightKg?: number;  // optional, defaults to 70kg
}

export interface CalorieEstimateResult {
  calories: number;           // estimated kcal burned
  met: number;                // MET value used
  accuracyMultiplier: number; // how accuracy affected the estimate
  label: string;              // e.g. "Great Burn 🔥"
}

/**
 * Estimates calories burned using MET formula adjusted by rep accuracy.
 * Formula: Calories = MET × weight(kg) × duration(hrs) × accuracyMultiplier
 *
 * The accuracy multiplier ranges from 0.7 to 1.0:
 * - 100% accuracy → ×1.0 (full effort, full calorie credit)
 * - 0% accuracy   → ×0.7 (sloppy form = less effective movement)
 */
export function estimateCalories(input: CalorieEstimateInput): CalorieEstimateResult {
  const key = input.exerciseName.toLowerCase().replace(/\s+/g, '_');
  const met = MET_VALUES[key] ?? MET_VALUES['default'];
  const weight = input.userWeightKg ?? 70;
  const hours = input.durationSeconds / 3600;

  // Accuracy multiplier: 0.7 at 0% accuracy, 1.0 at 100% accuracy
  const accuracyMultiplier = parseFloat((0.7 + (input.accuracyScore / 100) * 0.3).toFixed(3));

  const rawCalories = met * weight * hours * accuracyMultiplier;
  const calories = Math.max(1, Math.round(rawCalories));

  let label = 'Solid Burn 💪';
  if (calories >= 200) label = 'Elite Burn 🏆';
  else if (calories >= 100) label = 'Great Burn 🔥';
  else if (calories < 30) label = 'Light Activity 🌱';

  return { calories, met, accuracyMultiplier, label };
}

/**
 * Get user weight from localStorage (set on WelcomeScreen).
 * Returns null if not set.
 */
export function getSavedUserWeight(): number | null {
  const raw = localStorage.getItem('spectrax_user_weight_kg');
  if (!raw) return null;
  const parsed = parseFloat(raw);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Save user weight to localStorage.
 */
export function saveUserWeight(weightKg: number): void {
  localStorage.setItem('spectrax_user_weight_kg', String(weightKg));
}