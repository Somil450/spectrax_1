export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  criteriaType: 'reps' | 'workouts' | 'accuracy' | 'streak' | 'time';
  targetValue: number;
}

/** Stored in localStorage — includes the unlock timestamp */
export interface EarnedBadge {
  id: string;
  unlockedAt: string; // ISO date string
}
