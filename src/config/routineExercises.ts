export type MuscleGroup = 'legs' | 'core' | 'upper_body' | 'full_body' | 'cardio';
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export interface RoutineExerciseMetadata {
  key: string;
  name: string;
  muscleGroup: MuscleGroup;
  difficulty: DifficultyLevel;
  avgSecsPerRep: number;
  caloriesPerRep: number;
  defaultReps: number;
  defaultRestSecs: number;
  instructions: string;
  isWarmup?: boolean;
  isCooldown?: boolean;
}

export const ROUTINE_EXERCISES_CATALOG: Record<string, RoutineExerciseMetadata> = {
  jumping_jack: {
    key: 'jumping_jack',
    name: 'Jumping Jacks',
    muscleGroup: 'cardio',
    difficulty: 'beginner',
    avgSecsPerRep: 1.5,
    caloriesPerRep: 0.2,
    defaultReps: 20,
    defaultRestSecs: 15,
    instructions: 'Jump feet wide while raising arms overhead, then return.',
    isWarmup: true,
  },
  squat: {
    key: 'squat',
    name: 'Bodyweight Squats',
    muscleGroup: 'legs',
    difficulty: 'beginner',
    avgSecsPerRep: 2.5,
    caloriesPerRep: 0.35,
    defaultReps: 15,
    defaultRestSecs: 20,
    instructions: 'Lower hips until thighs are parallel to the floor, then drive up through heels.',
  },
  pushup: {
    key: 'pushup',
    name: 'Standard Pushups',
    muscleGroup: 'upper_body',
    difficulty: 'intermediate',
    avgSecsPerRep: 2.0,
    caloriesPerRep: 0.4,
    defaultReps: 12,
    defaultRestSecs: 30,
    instructions: 'Keep body in a straight plank line and lower chest to floor.',
  },
  bicep_curl: {
    key: 'bicep_curl',
    name: 'Bicep Curls',
    muscleGroup: 'upper_body',
    difficulty: 'beginner',
    avgSecsPerRep: 2.0,
    caloriesPerRep: 0.25,
    defaultReps: 12,
    defaultRestSecs: 20,
    instructions: 'Keep elbows tucked to sides and curl hands upward with control.',
  },
  lunges: {
    key: 'lunges',
    name: 'Forward Lunges',
    muscleGroup: 'legs',
    difficulty: 'intermediate',
    avgSecsPerRep: 3.0,
    caloriesPerRep: 0.45,
    defaultReps: 10,
    defaultRestSecs: 25,
    instructions: 'Step forward into 90-degree knee bend, then push back to start.',
  },
  plank: {
    key: 'plank',
    name: 'Core Plank Hold',
    muscleGroup: 'core',
    difficulty: 'beginner',
    avgSecsPerRep: 1.0,
    caloriesPerRep: 0.15,
    defaultReps: 30,
    defaultRestSecs: 20,
    instructions: 'Hold forearm plank position with tight abs and flat back.',
  },
  cooldown_stretch: {
    key: 'cooldown_stretch',
    name: 'Full Body Cooldown Stretch',
    muscleGroup: 'full_body',
    difficulty: 'beginner',
    avgSecsPerRep: 1.0,
    caloriesPerRep: 0.05,
    defaultReps: 30,
    defaultRestSecs: 10,
    instructions: 'Slow deep breathing with gentle leg and shoulder stretches.',
    isCooldown: true,
  },
};
