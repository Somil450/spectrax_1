import { ExerciseConfig } from '../../config/exercises';
import { EngineState } from '../exerciseEngine';
import { FeedbackResult } from '../../engine/feedbackEngine';

export interface RepCompletionResult {
  depthScoreModifier: number;
  isFullDepth: boolean;
  classificationFeedback?: string;
  nextLastDepthResult?: any;
  nextDepthStats?: any;
  nextLastPushupDepthResult?: any;
  nextPushupDepthStats?: any;
}

export interface ExerciseContext {
  currentState: EngineState;
  activeAngles: Record<string, number>;
  landmarks?: any[];
  config: ExerciseConfig;
  now: number;
  downAngleReached: number;
  downZReached: number;
  isInExercisePosture: boolean;
  nextStage: string;
  feedbackResult: FeedbackResult;
}

export type DepthFeedbackChannel = 'liveDepthFeedback' | 'livePushupDepthFeedback';
export type DepthResultField = 'lastDepthResult' | 'lastPushupDepthResult';
export type CalibrationStage = 'up' | 'down';

export interface ExerciseStrategy {
  getPrimaryJointIndex(): number;
  getLiveFeedback(context: ExerciseContext): string | undefined;
  onRepComplete(context: ExerciseContext): RepCompletionResult | undefined;
  updateCustomState(context: ExerciseContext, nextState: Partial<EngineState>): void;
  getWristSupinationScore(landmarks?: any[]): number;

  /**
   * Posture (up/down) the engine should wait for before marking the exercise
   * as calibrated. Defaults to 'up' for rep-based exercises; jumping jacks
   * calibrate from the 'down' pose.
   */
  getCalibrationStage(): CalibrationStage;

  /**
   * EngineState field that carries live depth cues for this exercise, or
   * null when the exercise has no live depth feedback.
   */
  getLiveFeedbackChannel(): DepthFeedbackChannel | null;

  /**
   * EngineState field that holds the depth classification of the most recent
   * rep, or null when the exercise has no depth classification to surface.
   */
  getDepthResultField(): DepthResultField | null;
}
