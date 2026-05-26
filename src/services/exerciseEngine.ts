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
import { BodyType } from './bodyTypeEngine';

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

  /**
   * Running session depth statistics accumulated across all reps.
   */
  depthStats: SquatDepthStats;

  /**
   * Real-time depth coaching string emitted during the DOWN phase.
   * Empty string when no depth cue is active.
   */
  liveDepthFeedback: string;

  // Tracking & recovery buffers
  visibilityBuffer?: number[];
  trackingLostFrames?: number;
  lastValidAngles?: Record<string, number>;
  holdTime?: number;
}

// ─────────────────────────────────────────────
// ExerciseEngine
// ─────────────────────────────────────────────

export class ExerciseEngine {
  private readonly BASE_REP_COOLDOWN = 600;
  private readonly BASE_HYSTERESIS = 10;
  private readonly SMOOTHING_WINDOW = 5;
  private readonly MIN_DOWN_DURATION = 150;

  private repParams(key: string) {
    return {
      smoothingWindow: 5,
      streakMinScore: 75,
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
  ): Promise<EngineState> {
    const now = Date.now();
    const p = this.repParams(config.key);


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

    let {
      reps,
      stage,
      lastRepTime,
      isCalibrated,
      history,
      stageStartTime,
    } = currentState;

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

    if (smoothedAngle < config.downThreshold - currentHysteresis / 2) {
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
    const durationInDown = now - stageStartTime;

    if (
      smoothedAngle > (config.upThreshold + currentHysteresis / 2) &&
      stage === 'down'
    ) {
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
    };

    let feedbackResult: FeedbackResult;
    let frameScore: number;

    if (isInExercisePosture) {
      feedbackResult = getFeedback(context, config.key);
      frameScore = feedbackResult.score;
    } else {
      feedbackResult = {
        score: 100,
        color: 'green',
        message: 'READY 🟢',
        issues: [],
        deviation: 0,
      };
      frameScore = 100;
    }

    let nextMinScoreInRep = currentState.minScoreInRep;
    let currentDeviation = 0;
    if (isInExercisePosture) {
      nextMinScoreInRep = Math.min(nextMinScoreInRep, frameScore);
      currentDeviation = feedbackResult.deviation || 0;
    }

    // ───────── LIVE DEPTH FEEDBACK (during down phase) ────────────────────
    //
    // Only inject depth cue when no high-priority form issue is active.
    // Green status = no critical form error → safe to display depth coaching.
    // We use downAngleReached (the running minimum this rep) so the cue
    // reflects the deepest point reached so far, not the current angle.
    // ───────────────────────────────────────────────────────────────────────
    let liveDepthFeedback = '';

    if (nextStage === 'down' && isInExercisePosture) {
      const depthCue = getLiveDepthFeedback(
        downAngleReached,
        DEFAULT_SQUAT_DEPTH_CONFIG
      );

      // Surface depth cue only when form feedback is green (no overriding issue)
      if (feedbackResult.color === 'green' && depthCue) {
        liveDepthFeedback = depthCue;
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

    if (repJustCounted) {
      // ── Classify depth for the completed rep ─────────────────────────────
      //
      // `downAngleReached` holds the minimum femur angle for this rep.
      // If the exercise is NOT a squat, depth classification is skipped and
      // no score modifier is applied.  Gate on config.key.
      // ─────────────────────────────────────────────────────────────────────
      const isSquat = /squat/i.test(config.key);

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

        if (!depthResult.isFullDepth) {
          nextMinScoreInRep = 0;
        }
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
    } else {
      displayFeedback = feedbackResult.message;
      displayStatus = feedbackResult.color;
    }

    // Show depth classification feedback right after a rep completes
    if (repJustCounted && nextLastDepthResult) {
      const classMsg = nextLastDepthResult.feedback;
      displayFeedback = classMsg;
      displayStatus =
        nextLastDepthResult.isFullDepth ? 'green' : 'red';
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

      // Depth classification (NEW)
      lastDepthResult: nextLastDepthResult,
      depthStats: nextDepthStats,
      liveDepthFeedback,
    };
  }
}

export const exerciseEngine = new ExerciseEngine();
