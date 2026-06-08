import { ExerciseContext, RepCompletionResult } from './ExerciseStrategy';
import { DefaultStrategy } from './DefaultStrategy';
import {
  classifySquatDepth,
  getLiveDepthFeedback,
  accumulateDepthStats,
  DEFAULT_SQUAT_DEPTH_CONFIG,
  initialSquatDepthStats,
} from '../Squat_depth_classifier';

export class SquatStrategy extends DefaultStrategy {
  constructor() {
    super(24); // Right Hip
  }

  getLiveFeedback(context: ExerciseContext): string | undefined {
    if (context.nextStage === 'down' && context.isInExercisePosture) {
      const depthCue = getLiveDepthFeedback(
        context.downAngleReached,
        DEFAULT_SQUAT_DEPTH_CONFIG
      );

      if (context.feedbackResult.color === 'green' && depthCue) {
        return depthCue;
      }
    }
    return undefined;
  }

  onRepComplete(context: ExerciseContext): RepCompletionResult | undefined {
    const depthResult = classifySquatDepth(
      context.downAngleReached,
      DEFAULT_SQUAT_DEPTH_CONFIG
    );

    const nextDepthStats = accumulateDepthStats(
      context.currentState.depthStats || initialSquatDepthStats(),
      depthResult
    );

    return {
      depthScoreModifier: depthResult.scoreModifier,
      isFullDepth: depthResult.isFullDepth,
      classificationFeedback: depthResult.feedback,
      nextLastDepthResult: depthResult,
      nextDepthStats: nextDepthStats,
    };
  }
}
