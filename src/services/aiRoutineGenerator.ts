import {
  ROUTINE_EXERCISES_CATALOG,
  RoutineExerciseMetadata,
  MuscleGroup,
  DifficultyLevel,
} from '../config/routineExercises';

export type UserGoal = 'fat_loss' | 'leg_strength' | 'upper_strength' | 'core_stability' | 'full_body';

export interface RoutineStep {
  exercise: RoutineExerciseMetadata;
  reps: number;
  sets: number;
  restSecs: number;
  estimatedSecs: number;
}

export interface GeneratedRoutine {
  id: string;
  title: string;
  description: string;
  goal: UserGoal;
  difficulty: DifficultyLevel;
  targetDurationMinutes: number;
  estimatedDurationMinutes: number;
  totalCalories: number;
  steps: RoutineStep[];
}

export interface RoutineGeneratorParams {
  goal: UserGoal;
  targetDurationMinutes: number; // e.g. 5, 10, 15, 20
  difficulty: DifficultyLevel;
}

export class AIRoutineGeneratorService {
  generateRoutine(params: RoutineGeneratorParams): GeneratedRoutine {
    const { goal, targetDurationMinutes, difficulty } = params;
    const catalog = Object.values(ROUTINE_EXERCISES_CATALOG);

    // 1. Filter main exercises based on goal and difficulty
    let targetMuscleGroups: MuscleGroup[] = ['full_body'];
    if (goal === 'leg_strength') targetMuscleGroups = ['legs', 'full_body'];
    else if (goal === 'upper_strength') targetMuscleGroups = ['upper_body', 'full_body'];
    else if (goal === 'core_stability') targetMuscleGroups = ['core', 'full_body'];
    else if (goal === 'fat_loss') targetMuscleGroups = ['cardio', 'legs', 'full_body'];

    const warmupEx = catalog.find((e) => e.isWarmup) || catalog[0];
    const cooldownEx = catalog.find((e) => e.isCooldown) || catalog[catalog.length - 1];

    const mainPool = catalog.filter((e) => !e.isWarmup && !e.isCooldown);
    const selectedMain = mainPool.filter(
      (e) => targetMuscleGroups.includes(e.muscleGroup) || targetMuscleGroups.includes('full_body')
    );

    const mainExercises = selectedMain.length > 0 ? selectedMain : mainPool;

    // 2. Adjust sets & reps multiplier according to difficulty
    let setMultiplier = 1;
    let repMultiplier = 1.0;
    if (difficulty === 'intermediate') {
      setMultiplier = 2;
      repMultiplier = 1.2;
    } else if (difficulty === 'advanced') {
      setMultiplier = 3;
      repMultiplier = 1.5;
    }

    const steps: RoutineStep[] = [];
    let accumulatedSecs = 0;
    let totalCalories = 0;

    // Add Warmup step
    const warmupReps = Math.round(warmupEx.defaultReps * repMultiplier);
    const warmupSecs = (warmupReps * warmupEx.avgSecsPerRep) + warmupEx.defaultRestSecs;
    steps.push({
      exercise: warmupEx,
      reps: warmupReps,
      sets: 1,
      restSecs: warmupEx.defaultRestSecs,
      estimatedSecs: warmupSecs,
    });
    accumulatedSecs += warmupSecs;
    totalCalories += warmupReps * warmupEx.caloriesPerRep;

    // Add Main Exercise steps until target duration is reached
    const maxTargetSecs = targetDurationMinutes * 60;
    let exIndex = 0;

    while (accumulatedSecs < maxTargetSecs - 60 && exIndex < mainExercises.length * 3) {
      const currentEx = mainExercises[exIndex % mainExercises.length];
      const reps = Math.round(currentEx.defaultReps * repMultiplier);
      const sets = setMultiplier;
      const stepSecs = sets * (reps * currentEx.avgSecsPerRep + currentEx.defaultRestSecs);

      steps.push({
        exercise: currentEx,
        reps,
        sets,
        restSecs: currentEx.defaultRestSecs,
        estimatedSecs: stepSecs,
      });

      accumulatedSecs += stepSecs;
      totalCalories += sets * reps * currentEx.caloriesPerRep;
      exIndex++;
    }

    // Add Cooldown step
    const cooldownSecs = cooldownEx.defaultReps * cooldownEx.avgSecsPerRep;
    steps.push({
      exercise: cooldownEx,
      reps: cooldownEx.defaultReps,
      sets: 1,
      restSecs: 0,
      estimatedSecs: cooldownSecs,
    });
    accumulatedSecs += cooldownSecs;
    totalCalories += cooldownEx.defaultReps * cooldownEx.caloriesPerRep;

    const estimatedDurationMinutes = Math.max(1, Math.round(accumulatedSecs / 60));

    const goalTitles: Record<UserGoal, string> = {
      fat_loss: 'High-Intensity Fat Burner',
      leg_strength: 'Lower-Body Power Routine',
      upper_strength: 'Upper-Body Sculpt Routine',
      core_stability: 'Core & Pillar Stability',
      full_body: 'Full-Body Conditioning Workout',
    };

    return {
      id: `routine_${Date.now()}`,
      title: goalTitles[goal] || 'Custom AI Workout',
      description: `Tailored ${estimatedDurationMinutes}-minute ${difficulty} routine optimized for ${goal.replace('_', ' ')}.`,
      goal,
      difficulty,
      targetDurationMinutes,
      estimatedDurationMinutes,
      totalCalories: Math.round(totalCalories),
      steps,
    };
  }
}

export const aiRoutineGenerator = new AIRoutineGeneratorService();
