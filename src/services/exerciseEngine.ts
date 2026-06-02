import { getSupinationScore } from "./wristRotationDetector";

/**
 * exerciseEngine.ts  (updated — squat depth classification integrated)
 *
 * Changes vs. original:
 *  1. EngineState gains `lastDepthResult`, `depthStats`, and `liveDepthFeedback`.
 *  2. After a rep is counted, `classifySquatDepth()` runs on `downAngleReached`
 *     and the result is stored + merged into session stats.
 *  3. During the DOWN phase, `getLiveDepthFeedback()` overlays a depth cue
 *     when no higher-priority form issue is active.
 *  4. The depth `scoreModifier` adjusts `minScoreInRep` so half-squats can
 *     fall below the 70-point threshold and be rejected by the accuracy system.
 */

import { ExerciseConfig } from '../config/exercises';
import { getFeedback, resetFeedbackEngine, FeedbackResult } from '../engine/feedbackEngine';
// Note: feedbackEngine.ts lives in src/engine/ — path is correct relative to src/services/
import {
  classifySquatDepth,
  getLiveDepthFeedback,
  accumulateDepthStats,
  initialSquatDepthStats,
  SquatDepthResult,
  SquatDepthStats,
  DEFAULT_SQUAT_DEPTH_CONFIG,
} from './Squat_depth_classifier';
import {
  classifyPushupDepth,
  getLivePushupDepthFeedback,
  accumulatePushupDepthStats,
  initialPushupDepthStats,
  PushupDepthResult,
  PushupDepthStats,
  DEFAULT_PUSHUP_DEPTH_CONFIG,
} from './Pushup_depth_classifier';
import { BodyType } from './bodyTypeEngine';
import { VBTMetrics, KinematicEngine } from './kinematicEngine';
import type { NormalizedLandmark } from "@mediapipe/pose";

export interface JumpingJackSyncSample {
  timestamp: number;
  armOpen: number;
  legSpread: number;
}

export interface JumpingJackSyncMetrics {
  score: number | null;
  lagMs: number | null;
  confidence: number;
  samples: number;
}

const JUMPING_JACK_SYNC_WINDOW = 160;
const JUMPING_JACK_SYNC_MAX_LAG_FRAMES = 12;
const JUMPING_JACK_GOOD_LAG_MS = 350;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeSeries(values: number[]): number[] | null {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (range < 5) return null;
  return values.map((value) => (value - min) / range);
}

function correlationAtLag(legs: number[], arms: number[], lag: number): number | null {
  const legValues: number[] = [];
  const armValues: number[] = [];

  for (let i = 0; i < legs.length; i += 1) {
    const armIndex = i + lag;
    if (armIndex < 0 || armIndex >= arms.length) continue;
    legValues.push(legs[i]);
    armValues.push(arms[armIndex]);
  }

  if (legValues.length < 8) return null;

  const legMean = legValues.reduce((sum, value) => sum + value, 0) / legValues.length;
  const armMean = armValues.reduce((sum, value) => sum + value, 0) / armValues.length;
  let numerator = 0;
  let legVariance = 0;
  let armVariance = 0;

  for (let i = 0; i < legValues.length; i += 1) {
    const legDelta = legValues[i] - legMean;
    const armDelta = armValues[i] - armMean;
    numerator += legDelta * armDelta;
    legVariance += legDelta * legDelta;
    armVariance += armDelta * armDelta;
  }

  const denominator = Math.sqrt(legVariance * armVariance);
  return denominator > 0 ? numerator / denominator : null;
}

