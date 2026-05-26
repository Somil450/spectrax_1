/**
 * Pushup_depth_classifier.ts
 *
 * Classifies push-up reps by relative depth of the user's chest to the floor plane
 * utilizing Z-depth estimations of shoulder-to-wrist nodes.
 * Designed to integrate directly into ExerciseEngine.
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type PushupDepthClass = 'deep' | 'parallel' | 'half';

export interface PushupDepthConfig {
  /** Z-depth diff below this are classified as deep (default 10) */
  deepMax: number;
  /** Z-depth diff below this (but above deepMax) are parallel (default 20) */
  parallelMax: number;
}

export interface PushupDepthResult {
  classification: PushupDepthClass;
  /** The pushup Z-depth that triggered this classification */
  depth: number;
  /** Human-readable feedback string ready for display */
  feedback: string;
  /** Score modifier: applied on top of the base rep quality score */
  scoreModifier: number;
  /** Whether this rep counts as a full (non-penalised) rep */
  isFullDepth: boolean;
}

export interface PushupDepthStats {
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

export const DEFAULT_PUSHUP_DEPTH_CONFIG: PushupDepthConfig = {
  deepMax: 10,
  parallelMax: 20,
};

// ─────────────────────────────────────────────
// Core classifier
// ─────────────────────────────────────────────

/**
 * Classify a single rep by the minimum Z-depth reached during the
 * down phase.
 *
 * @param zDepth  Minimum shoulder-wrist Z-depth diff during the rep.
 * @param config  Optional custom thresholds.
 */
export function classifyPushupDepth(
  zDepth: number,
  config: PushupDepthConfig = DEFAULT_PUSHUP_DEPTH_CONFIG
): PushupDepthResult {
  if (zDepth < config.deepMax) {
    return {
      classification: 'deep',
      depth: zDepth,
      feedback: 'DEEP PUSHUP ✅',
      scoreModifier: 5,       // bonus: reward athletes who go well below parallel
      isFullDepth: true,
    };
  }

  if (zDepth <= config.parallelMax) {
    return {
      classification: 'parallel',
      depth: zDepth,
      feedback: 'GOOD DEPTH ✅',
      scoreModifier: 0,       // baseline: no penalty, no bonus
      isFullDepth: true,
    };
  }

  // Half pushup — did not reach parallel
  const deficit = Math.round(zDepth - config.parallelMax);
  return {
    classification: 'half',
    depth: zDepth,
    feedback: `GO LOWER — CHEST TO FLOOR`,
    scoreModifier: -20,      // penalty: reduces rep quality score
    isFullDepth: false,
  };
}

// ─────────────────────────────────────────────
// Depth feedback trigger
// ─────────────────────────────────────────────

/**
 * Generate mid-rep coaching feedback based on how deep the athlete
 * currently is in the push-up.
 *
 * @param currentZDepth  Current Z-depth diff this frame.
 * @param config         Depth thresholds.
 * @returns  A coaching string (empty string = no active cue needed).
 */
export function getLivePushupDepthFeedback(
  currentZDepth: number,
  config: PushupDepthConfig = DEFAULT_PUSHUP_DEPTH_CONFIG
): string {
  if (currentZDepth > config.parallelMax + 10) {
    return 'LOWER — CHEST TO FLOOR';
  }
  if (
    currentZDepth > config.parallelMax &&
    currentZDepth <= config.parallelMax + 10
  ) {
    return 'ALMOST — SINK A LITTLE LOWER';
  }
  if (
    currentZDepth <= config.parallelMax &&
    currentZDepth > config.deepMax
  ) {
    return 'GOOD DEPTH ✅';
  }
  if (currentZDepth <= config.deepMax) {
    return 'DEEP PUSHUP ✅';
  }
  return '';
}

// ─────────────────────────────────────────────
// Session stats accumulator
// ─────────────────────────────────────────────

/**
 * Accumulate per-rep depth classifications into a running session summary.
 * Call once per completed rep with the result from classifyPushupDepth().
 */
export function accumulatePushupDepthStats(
  current: PushupDepthStats,
  result: PushupDepthResult
): PushupDepthStats {
  const next = { ...current };

  next.totalClassified += 1;

  if (result.classification === 'deep') next.deepCount += 1;
  else if (result.classification === 'parallel') next.parallelCount += 1;
  else next.halfCount += 1;

  const fullDepthReps = next.deepCount + next.parallelCount;
  next.depthScore = Math.round((fullDepthReps / next.totalClassified) * 100);

  return next;
}

/** Factory for a zeroed PushupDepthStats object. */
export function initialPushupDepthStats(): PushupDepthStats {
  return {
    deepCount: 0,
    parallelCount: 0,
    halfCount: 0,
    totalClassified: 0,
    depthScore: 100,
  };
}
