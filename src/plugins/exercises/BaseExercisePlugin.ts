import { IExercisePlugin, ExerciseContext, RepCompletionResult } from './IExercisePlugin';
import { EngineState } from '../../services/exerciseEngine';

export abstract class BaseExercisePlugin implements IExercisePlugin {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly configKey: string;

  protected primaryJointIndex: number;

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
  }

  getWristSupinationScore(_landmarks?: any[]): number {
    return NaN;
  }
}
