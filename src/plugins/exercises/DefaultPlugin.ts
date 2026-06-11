import { ExerciseContext, RepCompletionResult } from './IExercisePlugin';
import { BaseExercisePlugin } from './BaseExercisePlugin';
import { exercisePluginRegistry } from './ExercisePluginRegistry';

export class DefaultPlugin extends BaseExercisePlugin {
  readonly id = 'default';
  readonly name = 'Default';
  readonly description = 'Fallback exercise plugin for unrecognized exercises';
  readonly configKey = 'default';

  constructor(primaryJointIndex: number = 24) {
    super(primaryJointIndex);
  }
}

exercisePluginRegistry.register(new DefaultPlugin(24));
