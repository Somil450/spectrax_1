export interface MountainClimberDepthConfig {
  minKneeDriveAngle: number;
  fullExtensionAngle: number;
}

export interface MountainClimberDepthResult {
  classification: "full" | "partial" | "minimal";
  feedback: string;
  scoreModifier: number;
  isFullRep: boolean;
}

export const DEFAULT_MOUNTAIN_CLIMBER_DEPTH_CONFIG: MountainClimberDepthConfig = {
  minKneeDriveAngle: 90,
  fullExtensionAngle: 160,
};

export function initialMountainClimberStats() {
  return {
    totalReps: 0,
    leftLegReps: 0,
    rightLegReps: 0,
    fullRangeReps: 0,
  };
}

export function classifyMountainClimberDepth(
  maxHipFlexion: number,
  side: "left" | "right",
  limbLengthFactor = 1,
  config: MountainClimberDepthConfig = DEFAULT_MOUNTAIN_CLIMBER_DEPTH_CONFIG,
): MountainClimberDepthResult {
  if (maxHipFlexion < config.minKneeDriveAngle * limbLengthFactor) {
    return {
      classification: "full",
      feedback: `Good ${side} knee drive!`,
      scoreModifier: 10,
      isFullRep: true,
    };
  }

  if (maxHipFlexion < config.minKneeDriveAngle * limbLengthFactor + 30) {
    return {
      classification: "partial",
      feedback: `Drive the ${side} knee further forward`,
      scoreModifier: 0,
      isFullRep: false,
    };
  }

  return {
    classification: "minimal",
    feedback: `Bring the ${side} knee toward your chest`,
    scoreModifier: -10,
    isFullRep: false,
  };
}

export function getLiveClimberFeedback(
  currentHipAngle: number,
): string | undefined {
  if (currentHipAngle > 160) return "Drive your knee forward";
  if (currentHipAngle < 60) return "Push back to plank";
  return undefined;
}

export function accumulateMountainClimberStats(
  prev: ReturnType<typeof initialMountainClimberStats>,
  result: MountainClimberDepthResult,
  side: "left" | "right",
) {
  const next = { ...prev };
  next.totalReps += 1;
  if (side === "left") next.leftLegReps += 1;
  else next.rightLegReps += 1;
  if (result.isFullRep) next.fullRangeReps += 1;
  return next;
}

export function computeHipAngle(
  shoulder: { x: number; y: number },
  hip: { x: number; y: number },
  knee: { x: number; y: number },
): number {
  const a = { x: shoulder.x - hip.x, y: shoulder.y - hip.y };
  const b = { x: knee.x - hip.x, y: knee.y - hip.y };
  const dot = a.x * b.x + a.y * b.y;
  const magA = Math.sqrt(a.x * a.x + a.y * a.y);
  const magB = Math.sqrt(b.x * b.x + b.y * b.y);
  if (magA < 1e-6 || magB < 1e-6) return 180;
  const cos = Math.max(-1, Math.min(1, dot / (magA * magB)));
  return Math.acos(cos) * (180 / Math.PI);
}
