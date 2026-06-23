import { ExerciseContext, RepCompletionResult } from './IExercisePlugin';
import { BaseExercisePlugin } from './BaseExercisePlugin';
import { exercisePluginRegistry } from './ExercisePluginRegistry';
import {
  classifyPushupDepth,
  getLivePushupDepthFeedback,
  accumulatePushupDepthStats,
  DEFAULT_PUSHUP_DEPTH_CONFIG,
  initialPushupDepthStats,
} from '../../services/Pushup_depth_classifier';

export class PushupPlugin extends BaseExercisePlugin {
  readonly id = 'pushup';
  readonly name = 'Push-Ups';
  readonly description = 'Track pushup depth, form, and range of motion';
  readonly configKey = 'pushup';

  constructor() {
    super(11);
  }

  getLiveFeedback(context: ExerciseContext): string | undefined {
    if (context.nextStage === 'down' && context.isInExercisePosture) {
      const depthCue = getLivePushupDepthFeedback(
        context.downZReached,
        DEFAULT_PUSHUP_DEPTH_CONFIG,
      );
      if (context.feedbackResult.color === 'green' && depthCue) {
        return depthCue;
      }
    }
    return undefined;
  }

  onRepComplete(context: ExerciseContext): RepCompletionResult | undefined {
    const depthResult = classifyPushupDepth(
      context.downZReached,
      DEFAULT_PUSHUP_DEPTH_CONFIG,
    );
    const nextPushupDepthStats = accumulatePushupDepthStats(
      context.currentState.pushupDepthStats || initialPushupDepthStats(),
      depthResult,
    );
    return {
      depthScoreModifier: depthResult.scoreModifier,
      isFullDepth: depthResult.isFullDepth,
      classificationFeedback: depthResult.feedback,
      nextLastPushupDepthResult: depthResult,
      nextPushupDepthStats: nextPushupDepthStats,
    };
  }
}

exercisePluginRegistry.register(new PushupPlugin());
