import { BaseExercisePlugin } from './BaseExercisePlugin';
import { exercisePluginRegistry } from './ExercisePluginRegistry';
import { getSupinationScore } from '../../services/wristRotationDetector';

export class BicepCurlPlugin extends BaseExercisePlugin {
  readonly id = 'bicepCurl';
  readonly name = 'Bicep Curls';
  readonly description = 'Track bicep curl range of motion and wrist supination';
  readonly configKey = 'bicepCurl';

  constructor() {
    super(15);
  }

  getWristSupinationScore(landmarks?: any[]): number {
    return getSupinationScore(landmarks);
  }
}

exercisePluginRegistry.register(new BicepCurlPlugin());
