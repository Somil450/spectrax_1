/**
 * squat_depth_classifier.ts
 *
 * Classifies squat reps by femur-to-ground inclination angle at the lowest
 * point of the movement.  Designed to integrate directly into ExerciseEngine.
 *
 * Angle convention (matches most pose-estimation outputs):
 *   0°   = femur fully vertical   (hip above knee, standing)
 *   90°  = femur horizontal       (true parallel, thigh ≈ floor)
 *   180° = fully extended / lying
 *
 * Classification thresholds (adjustable via SquatDepthConfig):
 *   < DEEP_MAX (70°)              → "deep"     — below-parallel
 *   DEEP_MAX – PARALLEL_MAX       → "parallel" — thigh ≈ floor ± tolerance
 *   > PARALLEL_MAX (100°)         → "half"     — incomplete rep
 *
 * The engine records the minimum femur angle during the DOWN phase
 * (downAngleReached).  Pass that value to `classifySquatDepth()` once per rep.
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type SquatDepthClass = 'deep' | 'parallel' | 'half';

export interface SquatDepthConfig {
  /** Angles below this are classified as deep (default 70°) */
  deepMax: number;
  /** Angles below this (but above deepMax) are parallel (default 100°) */
  parallelMax: number;
}

export interface SquatDepthResult {
  classification: SquatDepthClass;
  /** The femur angle that triggered this classification */
  angle: number;
  /** Human-readable feedback string ready for display */
  feedback: string;
  /** Score modifier: applied on top of the base rep quality score */
  scoreModifier: number;
  /** Whether this rep counts as a full (non-penalised) rep */
  isFullDepth: boolean;
}

export interface SquatDepthStats {
  deepCount: number;
  parallelCount: number;
  halfCount: number;
  totalClassified: number;
  /** 0–100: fraction of reps that reached at least parallel depth */
  depthScore: number;
}

// ─────────────────────────────────────────────
// Default thresholds
// ─────────────────────────────────────────────

export const DEFAULT_SQUAT_DEPTH_CONFIG: SquatDepthConfig = {
  deepMax: 70,
  parallelMax: 100,
};

// ─────────────────────────────────────────────
// Core classifier
// ─────────────────────────────────────────────

/**
 * Classify a single rep by the minimum femur angle reached during the
 * down phase (downAngleReached from EngineState).
 *
 * @param femurAngle  Minimum femur-to-ground angle during the rep (degrees).
 * @param config      Optional custom thresholds.
 */
export function classifySquatDepth(
  femurAngle: number,
  config: SquatDepthConfig = DEFAULT_SQUAT_DEPTH_CONFIG
): SquatDepthResult {
  if (femurAngle < config.deepMax) {
    return {
      classification: 'deep',
      angle: femurAngle,
      feedback: 'DEEP SQUAT ✅',
      scoreModifier: 5,       // bonus: reward athletes who go well below parallel
      isFullDepth: true,
    };
  }

  if (femurAngle <= config.parallelMax) {
    return {
      classification: 'parallel',
      angle: femurAngle,
      feedback: 'PARALLEL DEPTH ✅',
      scoreModifier: 0,       // baseline: no penalty, no bonus
      isFullDepth: true,
    };
  }

  // Half squat — did not reach parallel
  const deficit = Math.round(femurAngle - config.parallelMax);
  return {
    classification: 'half',
    angle: femurAngle,
    feedback: `GO DEEPER — ${deficit}° SHORT OF PARALLEL`,
    scoreModifier: -20,      // penalty: reduces rep quality score
    isFullDepth: false,
  };
}

// ─────────────────────────────────────────────
// Depth feedback trigger
//
// Call this DURING the down phase (before the rep completes) so the
// user gets real-time coaching while they are still descending.
// ─────────────────────────────────────────────

/**
 * Generate mid-rep coaching feedback based on how deep the athlete
 * currently is in the squat.  Intended to be called every frame while
 * stage === 'down'.
 *
 * @param currentFemurAngle  Smoothed femur angle this frame.
 * @param config             Depth thresholds.
 * @returns  A coaching string (empty string = no active cue needed).
 */
export function getLiveDepthFeedback(
  currentFemurAngle: number,
  config: SquatDepthConfig = DEFAULT_SQUAT_DEPTH_CONFIG
): string {
  if (currentFemurAngle > config.parallelMax + 15) {
    // Noticeably above parallel — nudge downward
    return 'LOWER — REACH PARALLEL DEPTH';
  }
  if (
    currentFemurAngle > config.parallelMax &&
    currentFemurAngle <= config.parallelMax + 15
  ) {
    // Almost there
    return 'ALMOST — SINK A LITTLE DEEPER';
  }
  if (
    currentFemurAngle <= config.parallelMax &&
    currentFemurAngle > config.deepMax
  ) {
    // Good parallel zone
    return 'PARALLEL DEPTH ✅';
  }
  if (currentFemurAngle <= config.deepMax) {
    // Below parallel
    return 'DEEP SQUAT ✅';
  }
  return '';
}

// ─────────────────────────────────────────────
// Session stats accumulator
// ─────────────────────────────────────────────

/**
 * Accumulate per-rep depth classifications into a running session summary.
 * Call once per completed rep with the result from classifySquatDepth().
 *
 * @param current  Existing stats object (pass initial value on first rep).
 * @param result   Classification result for the rep just completed.
 */
export function accumulateDepthStats(
  current: SquatDepthStats,
  result: SquatDepthResult
): SquatDepthStats {
  const next = { ...current };

  next.totalClassified += 1;

  if (result.classification === 'deep') next.deepCount += 1;
  else if (result.classification === 'parallel') next.parallelCount += 1;
  else next.halfCount += 1;

  const fullDepthReps = next.deepCount + next.parallelCount;
  next.depthScore = Math.round((fullDepthReps / next.totalClassified) * 100);

  return next;
}

/** Factory for a zeroed SquatDepthStats object. */
export function initialSquatDepthStats(): SquatDepthStats {
  return {
    deepCount: 0,
    parallelCount: 0,
    halfCount: 0,
    totalClassified: 0,
    depthScore: 100,
  };
}