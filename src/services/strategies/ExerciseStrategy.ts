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

export interface ExerciseStrategy {
  getPrimaryJointIndex(): number;
  getLiveFeedback(context: ExerciseContext): string | undefined;
  onRepComplete(context: ExerciseContext): RepCompletionResult | undefined;
  updateCustomState(context: ExerciseContext, nextState: Partial<EngineState>): void;
  getWristSupinationScore(landmarks?: any[]): number;
}
