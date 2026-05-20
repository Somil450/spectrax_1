import { ExerciseConfig } from "../config/exercises";
import {
  getFeedback,
  resetFeedbackEngine,
  FeedbackResult,
} from "../engine/feedbackEngine";

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

  // 🔥 NEW ACCURACY SYSTEM
  totalReps: number;
  correctReps: number;
  minScoreInRep: number;
  repScores: number[];
  accuracy: number;
}

export class ExerciseEngine {
  private readonly REP_COOLDOWN = 600;
  private readonly HYSTERESIS = 10;
  private readonly SMOOTHING_WINDOW = 5;
  private readonly MIN_DOWN_DURATION = 150;

  private isValidExercisePosture(
    history: number[],
    config: ExerciseConfig,
    stage: "up" | "down",
  ): boolean {
    if (stage === "down") return true;

    const firstAngle = history[0];
    const lastAngle = history[history.length - 1];
    const movementDelta = Math.abs(lastAngle - firstAngle);

    const isInRestingPosition = lastAngle >= config.upThreshold - 5;

    if (isInRestingPosition && movementDelta < 2) {
      return false;
    }

    return true;
  }

  async process(
    config: ExerciseConfig,
    angles: Record<string, number>,
    visibility: Record<string, number>,
    currentState: EngineState,
  ): Promise<EngineState> {
    const currentTime = Date.now();

    let { reps, stage, lastRepTime, isCalibrated, history, stageStartTime } =
      currentState;

    const rawAngle = angles[config.primaryJoint];
    const currentVisibility = visibility[config.primaryJoint];

    // ───────── VISIBILITY GUARD ─────────
    if (currentVisibility < 0.5) {
      return {
        ...currentState,
        feedback: "SENSORS BLURRED — POSITION BODY",
        status: "yellow",
        isInExercisePosture: false,
      };
    }

    // ───────── SMOOTHING ─────────
    const newHistory = [...history, rawAngle].slice(-this.SMOOTHING_WINDOW);
    const smoothedAngle =
      newHistory.reduce((a, b) => a + b, 0) / newHistory.length;

    // ───────── CALIBRATION ─────────
    if (!isCalibrated) {
      const isUpPosture = smoothedAngle > config.upThreshold - 5;
      const isDownPosture = smoothedAngle < config.downThreshold + 5;

      // For jumping jacks, start from DOWN position (arms at sides)
      // For other exercises, start from UP position
      const shouldCalibrateFromDown =
        config.key === "jumpingJack" && isDownPosture;
      const shouldCalibrateFromUp = config.key !== "jumpingJack" && isUpPosture;

      if (
        (shouldCalibrateFromDown || shouldCalibrateFromUp) &&
        newHistory.length >= this.SMOOTHING_WINDOW
      ) {
        isCalibrated = true;
        stage = shouldCalibrateFromDown ? "down" : "up";
        stageStartTime = currentTime;
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
      };
    }

    // ───────── REP LOGIC (UNCHANGED CORE) ─────────
    let nextStage = stage;
    let nextReps = reps;
    let nextLastRepTime = lastRepTime;
    let downAngleReached = currentState.downAngleReached;

    if (smoothedAngle < config.downThreshold - this.HYSTERESIS / 2) {
      if (stage === "up") {
        nextStage = "down";
        stageStartTime = currentTime;
        downAngleReached = smoothedAngle;
      }

      if (nextStage === "down") {
        downAngleReached = Math.min(downAngleReached, smoothedAngle);
      }
    }

    let repJustCounted = false;

    if (
      smoothedAngle > config.upThreshold + this.HYSTERESIS / 2 &&
      stage === "down"
    ) {
      const durationInDown = currentTime - stageStartTime;

      if (
        currentTime - lastRepTime > this.REP_COOLDOWN &&
        durationInDown > this.MIN_DOWN_DURATION
      ) {
        nextStage = "up";
        stageStartTime = currentTime;
        repJustCounted = true;
      }
    }

    // ───────── POSTURE VALIDATION ─────────
    const isInExercisePosture = this.isValidExercisePosture(
      history,
      config,
      nextStage,
    );

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
        color: "green",
        message: "READY 🟢",
        issues: [],
      };
      frameScore = 100;
    }

    // ───────── TRACK REP SCORE ─────────
    let nextMinScoreInRep = currentState.minScoreInRep;

    if (isInExercisePosture) {
      nextMinScoreInRep = Math.min(nextMinScoreInRep, frameScore);
    }

    // ───────── REP ACCURACY SYSTEM ─────────
    let nextCurrentStreak = currentState.currentStreak;
    let nextBestStreak = currentState.bestStreak;
    let nextTotalReps = currentState.totalReps;
    let nextCorrectReps = currentState.correctReps;
    let nextRepScores = [...currentState.repScores];

    let allowRep = currentState.allowRep;

    if (repJustCounted) {
      nextTotalReps += 1;
      nextRepScores.push(nextMinScoreInRep);

      // cooldown ALWAYS
      nextLastRepTime = currentTime;

      allowRep = nextMinScoreInRep > 70;

      if (allowRep) {
        nextCorrectReps += 1;
        nextReps += 1;

        if (nextMinScoreInRep > 80) {
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

    // ───────── FEEDBACK ─────────
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

    if (
      isInExercisePosture &&
      displayStatus !== "green" &&
      displayFeedback !== "Good form ✅"
    ) {
      nextMistakes[displayFeedback] = (nextMistakes[displayFeedback] || 0) + 1;
    }

    // ───────── SCORE TRACKING ─────────
    const nextTotalScore = isInExercisePosture
      ? currentState.totalScore + frameScore
      : currentState.totalScore;

    const nextTotalFrames = isInExercisePosture
      ? currentState.totalFrames + 1
      : currentState.totalFrames;

    // 🔥 FINAL ACCURACY %
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
      accuracy,
    };
  }
}

export const exerciseEngine = new ExerciseEngine();
