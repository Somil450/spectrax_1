import { ExerciseContext, RepCompletionResult } from './IExercisePlugin';
import { BaseExercisePlugin } from './BaseExercisePlugin';
import { exercisePluginRegistry } from './ExercisePluginRegistry';
import { EngineState } from '../../services/exerciseEngine';
import {
  computeHipAngle,
  classifyMountainClimberDepth,
  getLiveClimberFeedback,
  accumulateMountainClimberStats,
  initialMountainClimberStats,
  DEFAULT_MOUNTAIN_CLIMBER_DEPTH_CONFIG,
} from '../../services/MountainClimber_depth_classifier';

const LEFT_HIP = 23;
const LEFT_KNEE = 25;
const LEFT_SHOULDER = 11;
const RIGHT_HIP = 24;
const RIGHT_KNEE = 26;
const RIGHT_SHOULDER = 12;

export class MountainClimberPlugin extends BaseExercisePlugin {
  readonly id = 'mountainClimber';
  readonly name = 'Mountain Climbers';
  readonly description = 'Cardio-driven mountain climber tracking with bilateral leg detection';
  readonly configKey = 'mountainClimber';

  private activeSide: "left" | "right" = "left";
  private minLeftHip = 180;
  private minRightHip = 180;

  constructor() {
    super(23);
  }

  getLiveFeedback(context: ExerciseContext): string | undefined {
    if (context.nextStage === 'up') {
      return getLiveClimberFeedback(context.activeAngles.mountainClimberHip);
    }
    return undefined;
  }

  updateCustomState(context: ExerciseContext, nextState: Partial<EngineState>): void {
    const landmarks = context.landmarks;
    if (!landmarks || landmarks.length < 27) return;

    const leftHipAngle = computeHipAngle(
      landmarks[LEFT_SHOULDER],
      landmarks[LEFT_HIP],
      landmarks[LEFT_KNEE],
    );
    const rightHipAngle = computeHipAngle(
      landmarks[RIGHT_SHOULDER],
      landmarks[RIGHT_HIP],
      landmarks[RIGHT_KNEE],
    );

    if (context.nextStage === 'up') {
      this.minLeftHip = Math.min(this.minLeftHip, leftHipAngle);
      this.minRightHip = Math.min(this.minRightHip, rightHipAngle);
    }

    this.activeSide = leftHipAngle < rightHipAngle ? "left" : "right";
    const primaryAngle = this.activeSide === "left" ? leftHipAngle : rightHipAngle;

    nextState.mountainClimberLeftHip = leftHipAngle;
    nextState.mountainClimberRightHip = rightHipAngle;
    nextState.mountainClimberActiveLeg = this.activeSide;
    nextState.mountainClimberHip = primaryAngle;
  }

  onRepComplete(context: ExerciseContext): RepCompletionResult | undefined {
    const maxFlexion = this.activeSide === "left" ? this.minLeftHip : this.minRightHip;
    const depthResult = classifyMountainClimberDepth(maxFlexion, this.activeSide);

    this.minLeftHip = 180;
    this.minRightHip = 180;

    const nextStats = accumulateMountainClimberStats(
      context.currentState.mountainClimberStats || initialMountainClimberStats(),
      depthResult,
      this.activeSide,
    );

    return {
      depthScoreModifier: depthResult.scoreModifier,
      isFullDepth: depthResult.isFullRep,
      classificationFeedback: depthResult.feedback,
      nextLastDepthResult: depthResult,
      nextDepthStats: nextStats,
    };
  }
}

exercisePluginRegistry.register(new MountainClimberPlugin());
