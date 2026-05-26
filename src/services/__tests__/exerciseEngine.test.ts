import { describe, it, expect, beforeEach } from "vitest";
import { ExerciseEngine, EngineState } from "../exerciseEngine";
import { resetFeedbackEngine } from "../../engine/feedbackEngine";
import type { ExerciseConfig } from "../../config/exercises";

const squatConfig: ExerciseConfig = {
  key: "squat",
  name: "Bodyweight Squats",
  primaryJoint: "knee",
  joints: [],
  downThreshold: 140,
  upThreshold: 160,
  feedbackRules: [],
};

const defaultPlankSpline = {
  isCalibrated: false,
  slope: 0,
  intercept: 0,
  frameCount: 0,
  sumX: 0,
  sumY: 0,
  sumXX: 0,
  sumXY: 0,
};

function makeState(overrides: Partial<EngineState> = {}): EngineState {
  return {
    reps: 0,
    stage: "up",
    feedback: "",
    status: "green",
    lastRepTime: 0,
    isCalibrated: true,
    history: [],
    stageStartTime: 0,
    frameScore: 100,
    totalScore: 0,
    totalFrames: 0,
    allowRep: true,
    mistakes: {},
    currentStreak: 0,
    bestStreak: 0,
    isInExercisePosture: false,
    downAngleReached: 999,
    totalReps: 0,
    correctReps: 0,
    minScoreInRep: 100,
    repScores: [],
    repDeviations: [],
    accuracy: 100,
    plankSpline: defaultPlankSpline,
    hipSplineDeviation: 0,
    visibilityBuffer: [],
    lastValidAngles: {},
    trackingLostFrames: 0,
    ...overrides,
  };
}

const goodVis = { knee: 1.0 };

describe("ExerciseEngine", () => {
  let engine: ExerciseEngine;

  beforeEach(() => {
    engine = new ExerciseEngine();
    resetFeedbackEngine();
  });

  it("counts a rep when angle crosses downThreshold then upThreshold", async () => {
    const state = makeState({
      stage: "down",
      stageStartTime: 0,
      lastRepTime: 0,
      history: [170, 170, 170, 170],
      minScoreInRep: 100,
    });

    const result = await engine.process(
      squatConfig,
      { knee: 170 },
      goodVis,
      state
    );

    expect(result.reps).toBe(1);
    expect(result.totalReps).toBe(1);
  });

  it("does not count a rep when minScoreInRep is 70 or below (bad form rejection)", async () => {
    const state = makeState({
      stage: "down",
      stageStartTime: 0,
      lastRepTime: 0,
      history: [170, 170, 170, 170],
      minScoreInRep: 50,
    });

    const result = await engine.process(
      squatConfig,
      { knee: 170 },
      goodVis,
      state
    );

    expect(result.reps).toBe(0);
    expect(result.totalReps).toBe(1);
    expect(result.allowRep).toBe(false);
  });

  it("increments bestStreak when minScoreInRep is above 80", async () => {
    const state = makeState({
      stage: "down",
      stageStartTime: 0,
      lastRepTime: 0,
      history: [170, 170, 170, 170],
      minScoreInRep: 90,
      currentStreak: 2,
      bestStreak: 2,
    });

    const result = await engine.process(
      squatConfig,
      { knee: 170 },
      goodVis,
      state
    );

    expect(result.currentStreak).toBe(3);
    expect(result.bestStreak).toBe(3);
  });

  it("returns accuracy of 100 when totalReps is 0", async () => {
    const state = makeState({ stage: "up" });

    const result = await engine.process(
      squatConfig,
      { knee: 170 },
      goodVis,
      state
    );

    expect(result.totalReps).toBe(0);
    expect(result.accuracy).toBe(100);
  });

  it("returns a valid state object when joint visibility is below 0.5", async () => {
    const state = makeState();
    const result = await engine.process(
      squatConfig,
      { knee: 150 },
      { knee: 0.3 },
      state
    );

    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("feedback");
    expect(result).toHaveProperty("reps");
  });

  it("stays uncalibrated and shows ESTABLISHING message when angle is not at a threshold", async () => {
    const state = makeState({ isCalibrated: false, history: [] });

    const result = await engine.process(
      squatConfig,
      { knee: 100 },
      goodVis,
      state
    );

    expect(result.isCalibrated).toBe(false);
    expect(result.feedback).toBe("ESTABLISHING POSTURE...");
  });
});