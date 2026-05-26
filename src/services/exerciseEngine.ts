import { ExerciseConfig } from "../config/exercises";
import {
  getFeedback,
  resetFeedbackEngine,
  FeedbackResult,
} from "../engine/feedbackEngine";

// ─────────────────────────────────────────────────────────────────────────────
// Plank Spline Types & Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stores the calibration baseline captured from the first
 * PLANK_CALIB_FRAMES frames once the user enters plank posture.
 *
 * baseline.slope / intercept describe the linear fit through
 * [shoulder.y, hip.y, knee.y] collected during that window.
 */
export interface PlankSplineCalibration {
  isCalibrated: boolean;
  slope: number; // from least-squares fit
  intercept: number; // from least-squares fit
  frameCount: number; // frames collected so far
  /** Running sum helpers for online least-squares */
  sumX: number;
  sumY: number;
  sumXX: number;
  sumXY: number;
}

/** How many frames to collect before locking the calibration baseline */
const PLANK_CALIB_FRAMES = 30;

/**
 * Threshold: if the hip's vertical deviation from the regression line
 * exceeds ±12 % of the body segment length, trigger a warning.
 */
const PLANK_DEVIATION_THRESHOLD = 0.12; // 12 %

// ─────────────────────────────────────────────────────────────────────────────
// Linear Spline Regression helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fit a simple least-squares line  y = slope·x + intercept
 * through three collinear body-line points:
 *   (shoulderX, shoulderY), (hipX, hipY), (kneeX, kneeY)
 *
 * All coordinates are in normalised MediaPipe space [0, 1].
 *
 * Returns { slope, intercept }.
 */
