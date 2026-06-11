import { ExerciseStrategy } from './ExerciseStrategy';
import { DefaultStrategy } from './DefaultStrategy';
import { exercisePluginRegistry } from '../../plugins/exercises/ExercisePluginRegistry';

import '../../plugins/exercises/index';

export function getStrategy(configKey: string): ExerciseStrategy {
  if (exercisePluginRegistry.has(configKey)) {
    return exercisePluginRegistry.get(configKey);
  }
  if (configKey === 'chestPressPunches') {
    return new DefaultStrategy(15);
  }
  return new DefaultStrategy(24);
}
