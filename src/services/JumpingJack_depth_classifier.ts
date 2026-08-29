export interface JumpingJackDepthConfig {
  minArmAngle: number;
  minLegSpread: number;
  maxSyncLagMs: number;
}

export interface JumpingJackDepthResult {
  classification: "full" | "partial" | "minimal";
  feedback: string;
  scoreModifier: number;
  isFullRep: boolean;
}

export const DEFAULT_JUMPING_JACK_DEPTH_CONFIG: JumpingJackDepthConfig = {
  minArmAngle: 150,
  minLegSpread: 30,
  maxSyncLagMs: 120,
};

export function initialJumpingJackDepthStats() {
  return {
    totalReps: 0,
    fullRangeReps: 0,
    avgSyncLag: 0,
    totalSyncLag: 0,
  };
}

export function classifyJumpingJackDepth(
  maxArmAngle: number,
  maxLegSpread: number,
  syncLagMs: number,
  config: JumpingJackDepthConfig = DEFAULT_JUMPING_JACK_DEPTH_CONFIG,
): JumpingJackDepthResult {
  const armsFull = maxArmAngle >= config.minArmAngle;
  const legsFull = maxLegSpread >= config.minLegSpread;
  const syncGood = syncLagMs <= config.maxSyncLagMs;

  if (armsFull && legsFull && syncGood) {
    return {
      classification: "full",
      feedback: "Full range with good sync!",
      scoreModifier: 10,
      isFullRep: true,
    };
  }

  if (armsFull || legsFull) {
    return {
      classification: "partial",
      feedback: !armsFull
        ? "Raise arms higher for full range"
        : "Spread legs wider for full range",
      scoreModifier: 0,
      isFullRep: false,
    };
  }

  return {
    classification: "minimal",
    feedback: "Extend arms and legs fully",
    scoreModifier: -10,
    isFullRep: false,
  };
}

export function getLiveSyncFeedback(
  armAngle: number,
  legSpread: number,
  config: JumpingJackDepthConfig = DEFAULT_JUMPING_JACK_DEPTH_CONFIG,
): string | undefined {
  if (armAngle < config.minArmAngle * 0.7 && legSpread < config.minLegSpread * 0.7) {
    return "Extend arms and legs wide";
  }
  if (armAngle < config.minArmAngle * 0.7) {
    return "Raise your arms higher";
  }
  if (legSpread < config.minLegSpread * 0.7) {
    return "Spread your legs wider";
  }
  return undefined;
}

export function accumulateJumpingJackDepthStats(
  prev: ReturnType<typeof initialJumpingJackDepthStats>,
  result: JumpingJackDepthResult,
) {
  const next = { ...prev };
  next.totalReps += 1;
  if (result.isFullRep) {
    next.fullRangeReps += 1;
  }
  return next;
}