function fitBodyLineSpline(
  shoulder: { x: number; y: number },
  hip: { x: number; y: number },
  knee: { x: number; y: number },
): { slope: number; intercept: number } | null {
  // Three points; use ordinary least-squares
  const xs = [shoulder.x, hip.x, knee.x];
  const ys = [shoulder.y, hip.y, knee.y];
  const n = 3;

  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXX = xs.reduce((a, b) => a + b * b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
  const sumYY = ys.reduce((a, b) => a + b * b, 0);

  const denom = n * sumXX - sumX * sumX;
  const epsilon = 1e-9;
  if (Math.abs(denom) < epsilon) {
    // Vertical-ish line: fit x = m*y + b then invert if possible
    const denomY = n * sumYY - sumY * sumY;
    if (Math.abs(denomY) < epsilon) {
      return null;
    }

    const m = (n * sumXY - sumY * sumX) / denomY;
    if (Math.abs(m) < epsilon) {
      return null;
    }

    const b = (sumX - m * sumY) / n;
    return { slope: 1 / m, intercept: -b / m };
  }

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/**
 * Given a calibrated spline (slope / intercept) and the current
 * shoulder–hip–knee positions, return the signed fractional deviation
 * of the hip from where the regression line predicts it should be.
 *
 * deviation > 0  → hip is ABOVE the line  (hip sagging / dropping)
 * deviation < 0  → hip is BELOW the line  (hip raised / hyperextension)
 *
 * The deviation is normalised by the shoulder→knee segment length so
 * the ±12 % threshold is body-size invariant.
 */
export function computeHipSplineDeviation(
  calib: PlankSplineCalibration,
  shoulder: { x: number; y: number },
  hip: { x: number; y: number },
  knee: { x: number; y: number },
): number {
  if (!calib.isCalibrated) return 0;

  // Predicted hip Y based on its X position
  const predictedHipY = calib.slope * hip.x + calib.intercept;

  // Raw vertical residual (positive = hip higher than line in image-Y)
  const residual = hip.y - predictedHipY;

  // Normalise by shoulder-to-knee vertical span for scale invariance
  const segmentLength = Math.abs(knee.y - shoulder.y) || 0.01;
  return residual / segmentLength;
}

/**
 * Incrementally update the calibration state with one new frame.
 * Once PLANK_CALIB_FRAMES have been collected the baseline is locked.
 */
export function updatePlankCalibration(
  calib: PlankSplineCalibration,
  shoulder: { x: number; y: number },
  hip: { x: number; y: number },
  knee: { x: number; y: number },
): PlankSplineCalibration {
  if (calib.isCalibrated) return calib; // already locked

  const fit = fitBodyLineSpline(shoulder, hip, knee);
  if (!fit) {
    return calib;
  }

  const { slope, intercept } = fit;

  // Accumulate using a rolling average of the fitted params
  const newCount = calib.frameCount + 1;

  // We average the per-frame slopes/intercepts as a simple online estimator
  const alpha = 1 / newCount; // weight of newest sample
  const newSlope = calib.slope * (1 - alpha) + slope * alpha;
  const newIntercept = calib.intercept * (1 - alpha) + intercept * alpha;

  const isNowCalibrated = newCount >= PLANK_CALIB_FRAMES;

  const sampleSumX = shoulder.x + hip.x + knee.x;
  const sampleSumY = shoulder.y + hip.y + knee.y;
  const sampleSumXX = shoulder.x * shoulder.x + hip.x * hip.x + knee.x * knee.x;
  const sampleSumXY = shoulder.x * shoulder.y + hip.x * hip.y + knee.x * knee.y;

  return {
    isCalibrated: isNowCalibrated,
    slope: newSlope,
    intercept: newIntercept,
    frameCount: newCount,
    sumX: calib.sumX + sampleSumX,
    sumY: calib.sumY + sampleSumY,
    sumXX: calib.sumXX + sampleSumXX,
    sumXY: calib.sumXY + sampleSumXY,
  };
}

/** Returns a fresh, uncalibrated PlankSplineCalibration object */
export function createPlankCalibration(): PlankSplineCalibration {
  return {
    isCalibrated: false,
    slope: 0,
    intercept: 0,
    frameCount: 0,
    sumX: 0,
    sumY: 0,
    sumXX: 0,
    sumXY: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EngineState
// ─────────────────────────────────────────────────────────────────────────────

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

  // 🔥 Accuracy system
  totalReps: number;
  correctReps: number;
  minScoreInRep: number;
  repScores: number[];
  repDeviations: number[];
  accuracy: number;

  // 🔥 Plank spline regression state
  plankSpline: PlankSplineCalibration;

  /**
   * Latest fractional hip deviation from the calibration baseline.
   * Passed into feedbackEngine context so rules can act on it.
   * Positive  → hip sagging (dropped below neutral line)
   * Negative  → hip hyperextension (raised above neutral line)
   */
  hipSplineDeviation: number;

  // 🔥 ADAPTIVE TRACKING RECOVERY
  visibilityBuffer?: number[];
  lastValidAngles?: Record<string, number>;
  trackingLostFrames?: number;

  // 🔥 Static hold time tracking
  holdTime?: number;
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

const ENGINE_DEFAULTS: RepParams = {
  repCooldown: 600,
  hysteresis: 10,
  smoothingWindow: 8,
  minDownDuration: 150,
  correctRepMinScore: 70,
  streakMinScore: 80,
};

// Per-exercise overrides (runtime register-able)
const layoutOverrides = new Map<string, Partial<RepParams>>();

export function setRepParams(key: string, params: Partial<RepParams>): void {
  layoutOverrides.set(key, params);
}

export function clearRepParams(key: string): void {
  layoutOverrides.delete(key);
}

// ─────────────────────────────────────────────────────────────────────────────
// ExerciseEngine
// ─────────────────────────────────────────────────────────────────────────────

export class ExerciseEngine {
  // Pull rep-counter params from registered overrides or fall back to defaults.
  private repParams(key: string): RepParams {
    const custom = layoutOverrides.get(key);
    if (!custom) return ENGINE_DEFAULTS;
    return {
      repCooldown: custom.repCooldown ?? ENGINE_DEFAULTS.repCooldown,
      hysteresis: custom.hysteresis ?? ENGINE_DEFAULTS.hysteresis,
      smoothingWindow: custom.smoothingWindow ?? ENGINE_DEFAULTS.smoothingWindow,
      minDownDuration: custom.minDownDuration ?? ENGINE_DEFAULTS.minDownDuration,
      correctRepMinScore: custom.correctRepMinScore ?? ENGINE_DEFAULTS.correctRepMinScore,
      streakMinScore: custom.streakMinScore ?? ENGINE_DEFAULTS.streakMinScore,
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
    /**
     * Raw MediaPipe landmarks array.
     * Required for plank spline regression; optional for other exercises.
     */
    landmarks?: any[],
  ): Promise<EngineState> {
    const now = Date.now();
    const p = this.repParams(config.key);


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
        feedback: "PARTIAL BODY LOST — ADJUST POSITION",
        status: "yellow",
        isInExercisePosture: false,
        visibilityBuffer: newVisibilityBuffer,
        trackingLostFrames: nextTrackingLostFrames,
        lastValidAngles: nextLastValidAngles,
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
        feedback: "ESTABLISHING POSTURE...",
        status: "yellow",
        isInExercisePosture: false,
        visibilityBuffer: newVisibilityBuffer,
        trackingLostFrames: nextTrackingLostFrames,
        lastValidAngles: nextLastValidAngles,
      };
    }

    // ───────── PLANK SPLINE REGRESSION ─────────
    let nextPlankSpline = currentState.plankSpline;
    let hipSplineDeviation = currentState.hipSplineDeviation;

    if (config.key === "plank" && landmarks && landmarks.length >= 29) {
      // Select the more-visible side (mirrors angleUtils getBestSide logic)
      const leftVis =
        [11, 23, 25].reduce((s, i) => s + (landmarks[i]?.visibility || 0), 0) /
        3;
      const rightVis =
        [12, 24, 26].reduce((s, i) => s + (landmarks[i]?.visibility || 0), 0) /
        3;
      const side = leftVis >= rightVis ? "left" : "right";

      const shoulderIdx = side === "left" ? 11 : 12;
      const hipIdx = side === "left" ? 23 : 24;
      const kneeIdx = side === "left" ? 25 : 26;

      const shoulder = landmarks[shoulderIdx];
      const hip = landmarks[hipIdx];
      const knee = landmarks[kneeIdx];

      const sufficientVis =
        (shoulder?.visibility || 0) > 0.5 &&
        (hip?.visibility || 0) > 0.5 &&
        (knee?.visibility || 0) > 0.5;

      if (sufficientVis) {
        // Phase 1: collect calibration baseline
        if (!nextPlankSpline.isCalibrated) {
          nextPlankSpline = updatePlankCalibration(
            nextPlankSpline,
            shoulder,
            hip,
            knee,
          );
        }

        // Phase 2: compute live deviation from calibrated baseline
        if (nextPlankSpline.isCalibrated) {
          hipSplineDeviation = computeHipSplineDeviation(
            nextPlankSpline,
            shoulder,
            hip,
            knee,
          );
        }
      }
    }

    // ───────── REP LOGIC (UNCHANGED CORE) ─────────
    let nextStage = stage;
    let nextReps = reps;
    let nextLastRepTime = lastRepTime;
    let downAngleReached = currentState.downAngleReached;

    if (smoothedAngle < config.downThreshold - p.hysteresis / 2) {
      if (stage === "up") {
        nextStage = "down";
        stageStartTime = now;
        downAngleReached = smoothedAngle;
      }
      if (nextStage === "down") {
        downAngleReached = Math.min(downAngleReached, smoothedAngle);
      }
    }

    let repJustCounted = false;

    if (smoothedAngle > config.upThreshold + p.hysteresis / 2 && stage === "down") {
      const timeInDown = now - stageStartTime;
      if (now - lastRepTime > p.repCooldown && timeInDown > p.minDownDuration) {
        nextStage = "up";
        stageStartTime = now;
        repJustCounted = true;
      }
    }

    const isInExercisePosture = this.isValidExercisePosture(history, config, nextStage);

    // Accumulate hold time for static exercises (1/FPS approximately, or based on time diff)
    // Since process is called roughly FPS times per second, we can estimate hold time.
    // However, the cleanest way is to use a timestamp delta if we had previousTimestamp.
    // We can just add 1/15th of a second roughly, or just pass the timestamp from `now`.
    let nextHoldTime = currentState.holdTime || 0;
    if (config.isStatic && isInExercisePosture && (currentState.status === 'green' || currentState.status === 'yellow')) {
      // Estimate based on FPS_LIMIT=20 (from WorkoutScreen.tsx)
      nextHoldTime += 1 / 20;
    } else if (config.isStatic && !isInExercisePosture) {
      // Optional: Reset hold time if they break posture, or keep accumulating total?
      // Usually we want total hold time. We'll keep accumulating.
    }

    const context: any = {
      ...angles,
      stage: nextStage,
      lateralScore: angles.lateralScore,
      hipDepth: angles.hipDepth,
      horizontalStretch: angles.horizontalStretch,
      downAngleReached,
      // 🔥 Plank-specific spline deviation injected into feedback context
      hipSplineDeviation,
      plankSplineCalibrated: nextPlankSpline.isCalibrated,
      hipSagging: hipSplineDeviation > PLANK_DEVIATION_THRESHOLD,
      hipHyperextension: hipSplineDeviation < -PLANK_DEVIATION_THRESHOLD,
    };

    let feedbackResult: FeedbackResult;
    let frameScore: number;

    if (isInExercisePosture) {
      feedbackResult = getFeedback(context, config.key);
      frameScore = feedbackResult.score;
    } else {
      feedbackResult = { score: 100, color: "green", message: "READY 🟢", issues: [], deviation: 0 };
      frameScore = 100;
    }

    let nextMinScoreInRep = currentState.minScoreInRep;
    let currentDeviation = 0;
    if (isInExercisePosture) {
      nextMinScoreInRep = Math.min(nextMinScoreInRep, frameScore);
      currentDeviation = feedbackResult.deviation || 0;
    }

    let nextCurrentStreak = currentState.currentStreak;
    let nextBestStreak = currentState.bestStreak;
    let nextTotalReps = currentState.totalReps;
    let nextCorrectReps = currentState.correctReps;
    const nextRepScores = [...currentState.repScores];
    const nextRepDeviations = [...currentState.repDeviations];

    let allowRep = currentState.allowRep;

    if (repJustCounted) {
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

    let displayFeedback: string;
    let displayStatus: "green" | "yellow" | "red";

    if (!isInExercisePosture) {
      displayFeedback = "Get into position...";
      displayStatus = "yellow";
    } else {
      displayFeedback = feedbackResult.message;
      displayStatus = feedbackResult.color;
    }

    const nextMistakes = { ...currentState.mistakes };
    if (isInExercisePosture && displayStatus !== "green" && displayFeedback !== "Good form ✅") {
      nextMistakes[displayFeedback] = (nextMistakes[displayFeedback] || 0) + 1;
    }

    const nextTotalScore = isInExercisePosture ? currentState.totalScore + frameScore : currentState.totalScore;
    const nextTotalFrames = isInExercisePosture ? currentState.totalFrames + 1 : currentState.totalFrames;

    const accuracy = nextTotalReps > 0
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
      totalReps:          nextTotalReps,
      correctReps:        nextCorrectReps,
      minScoreInRep:      nextMinScoreInRep,
      repScores:          nextRepScores,
      repDeviations:      nextRepDeviations,
      accuracy,

      // 🔥 Plank spline state
      plankSpline: nextPlankSpline,
      hipSplineDeviation,

      // 🔥 Adaptive tracking recovery
      visibilityBuffer: newVisibilityBuffer,
      trackingLostFrames: nextTrackingLostFrames,
      lastValidAngles: nextLastValidAngles,

      // 🔥 Static hold time tracking
      holdTime: nextHoldTime
    };
  }
}

export const exerciseEngine = new ExerciseEngine();
