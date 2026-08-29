import { ExerciseContext, RepCompletionResult } from './IExercisePlugin';
import { BaseExercisePlugin } from './BaseExercisePlugin';
import { exercisePluginRegistry } from './ExercisePluginRegistry';
import { EngineState } from '../../services/exerciseEngine';
import { getSupinationScore } from '../../services/wristRotationDetector';
import {
  computeElbowAngle,
  detectActiveSide,
  getBicepCurlLiveFeedback,
  initialBicepCurlArmState,
  BicepCurlArmState,
} from '../../services/BicepCurl_depth_classifier';

const LEFT_SHOULDER = 11;
const LEFT_ELBOW = 13;
const LEFT_WRIST = 15;
const RIGHT_SHOULDER = 12;
const RIGHT_ELBOW = 14;
const RIGHT_WRIST = 16;

export class BicepCurlPlugin extends BaseExercisePlugin {
  readonly id = 'bicepCurl';
  readonly name = 'Bicep Curls';
  readonly description = 'Bilateral bicep curl tracking with left/right arm detection';
  readonly configKey = 'bicepCurl';

  private leftArm: BicepCurlArmState = initialBicepCurlArmState();
  private rightArm: BicepCurlArmState = initialBicepCurlArmState();
  private activeSide: "left" | "right" | "both" | "none" = "none";

  constructor() {
    super(15);
  }

  getLiveFeedback(context: ExerciseContext): string | undefined {
    if (context.nextStage === 'up') {
      return getBicepCurlLiveFeedback(
        this.activeSide,
        this.activeSide === 'left' ? this.leftArm.currentAngle : this.rightArm.currentAngle,
      );
    }
    return undefined;
  }

  getWristSupinationScore(landmarks?: any[]): number {
    return getSupinationScore(landmarks);
  }

  updateCustomState(context: ExerciseContext, nextState: Partial<EngineState>): void {
    const landmarks = context.landmarks;
    if (!landmarks || landmarks.length < 17) return;

    const leftAngle = computeElbowAngle(
      landmarks[LEFT_SHOULDER],
      landmarks[LEFT_ELBOW],
      landmarks[LEFT_WRIST],
    );
    const rightAngle = computeElbowAngle(
      landmarks[RIGHT_SHOULDER],
      landmarks[RIGHT_ELBOW],
      landmarks[RIGHT_WRIST],
    );

    this.leftArm.currentAngle = leftAngle;
    this.rightArm.currentAngle = rightAngle;

    this.activeSide = detectActiveSide(leftAngle, rightAngle);

    if (context.nextStage === 'up') {
      this.leftArm.maxCurlAngle = Math.min(this.leftArm.maxCurlAngle, leftAngle);
      this.rightArm.maxCurlAngle = Math.min(this.rightArm.maxCurlAngle, rightAngle);
    }

    nextState.bicepCurlLeftAngle = leftAngle;
    nextState.bicepCurlRightAngle = rightAngle;
    nextState.bicepCurlActiveSide = this.activeSide;
  }

  onRepComplete(context: ExerciseContext): RepCompletionResult | undefined {
    const supinationScore = this.getWristSupinationScore(context.landmarks);
    const side = this.activeSide;

    if (side === 'left' || side === 'both') {
      this.leftArm.repCount++;
      this.leftArm.totalSupinationScore += supinationScore;
    }
    if (side === 'right' || side === 'both') {
      this.rightArm.repCount++;
      this.rightArm.totalSupinationScore += supinationScore;
    }

    this.leftArm.maxCurlAngle = 180;
    this.rightArm.maxCurlAngle = 180;

    return {
      depthScoreModifier: isNaN(supinationScore) ? 0 : Math.round(supinationScore / 10),
      isFullDepth: true,
      classificationFeedback: side === 'both'
        ? 'Both arms'
        : side === 'left'
          ? 'Left arm'
          : 'Right arm',
    };
  }
}

exercisePluginRegistry.register(new BicepCurlPlugin());
