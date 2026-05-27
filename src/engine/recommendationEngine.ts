export interface RecommendationResult {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

export function generateRecommendations(
  score: number,
  mistakes: Record<string, number>,
  bestStreak: number,
  averageRepScore: number,
  exerciseName?: string
): RecommendationResult[] {

  const recommendations: RecommendationResult[] = [];

  // Low accuracy
  if (score < 60) {
    recommendations.push({
      title: "Focus On Form",
      description:
        "Your posture accuracy is currently low. Slow down and prioritize correct movement patterns.",
      priority: "high",
    });
  }

  // Medium accuracy
  if (score >= 60 && score < 80) {
    recommendations.push({
      title: "Improve Consistency",
      description:
        "You're progressing steadily. Focus on smoother and more controlled repetitions.",
      priority: "medium",
    });
  }

  // High accuracy
  if (score >= 80) {
    recommendations.push({
      title: "Increase Difficulty",
      description:
        "Excellent workout performance detected. Consider increasing reps or trying advanced variations.",
      priority: "low",
    });
  }

  // Best streak analysis
  if (bestStreak >= 10) {
    recommendations.push({
      title: "Progressive Overload Ready",
      description:
        "Your consistency streak is impressive. Your body may be ready for higher intensity training.",
      priority: "low",
    });
  }

  // Rep quality analysis
  if (averageRepScore < 70) {
    recommendations.push({
      title: "Improve Rep Quality",
      description:
        "Maintain stable pacing and focus on complete range of motion for better muscle activation.",
      priority: "medium",
    });
  }

  // Mistake analysis
  const mistakeEntries = Object.entries(mistakes);

  if (mistakeEntries.length > 0) {
    const worstMistake = mistakeEntries.sort((a, b) => b[1] - a[1])[0][0];

    recommendations.push({
      title: "Correct Frequent Mistakes",
      description:
        `Most detected issue: ${worstMistake}. Focus on correcting this area during future sessions.`,
      priority: "high",
    });
  }

  // Exercise specific
  if (exerciseName?.toLowerCase().includes("plank")) {
    recommendations.push({
      title: "Core Stability Focus",
      description:
        "Keep your body line stable and engage your core throughout the movement.",
      priority: "medium",
    });
  }

  return recommendations;
}