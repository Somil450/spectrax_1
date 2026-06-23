import { ExerciseContext } from './IExercisePlugin';
import { BaseExercisePlugin } from './BaseExercisePlugin';
import { exercisePluginRegistry } from './ExercisePluginRegistry';
import { EngineState } from '../../services/exerciseEngine';
import { calculateJumpingJackSyncMetrics } from '../../services/exerciseEngine';

const JUMPING_JACK_SYNC_WINDOW = 160;

export class JumpingJackPlugin extends BaseExercisePlugin {
  readonly id = 'jumpingJack';
  readonly name = 'Jumping Jacks';
  readonly description = 'Track arm-leg synchronization for jumping jacks';
  readonly configKey = 'jumpingJack';

  constructor() {
    super(15);
  }

  updateCustomState(context: ExerciseContext, nextState: Partial<EngineState>): void {
    const { currentState, isInExercisePosture, activeAngles, now } = context;

    let nextJumpingJackSyncSamples = currentState.jumpingJackSyncSamples ?? [];
    let nextJumpingJackSync = currentState.jumpingJackSync ?? {
      score: null,
      lagMs: null,
      confidence: 0,
      samples: 0,
    };

    if (
      isInExercisePosture &&
      Number.isFinite(activeAngles.jumpingJackArmOpen) &&
      Number.isFinite(activeAngles.jumpingJackLegSpread)
    ) {
      nextJumpingJackSyncSamples = [
        ...nextJumpingJackSyncSamples,
        {
          timestamp: now,
          armOpen: activeAngles.jumpingJackArmOpen,
          legSpread: activeAngles.jumpingJackLegSpread,
        },
      ].slice(-JUMPING_JACK_SYNC_WINDOW);
      nextJumpingJackSync = calculateJumpingJackSyncMetrics(nextJumpingJackSyncSamples);
    }

    nextState.jumpingJackSyncSamples = nextJumpingJackSyncSamples;
    nextState.jumpingJackSync = nextJumpingJackSync;
  }
}

exercisePluginRegistry.register(new JumpingJackPlugin());
