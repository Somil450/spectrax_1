import { describe, it, expect } from 'vitest';
import { aiRoutineGenerator } from '../aiRoutineGenerator';

describe('AIRoutineGeneratorService', () => {
  it('generates a valid custom routine for leg strength goal', () => {
    const routine = aiRoutineGenerator.generateRoutine({
      goal: 'leg_strength',
      targetDurationMinutes: 10,
      difficulty: 'beginner',
    });

    expect(routine.title).toBe('Lower-Body Power Routine');
    expect(routine.steps.length).toBeGreaterThan(1);
    expect(routine.totalCalories).toBeGreaterThan(0);
    expect(routine.estimatedDurationMinutes).toBeGreaterThan(0);
  });

  it('adjusts sets and reps for advanced difficulty level', () => {
    const beginnerRoutine = aiRoutineGenerator.generateRoutine({
      goal: 'full_body',
      targetDurationMinutes: 15,
      difficulty: 'beginner',
    });

    const advancedRoutine = aiRoutineGenerator.generateRoutine({
      goal: 'full_body',
      targetDurationMinutes: 15,
      difficulty: 'advanced',
    });

    const mainBeginnerStep = beginnerRoutine.steps[1];
    const mainAdvancedStep = advancedRoutine.steps[1];

    expect(mainAdvancedStep.sets).toBeGreaterThan(mainBeginnerStep.sets);
    expect(mainAdvancedStep.reps).toBeGreaterThanOrEqual(mainBeginnerStep.reps);
  });
});
