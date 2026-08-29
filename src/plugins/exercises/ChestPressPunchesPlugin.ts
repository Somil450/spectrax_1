import { BaseExercisePlugin } from './BaseExercisePlugin';
import { exercisePluginRegistry } from './ExercisePluginRegistry';

/**
 * Resistance Band Chest Press / Punches (issue #527).
 *
 * Tracks the press / punch movement with the wrist as the primary joint.
 * The exercise config, feedback rules and calibration wiring already live
 * in src/config/exercises.ts / src/engine/feedbackEngine.ts; this plugin
 * makes the exercise first-class in the plugin registry so it no longer
 * falls through to the DefaultStrategy special case in StrategyFactory.
 */
export class ChestPressPunchesPlugin extends BaseExercisePlugin {
  readonly id = 'chestPressPunches';
  readonly name = 'Resistance Band Chest Press / Punches';
  readonly description = 'Track chest press / punch range of motion';
  readonly configKey = 'chestPressPunches';

  constructor() {
    super(15); // left wrist — the hand leading the press / punch
  }
}

exercisePluginRegistry.register(new ChestPressPunchesPlugin());
