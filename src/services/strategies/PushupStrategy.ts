import { ExerciseContext, RepCompletionResult } from './ExerciseStrategy';
import { DefaultStrategy } from './DefaultStrategy';
import {
  classifyPushupDepth,
  getLivePushupDepthFeedback,
  accumulatePushupDepthStats,
  DEFAULT_PUSHUP_DEPTH_CONFIG,
  initialPushupDepthStats,
} from '../Pushup_depth_classifier';

export class PushupStrategy extends DefaultStrategy {
  constructor() {
    super(11); // Left Shoulder
  }

  getLiveFeedback(context: ExerciseContext): string | undefined {
    if (context.nextStage === 'down' && context.isInExercisePosture) {
      const depthCue = getLivePushupDepthFeedback(
        context.downZReached,
        DEFAULT_PUSHUP_DEPTH_CONFIG
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
      DEFAULT_PUSHUP_DEPTH_CONFIG
    );

    const nextPushupDepthStats = accumulatePushupDepthStats(
      context.currentState.pushupDepthStats || initialPushupDepthStats(),
      depthResult
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
