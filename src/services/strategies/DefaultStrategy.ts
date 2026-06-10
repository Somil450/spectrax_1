import { ExerciseContext, ExerciseStrategy, RepCompletionResult } from './ExerciseStrategy';
import { EngineState } from '../exerciseEngine';

export class DefaultStrategy implements ExerciseStrategy {
  private primaryJointIndex: number;

  constructor(primaryJointIndex: number = 24) {
    this.primaryJointIndex = primaryJointIndex;
  }

  getPrimaryJointIndex(): number {
    return this.primaryJointIndex;
  }

  getLiveFeedback(_context: ExerciseContext): string | undefined {
    return undefined;
  }

  onRepComplete(_context: ExerciseContext): RepCompletionResult | undefined {
    return undefined;
  }

  updateCustomState(_context: ExerciseContext, _nextState: Partial<EngineState>): void {
    // No custom state to update for default strategy
  }

  getWristSupinationScore(_landmarks?: any[]): number {
    return NaN;
  }
}
