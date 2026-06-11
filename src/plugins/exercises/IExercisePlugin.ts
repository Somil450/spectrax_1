import { ExerciseStrategy, ExerciseContext, RepCompletionResult } from '../../services/strategies/ExerciseStrategy';

export interface IExercisePlugin extends ExerciseStrategy {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly configKey: string;
}

export { ExerciseContext, RepCompletionResult };
