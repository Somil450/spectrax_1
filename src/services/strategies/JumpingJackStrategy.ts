import { ExerciseContext } from './ExerciseStrategy';
import { DefaultStrategy } from './DefaultStrategy';
import { EngineState, calculateJumpingJackSyncMetrics } from '../exerciseEngine';

const JUMPING_JACK_SYNC_WINDOW = 160;

export class JumpingJackStrategy extends DefaultStrategy {
  constructor() {
    super(15); // Left Wrist
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
