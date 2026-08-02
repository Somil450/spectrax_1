// src/engine/difficultyEngine.ts
import type { WorkoutSession } from "../useWorkoutHistory";
import { ROUTINE_EXERCISES_CATALOG } from "../config/routineExercises";

export type DifficultyDirection = "progression" | "maintenance" | "regression";
export type DifficultyTrend = "improving" | "steady" | "declining";

export interface DifficultyAssessment {
  exerciseKey: string;
  exerciseName: string;
  direction: DifficultyDirection;
  avgAccuracy: number;
  completionRate: number;
  sessionCount: number;
  consistency: number;
  trend: DifficultyTrend;
  title: string;
  summary: string;
  recommendation: string;
}

const PROGRESSION_THRESHOLDS = {
  minSessions: 3,
  minAvgAccuracy: 85,
  minCompletionRate: 0.9,
  minConsistency: 0.6,
} as const;

const REGRESSION_THRESHOLDS = {
  maxAvgAccuracy: 70,
  maxCompletionRate: 0.7,
} as const;

const ADVANCED_VARIATIONS: Record<string, string> = {
  pushup: "Decline Pushups",
  squat: "Weighted Squats",
  lunges: "Walking Lunges",
  plank: "Side Plank Hold",
  bicep_curl: "Hammer Curls",
  jumping_jack: "Star Jacks",
};

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function completionRateFor(exerciseKey: string, totalReps: number): number {
  const meta = ROUTINE_EXERCISES_CATALOG[exerciseKey];
  if (!meta?.defaultReps) return 1;
  return Math.min(totalReps / meta.defaultReps, 1.5);
}

function computeTrend(accuracyByTime: number[]): DifficultyTrend {
  if (accuracyByTime.length < 2) return "steady";
  const mid = Math.floor(accuracyByTime.length / 2);
  const recent = mean(accuracyByTime.slice(mid));
  const older = mean(accuracyByTime.slice(0, mid));
  if (recent > older + 3) return "improving";
  if (recent < older - 3) return "declining";
  return "steady";
}

function assessDirection(
  assessment: Pick<
    DifficultyAssessment,
    | "avgAccuracy"
    | "completionRate"
    | "sessionCount"
    | "consistency"
    | "trend"
  >
): DifficultyDirection {
  if (
    assessment.sessionCount >= PROGRESSION_THRESHOLDS.minSessions &&
    assessment.avgAccuracy >= PROGRESSION_THRESHOLDS.minAvgAccuracy &&
    assessment.completionRate >= PROGRESSION_THRESHOLDS.minCompletionRate &&
    assessment.consistency >= PROGRESSION_THRESHOLDS.minConsistency &&
    assessment.trend !== "declining"
  ) {
    return "progression";
  }

  if (
    assessment.avgAccuracy < REGRESSION_THRESHOLDS.maxAvgAccuracy ||
    assessment.completionRate < REGRESSION_THRESHOLDS.maxCompletionRate
  ) {
    return "regression";
  }

  return "maintenance";
}

function buildCopy(assessment: DifficultyAssessment): DifficultyAssessment {
  const name = assessment.exerciseName;
  const advanced = ADVANCED_VARIATIONS[assessment.exerciseKey];

  if (assessment.direction === "progression") {
    assessment.title = "🚀 Ready for Progression";
    assessment.summary = `Average Form Score ${Math.round(
      assessment.avgAccuracy
    )}% · ${Math.round(assessment.completionRate * 100)}% Completion · ${
      assessment.sessionCount
    } sessions`;
    assessment.recommendation = advanced
      ? `Move from ${name} to a more advanced variation (e.g. ${advanced}) to keep progressing.`
      : `Increase reps or sets for ${name} to keep challenging your muscles.`;
  } else if (assessment.direction === "regression") {
    assessment.title = "⚠️ Technique Improvement Suggested";
    assessment.summary = `Average Form Score ${Math.round(
      assessment.avgAccuracy
    )}% · ${Math.round(assessment.completionRate * 100)}% Completion`;
    assessment.recommendation = `Continue ${name} and focus on form consistency before progressing.`;
  } else {
    assessment.title = "📈 On the Right Track";
    assessment.summary = `Average Form Score ${Math.round(
      assessment.avgAccuracy
    )}% · ${assessment.sessionCount} sessions`;
    assessment.recommendation = `Keep training ${name} consistently to unlock the next difficulty level.`;
  }

  return assessment;
}

export function getExerciseName(exerciseKey: string): string {
  return ROUTINE_EXERCISES_CATALOG[exerciseKey]?.name ?? exerciseKey;
}

export function analyzeDifficulty(sessions: WorkoutSession[]): DifficultyAssessment[] {
  const byExercise = new Map<string, WorkoutSession[]>();

  for (const session of sessions) {
    const key = session.exerciseType;
    const meta = ROUTINE_EXERCISES_CATALOG[key];
    if (!meta || meta.isWarmup || meta.isCooldown) continue;
    const list = byExercise.get(key) ?? [];
    list.push(session);
    byExercise.set(key, list);
  }

  const assessments: DifficultyAssessment[] = [];

  for (const [key, exerciseSessions] of byExercise) {
    if (exerciseSessions.length < 2) continue;

    const sorted = [...exerciseSessions].sort(
      (a, b) => a.timestamp - b.timestamp
    );
    const avgAccuracy = mean(sorted.map((s) => s.accuracyScore));
    const completionRate = mean(
      sorted.map((s) => completionRateFor(key, s.totalReps))
    );
    const consistency =
      sorted.filter((s) => s.accuracyScore >= 80).length / sorted.length;
    const trend = computeTrend(sorted.map((s) => s.accuracyScore));

    const assessment = buildCopy({
      exerciseKey: key,
      exerciseName: getExerciseName(key),
      direction: assessDirection({
        avgAccuracy,
        completionRate,
        sessionCount: sorted.length,
        consistency,
        trend,
      }),
      avgAccuracy: round1(avgAccuracy),
      completionRate: round1(completionRate),
      sessionCount: sorted.length,
      consistency: round1(consistency),
      trend,
      title: "",
      summary: "",
      recommendation: "",
    });

    assessments.push(assessment);
  }

  return assessments.sort(
    (a, b) =>
      ["progression", "maintenance", "regression"].indexOf(a.direction) -
      ["progression", "maintenance", "regression"].indexOf(b.direction)
  );
}
