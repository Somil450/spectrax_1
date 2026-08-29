import { ExerciseContext, RepCompletionResult } from './IExercisePlugin';
import { BaseExercisePlugin } from './BaseExercisePlugin';
import { exercisePluginRegistry } from './ExercisePluginRegistry';
import { EngineState } from '../../services/exerciseEngine';
import { calculateJumpingJackSyncMetrics } from '../../services/exerciseEngine';
import {
  classifyJumpingJackDepth,
  getLiveSyncFeedback,
  accumulateJumpingJackDepthStats,
  initialJumpingJackDepthStats,
  DEFAULT_JUMPING_JACK_DEPTH_CONFIG,
} from '../../services/JumpingJack_depth_classifier';

const JUMPING_JACK_SYNC_WINDOW = 160;

export class JumpingJackPlugin extends BaseExercisePlugin {
  readonly id = 'jumpingJack';
  readonly name = 'Jumping Jacks';
  readonly description = 'Full-body sync rep counter for jumping jacks';
  readonly configKey = 'jumpingJack';

  private maxArmThisRep = 0;
  private maxLegThisRep = 0;

  constructor() {
    super(15);
  }

  getLiveFeedback(context: ExerciseContext): string | undefined {
    const armOpen = context.activeAngles.jumpingJackArmOpen;
    const legSpread = context.activeAngles.jumpingJackLegSpread;
    if (!Number.isFinite(armOpen) || !Number.isFinite(legSpread)) return undefined;

    if (context.nextStage === 'up') {
      return getLiveSyncFeedback(armOpen, legSpread);
    }
    return undefined;
  }

  updateCustomState(context: ExerciseContext, nextState: Partial<EngineState>): void {
    const { currentState, isInExercisePosture, activeAngles, now, nextStage } = context;

    let nextJumpingJackSyncSamples = currentState.jumpingJackSyncSamples ?? [];
    let nextJumpingJackSync = currentState.jumpingJackSync ?? {
      score: null,
      lagMs: null,
      confidence: 0,
      samples: 0,
    };

    if (nextStage === 'up') {
      const armOpen = activeAngles.jumpingJackArmOpen;
      const legSpread = activeAngles.jumpingJackLegSpread;
      if (Number.isFinite(armOpen)) {
        this.maxArmThisRep = Math.max(this.maxArmThisRep, armOpen);
      }
      if (Number.isFinite(legSpread)) {
        this.maxLegThisRep = Math.max(this.maxLegThisRep, legSpread);
      }
    }

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

  onRepComplete(context: ExerciseContext): RepCompletionResult | undefined {
    const sync = context.currentState.jumpingJackSync;
    const syncLag = sync?.lagMs ?? 0;
    const armAngle = this.maxArmThisRep;
    const legSpread = this.maxLegThisRep;

    const depthResult = classifyJumpingJackDepth(armAngle, legSpread, syncLag);

    this.maxArmThisRep = 0;
    this.maxLegThisRep = 0;

    const nextDepthStats = accumulateJumpingJackDepthStats(
      context.currentState.jumpingJackDepthStats || initialJumpingJackDepthStats(),
      depthResult,
    );

    return {
      depthScoreModifier: depthResult.scoreModifier,
      isFullDepth: depthResult.isFullRep,
      classificationFeedback: depthResult.feedback,
      nextLastDepthResult: depthResult,
      nextDepthStats: nextDepthStats,
    };
  }
}

exercisePluginRegistry.register(new JumpingJackPlugin());