export function calculateJumpingJackSyncMetrics(
  samples: JumpingJackSyncSample[],
): JumpingJackSyncMetrics {
  if (samples.length < 12) {
    return { score: null, lagMs: null, confidence: 0, samples: samples.length };
  }

  const armSeries = normalizeSeries(samples.map((sample) => sample.armOpen));
  const legSeries = normalizeSeries(samples.map((sample) => sample.legSpread));
  if (!armSeries || !legSeries) {
    return { score: null, lagMs: null, confidence: 0, samples: samples.length };
  }

  let bestLag = 0;
  let bestCorrelation = -Infinity;
  for (let lag = -JUMPING_JACK_SYNC_MAX_LAG_FRAMES; lag <= JUMPING_JACK_SYNC_MAX_LAG_FRAMES; lag += 1) {
    const correlation = correlationAtLag(legSeries, armSeries, lag);
    if (correlation !== null && correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }

  if (!Number.isFinite(bestCorrelation)) {
    return { score: null, lagMs: null, confidence: 0, samples: samples.length };
  }

  const intervals = samples
    .slice(1)
    .map((sample, index) => sample.timestamp - samples[index].timestamp)
    .filter((interval) => interval > 0 && interval < 250);
  const averageInterval =
    intervals.length > 0
      ? intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
      : 50;
  const lagMs = Math.round(bestLag * averageInterval);
  const timingScore = clamp(1 - Math.abs(lagMs) / JUMPING_JACK_GOOD_LAG_MS, 0, 1);
  const rhythmScore = clamp(bestCorrelation, 0, 1);
  const confidence = clamp(samples.length / 45, 0, 1);
  const score = Math.round((rhythmScore * 0.65 + timingScore * 0.35) * confidence * 100);

  return {
    score,
    lagMs,
    confidence: Math.round(confidence * 100) / 100,
    samples: samples.length,
  };
}

// ─────────────────────────────────────────────
// EngineState
// ─────────────────────────────────────────────

export interface EngineState {
  reps: number;
  stage: "up" | "down";
  feedback: string;
  status: "green" | "yellow" | "red";
  lastRepTime: number;
  isCalibrated: boolean;
  history: number[];
  stageStartTime: number;
  frameScore: number;
  totalScore: number;
  totalFrames: number;
  allowRep: boolean;
  mistakes: Record<string, number>;
  currentStreak: number;
  bestStreak: number;
  isInExercisePosture: boolean;
  downAngleReached: number;

  // Accuracy system
  totalReps: number;
  correctReps: number;
  minScoreInRep: number;
  repScores: number[];
  repDeviations: number[];
  accuracy: number;

  // ── Squat depth classification (NEW) ──────────────────────────
  /**
   * Classification result for the most recently completed rep.
   * null until the first rep is counted.
   */
  lastDepthResult: SquatDepthResult | null;
  depthStats: SquatDepthStats;

  // VBT Metrics

  // ── Pushup depth classification ──────────────────────────────


  // Tracking & recovery buffers
  visibilityBuffer?: number[];
  trackingLostFrames?: number;
  lastValidAngles?: Record<string, number>;
  holdTime?: number;
  jumpingJackSyncSamples?: JumpingJackSyncSample[];
  jumpingJackSync?: JumpingJackSyncMetrics;

  wristSupinationScore?: number;

  /**
   * Real-time depth coaching string emitted during the DOWN phase.
   * Empty string when no depth cue is active.
   */
  liveDepthFeedback: string;

  // VBT Metrics
  vbtMetrics?: VBTMetrics;

  // ── Pushup depth classification (NEW) ──────────────────────────
  lastPushupDepthResult?: PushupDepthResult | null;
  pushupDepthStats?: PushupDepthStats;
  livePushupDepthFeedback?: string;
  downZReached?: number;

  // Tracking & recovery buffers
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout Parser & Defaults
// ─────────────────────────────────────────────────────────────────────────────

interface RepParams {
  repCooldown: number;
  hysteresis: number;
  smoothingWindow: number;
  minDownDuration: number;
  correctRepMinScore: number;
  streakMinScore: number;
}


// ─────────────────────────────────────────────
// ExerciseEngine
// ─────────────────────────────────────────────

const ENGINE_DEFAULTS: RepParams = {
  repCooldown: 600,

  hysteresis: 10,
  smoothingWindow: 5,
  minDownDuration: 150,
  correctRepMinScore: 70,
  streakMinScore: 85,
};

const layoutOverrides = new Map<string, Partial<RepParams>>();

export class ExerciseEngine {
  private readonly BASE_REP_COOLDOWN = 600;

  private readonly BASE_HYSTERESIS = 10;
  private readonly SMOOTHING_WINDOW = 5;

  private kinematicEngine = new KinematicEngine();
  private readonly MIN_DOWN_DURATION = 150;

  private repParams(key: string): RepParams {
    return {
      repCooldown: this.BASE_REP_COOLDOWN,
      hysteresis: this.BASE_HYSTERESIS,
      smoothingWindow: this.SMOOTHING_WINDOW,
      minDownDuration: this.MIN_DOWN_DURATION,
      correctRepMinScore: 70,
      streakMinScore: 60,
    };
  }

  private isValidExercisePosture(
    history: number[],
    config: ExerciseConfig,
    stage: "up" | "down",
  ): boolean {
    if (config.isStatic) {
      // For static hold exercises, check if angle is within the acceptable hold range
      const lastAngle = history[history.length - 1];
      if (lastAngle >= config.downThreshold - 15) return true;
      return false;
    }

    if (stage === "down") return true;

    const firstAngle = history[0];
    const lastAngle = history[history.length - 1];
    const movementDelta = Math.abs(lastAngle - firstAngle);
    const isInRestingPosition = lastAngle >= config.upThreshold - 5;

    if (isInRestingPosition && movementDelta < 2) return false;
    return true;
  }

  async process(
    config: ExerciseConfig,
    angles: Record<string, number>,
    visibility: Record<string, number>,
    currentState: EngineState,
    bodyType?: BodyType,

    landmarks?: any[]

  ): Promise<EngineState> {
    const now = Date.now();
    const p = ENGINE_DEFAULTS;

    // ───────── KINEMATICS ENGINE ─────────
    let updatedVbtMetrics = currentState.vbtMetrics;
    if (landmarks) {
      const jointMap: Record<string, number> = {
        squat: 24, // Right Hip
        pushup: 11, // Left Shoulder
        bicepCurl: 15, // Left Wrist
        jumpingJack: 15, // Left Wrist
        plank: 24, // Right Hip
        lunge: 24, // Right Hip
        chestPressPunches: 15 // Left Wrist
      };
      const primaryJointIndex = jointMap[config.key] ?? 24;
      updatedVbtMetrics = this.kinematicEngine.update(
        landmarks,
        Date.now(),
        primaryJointIndex
      );
    }


    // Adaptive Difficulty Tuning
    let currentCooldown = this.BASE_REP_COOLDOWN;
    let currentHysteresis = this.BASE_HYSTERESIS;
    
    if (bodyType === 'ecto') {
      currentCooldown = 750; // Longer limbs take more time to complete full ROM
      currentHysteresis = 12; // Ectos need slightly larger movement bands
    } else if (bodyType === 'meso') {
      currentCooldown = 500; // Mesomorphs can achieve faster athletic cadence
      currentHysteresis = 8;  // Stricter form requirements
    } else if (bodyType === 'endo') {
      currentCooldown = 650;
      currentHysteresis = 10;
    }

    const { reps, lastRepTime, history } = currentState;
    let { stage, isCalibrated, stageStartTime } = currentState;

    const currentVisibility = visibility[config.primaryJoint];

    // ───────── ADAPTIVE VISIBILITY & RECOVERY ─────────
    const prevVisibilityBuffer = currentState.visibilityBuffer || [];

    const newVisibilityBuffer = [...prevVisibilityBuffer, currentVisibility].slice(-p.smoothingWindow);
    const avgVisibility = newVisibilityBuffer.reduce((a, b) => a + b, 0) / newVisibilityBuffer.length;


    let nextTrackingLostFrames = currentState.trackingLostFrames || 0;
    let nextLastValidAngles = currentState.lastValidAngles || angles;

    // Use a slightly more forgiving threshold for tracking loss (e.g. 0.4)
    if (currentVisibility < 0.4) {
      nextTrackingLostFrames++;
    } else {
      nextTrackingLostFrames = 0;
      nextLastValidAngles = angles;
    }

    // Temporal buffering: use last known valid angles if tracking drops momentarily (up to 10 frames)
    const activeAngles =
      nextTrackingLostFrames > 0 && nextTrackingLostFrames < 10
        ? nextLastValidAngles
        : angles;
    const rawAngle = activeAngles[config.primaryJoint];

    // Only block exercise if visibility is consistently low for several frames
    if (avgVisibility < 0.4 && nextTrackingLostFrames >= 5) {
      return {
        ...currentState,
        feedback: 'SENSORS BLURRED — POSITION BODY',
        status: 'yellow',
        isInExercisePosture: false,
        liveDepthFeedback: '',
      };
    }

    const newHistory = [...history, rawAngle].slice(-p.smoothingWindow);
    const smoothedAngle = newHistory.reduce((a, b) => a + b, 0) / newHistory.length;

    if (!isCalibrated) {
      const isUpPosture = smoothedAngle > config.upThreshold - 5;
      const isDownPosture = smoothedAngle < config.downThreshold + 5;
      const fromDown = config.key === "jumpingJack" && isDownPosture;
      const fromUp = config.key !== "jumpingJack" && isUpPosture;

      const shouldCalibrateFromDown =
        config.key === "jumpingJack" && isDownPosture;
      const shouldCalibrateFromUp = config.key !== "jumpingJack" && isUpPosture;

      if (
        (shouldCalibrateFromDown || shouldCalibrateFromUp) &&
        newHistory.length >= p.smoothingWindow
      ) {
        isCalibrated = true;
        stage = fromDown ? "down" : "up";
        stageStartTime = now;
        resetFeedbackEngine();
      }

      return {
        ...currentState,
        isCalibrated,
        history: newHistory,
        stage,
        stageStartTime,
        feedback: 'ESTABLISHING POSTURE...',
        status: 'yellow',
        isInExercisePosture: false,
        liveDepthFeedback: '',
      };
    }


// ───────── REP LOGIC ─────────
    let nextStage = stage;
    let nextReps = reps;
    let nextLastRepTime = lastRepTime;
    let downAngleReached = currentState.downAngleReached;
    let downZReached = currentState.downZReached ?? 1000;

    if (smoothedAngle < config.downThreshold - currentHysteresis / 2) {
      if (stage === "up") {
        nextStage = "down";
        stageStartTime = now;
        downAngleReached = smoothedAngle;
        downZReached = angles.pushupDepthZ ?? 1000;
      }
      if (nextStage === "down") {
        downAngleReached = Math.min(downAngleReached, smoothedAngle);
        downZReached = Math.min(downZReached, angles.pushupDepthZ ?? 1000);
      }
    }

    let repJustCounted = false;
    const durationInDown = now - stageStartTime;

    if (
      smoothedAngle > (config.upThreshold + currentHysteresis / 2) &&
      stage === 'down'
    ) {
      const durationInDown = now - stageStartTime;

      if (
now - lastRepTime > currentCooldown &&
durationInDown > this.MIN_DOWN_DURATION
) {
  nextStage = "up";
  stageStartTime = now;
  repJustCounted = true;
}
    }

// ───────── POSTURE VALIDATION ─────────
const isInExercisePosture = this.isValidExercisePosture(
  history,
  config,
  nextStage
);

// Accumulate hold time for static exercises
let nextHoldTime = currentState.holdTime || 0;
if (
  config.isStatic &&
  isInExercisePosture &&
  (currentState.status === "green" || currentState.status === "yellow")
) {
  nextHoldTime += 1 / 20;
}

// ───────── WRIST ROTATION DETECTION ─────────
const wristSupinationScore =
  config.key === "bicepCurl" ? getSupinationScore(landmarks) : NaN;

const PLANK_DEVIATION_THRESHOLD = 0.05;
const hipSplineDeviation = 0;
const nextPlankSpline = { isCalibrated: false };

const context: any = {
  ...angles,
  stage: nextStage,
  lateralScore: angles.lateralScore,
  hipDepth: angles.hipDepth,
  horizontalStretch: angles.horizontalStretch,
  downAngleReached,
  hipSplineDeviation,
  plankSplineCalibrated: nextPlankSpline.isCalibrated,
  hipSagging: hipSplineDeviation > PLANK_DEVIATION_THRESHOLD,
  hipHyperextension: hipSplineDeviation < -PLANK_DEVIATION_THRESHOLD,
  wristSupinationScore,
};

let feedbackResult: FeedbackResult;
let frameScore: number;

if (isInExercisePosture) {
  feedbackResult = getFeedback(context, config.key);
  frameScore = feedbackResult.score;
} else {
  feedbackResult = {
    score: 100,
    color: "green",
    message: "READY 🟢",
    issues: [],
    deviation: 0,
  };
  frameScore = 100;
}
    let nextMinScoreInRep = currentState.minScoreInRep;
    let currentDeviation = 0;
    if (isInExercisePosture) {
      nextMinScoreInRep = Math.min(nextMinScoreInRep, frameScore);
      currentDeviation = feedbackResult.deviation ?? 0;
    }

    // ───────── LIVE DEPTH FEEDBACK (during down phase) ────────────────────
    //
    // Only inject depth cue when no high-priority form issue is active.
    // Green status = no critical form error → safe to display depth coaching.
    // We use downAngleReached (the running minimum this rep) so the cue
    // reflects the deepest point reached so far, not the current angle.
    // ───────────────────────────────────────────────────────────────────────
    let liveDepthFeedback = '';
    let livePushupDepthFeedback = '';

    if (nextStage === 'down' && isInExercisePosture) {
      if (/squat/i.test(config.key)) {
        const depthCue = getLiveDepthFeedback(
          downAngleReached,
          DEFAULT_SQUAT_DEPTH_CONFIG
        );

        // Surface depth cue only when form feedback is green (no overriding issue)
        if (feedbackResult.color === 'green' && depthCue) {
          liveDepthFeedback = depthCue;
        }
      } else if (/pushup/i.test(config.key)) {
        const depthCue = getLivePushupDepthFeedback(
          downZReached,
          DEFAULT_PUSHUP_DEPTH_CONFIG
        );
        if (feedbackResult.color === 'green' && depthCue) {
          livePushupDepthFeedback = depthCue;
        }
      }
    }

    // ───────── REP ACCURACY SYSTEM ─────────
    let nextCurrentStreak = currentState.currentStreak;
    let nextBestStreak = currentState.bestStreak;
    let nextTotalReps = currentState.totalReps;
    let nextCorrectReps = currentState.correctReps;
    const nextRepScores = [...currentState.repScores];
    const nextRepDeviations = [...currentState.repDeviations];

    let allowRep = currentState.allowRep;

    // Carry forward depth state; updated below if a rep was just counted
    let nextLastDepthResult = currentState.lastDepthResult ?? null;
    let nextDepthStats = currentState.depthStats ?? initialSquatDepthStats();
    let nextLastPushupDepthResult = currentState.lastPushupDepthResult ?? null;
    let nextPushupDepthStats = currentState.pushupDepthStats ?? initialPushupDepthStats();
    let nextJumpingJackSyncSamples = currentState.jumpingJackSyncSamples ?? [];
    let nextJumpingJackSync = currentState.jumpingJackSync ?? {
      score: null,
      lagMs: null,
      confidence: 0,
      samples: 0,
    };

    if (
      config.key === 'jumpingJack' &&
      isInExercisePosture &&
      Number.isFinite(activeAngles.jumpingJackArmOpen) &&
      Number.isFinite(activeAngles.jumpingJackLegSpread)
    ) {
      nextJumpingJackSyncSamples = [
        ...nextJumpingJackSyncSamples,
        {
          timestamp: now,
          armOpen: activeAngles.jumpingJackArmOpen,
          legSpread: activeAngles.jumpingJackLegSpread,
        },
      ].slice(-JUMPING_JACK_SYNC_WINDOW);
      nextJumpingJackSync = calculateJumpingJackSyncMetrics(nextJumpingJackSyncSamples);
    }

    if (repJustCounted) {
      this.kinematicEngine.onRepComplete();

      // ── Classify depth for the completed rep ─────────────────────────────
      //
      // `downAngleReached` holds the minimum femur angle for this rep.
      // If the exercise is NOT a squat, depth classification is skipped and
      // no score modifier is applied.  Gate on config.key.
      // ─────────────────────────────────────────────────────────────────────
      const isSquat = /squat/i.test(config.key);
      const isPushup = /pushup/i.test(config.key);

      let depthScoreModifier = 0;

      if (isSquat) {
        const depthResult = classifySquatDepth(
          downAngleReached,
          DEFAULT_SQUAT_DEPTH_CONFIG
        );

        nextLastDepthResult = depthResult;
        nextDepthStats = accumulateDepthStats(nextDepthStats, depthResult);
        depthScoreModifier = depthResult.scoreModifier;
        if (!depthResult.isFullDepth) nextMinScoreInRep = 0;

        // Apply depth modifier to the quality score for this rep.
        // Clamp to [0, 100] so a bonus never exceeds perfect.
        nextMinScoreInRep = Math.max(
          0,
          Math.min(100, nextMinScoreInRep + depthScoreModifier)
        );
      } else if (isPushup) {
        const depthResult = classifyPushupDepth(
          downZReached,
          DEFAULT_PUSHUP_DEPTH_CONFIG
        );

        nextLastPushupDepthResult = depthResult;
        nextPushupDepthStats = accumulatePushupDepthStats(nextPushupDepthStats, depthResult);
        depthScoreModifier = depthResult.scoreModifier;
        if (!depthResult.isFullDepth) nextMinScoreInRep = 0;

        nextMinScoreInRep = Math.max(
          0,
          Math.min(100, nextMinScoreInRep + depthScoreModifier)
        );
      }

      nextTotalReps += 1;
      nextRepScores.push(nextMinScoreInRep);
      nextRepDeviations.push(currentDeviation);

      nextLastRepTime = now;

      allowRep = nextMinScoreInRep > 70;

      if (allowRep) {
        nextCorrectReps += 1;
        nextReps += 1;
        if (nextMinScoreInRep > p.streakMinScore) {
          nextCurrentStreak += 1;
          nextBestStreak = Math.max(nextBestStreak, nextCurrentStreak);
        } else {
          nextCurrentStreak = 0;
        }
      } else {
        nextCurrentStreak = 0;
      }

      nextMinScoreInRep = 100;
    }

    // ───────── FEEDBACK DISPLAY ─────────
    let displayFeedback: string;
    let displayStatus: "green" | "yellow" | "red";

    if (!isInExercisePosture) {
      displayFeedback = 'Get into position...';
      displayStatus = 'yellow';
    } else if (nextStage === 'down' && liveDepthFeedback) {
      // Depth cue wins when form is clean and athlete is descending
      displayFeedback = liveDepthFeedback;
      displayStatus = feedbackResult.color;
    } else if (nextStage === 'down' && livePushupDepthFeedback) {
      displayFeedback = livePushupDepthFeedback;
      displayStatus = feedbackResult.color;
    } else {
      displayFeedback = feedbackResult.message;
      displayStatus = feedbackResult.color;
    }

    // Show depth classification feedback right after a rep completes
    if (repJustCounted && nextLastDepthResult && /squat/i.test(config.key)) {
      const classMsg = nextLastDepthResult.feedback;
      displayFeedback = classMsg;
      displayStatus =
        nextLastDepthResult.isFullDepth ? 'green' : 'red';
    } else if (repJustCounted && nextLastPushupDepthResult && /pushup/i.test(config.key)) {
      const classMsg = nextLastPushupDepthResult.feedback;
      displayFeedback = classMsg;
      displayStatus =
        nextLastPushupDepthResult.isFullDepth ? 'green' : 'red';
    }

    const nextMistakes = { ...currentState.mistakes };

    if (
      isInExercisePosture &&
      displayStatus !== 'green' &&
      displayFeedback !== 'Good form ✅'
    ) {
      nextMistakes[displayFeedback] =
        (nextMistakes[displayFeedback] || 0) + 1;
    }

    const nextTotalScore = isInExercisePosture ? currentState.totalScore + frameScore : currentState.totalScore;
    const nextTotalFrames = isInExercisePosture ? currentState.totalFrames + 1 : currentState.totalFrames;

    // Final accuracy %
    const accuracy =
      nextTotalReps > 0
        ? Math.round((nextCorrectReps / nextTotalReps) * 100)
        : 100;

    return {
      reps: nextReps,
      stage: nextStage,
      feedback: displayFeedback,
      status: displayStatus,
      lastRepTime: nextLastRepTime,
      isCalibrated,
      history: newHistory,
      stageStartTime,
      frameScore: isInExercisePosture ? frameScore : 100,
      totalScore: nextTotalScore,
      totalFrames: nextTotalFrames,
      allowRep,
      mistakes: nextMistakes,
      currentStreak: nextCurrentStreak,
      bestStreak: nextBestStreak,
      isInExercisePosture,
      downAngleReached,

      totalReps: nextTotalReps,
      correctReps: nextCorrectReps,
      minScoreInRep: nextMinScoreInRep,
      repScores: nextRepScores,
      repDeviations: nextRepDeviations,
      accuracy,

      lastDepthResult: nextLastDepthResult,
      depthStats: nextDepthStats,
      liveDepthFeedback,
      lastPushupDepthResult: nextLastPushupDepthResult,
      pushupDepthStats: nextPushupDepthStats,
      livePushupDepthFeedback,
      downZReached,
      visibilityBuffer: newVisibilityBuffer,
      trackingLostFrames: nextTrackingLostFrames,
      lastValidAngles: nextLastValidAngles,
      jumpingJackSyncSamples: nextJumpingJackSyncSamples,
      jumpingJackSync: nextJumpingJackSync,
      vbtMetrics: updatedVbtMetrics,
      holdTime: nextHoldTime,

      wristSupinationScore,
    };
  }
}

export const exerciseEngine = new ExerciseEngine();
