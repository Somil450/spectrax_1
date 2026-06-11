import { ExerciseContext, RepCompletionResult } from './IExercisePlugin';
import { BaseExercisePlugin } from './BaseExercisePlugin';
import { exercisePluginRegistry } from './ExercisePluginRegistry';
import {
  classifySquatDepth,
  getLiveDepthFeedback,
  accumulateDepthStats,
  DEFAULT_SQUAT_DEPTH_CONFIG,
  initialSquatDepthStats,
} from '../../services/Squat_depth_classifier';

export class SquatPlugin extends BaseExercisePlugin {
  readonly id = 'squat';
  readonly name = 'Bodyweight Squats';
  readonly description = 'Track squat depth, form, and range of motion';
  readonly configKey = 'squat';

  constructor() {
    super(24);
  }

  getLiveFeedback(context: ExerciseContext): string | undefined {
    if (context.nextStage === 'down' && context.isInExercisePosture) {
      const depthCue = getLiveDepthFeedback(
        context.downAngleReached,
        DEFAULT_SQUAT_DEPTH_CONFIG,
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
      DEFAULT_SQUAT_DEPTH_CONFIG,
    );
    const nextDepthStats = accumulateDepthStats(
      context.currentState.depthStats || initialSquatDepthStats(),
      depthResult,
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

exercisePluginRegistry.register(new SquatPlugin());
