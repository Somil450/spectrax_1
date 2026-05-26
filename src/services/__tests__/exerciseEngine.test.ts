import { describe, it, expect, beforeEach } from "vitest";
import { calculateJumpingJackSyncMetrics, ExerciseEngine, EngineState } from "../exerciseEngine";
import { resetFeedbackEngine } from "../../engine/feedbackEngine";
import type { ExerciseConfig } from "../../config/exercises";
import { initialSquatDepthStats } from "../Squat_depth_classifier";

const squatConfig: ExerciseConfig = {
  key: "squat",
  name: "Bodyweight Squats",
  primaryJoint: "knee",
  joints: [],
  downThreshold: 140,
  upThreshold: 160,
  feedbackRules: [],
};

const jumpingJackConfig: ExerciseConfig = {
  key: "jumpingJack",
  name: "Jumping Jacks",
  primaryJoint: "shoulder",
  joints: [],
  downThreshold: 60,
  upThreshold: 150,
  feedbackRules: [],
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
    lastDepthResult: null,
    depthStats: initialSquatDepthStats(),
    liveDepthFeedback: "",
    visibilityBuffer: [],
    lastValidAngles: {},
    trackingLostFrames: 0,
    jumpingJackSyncSamples: [],
    jumpingJackSync: { score: null, lagMs: null, confidence: 0, samples: 0 },
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
      downAngleReached: 80,
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
      downAngleReached: 80,
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
      downAngleReached: 80,
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

  it("scores synchronized jumping jack arm and leg signals", () => {
    const samples = Array.from({ length: 48 }, (_, index) => {
      const signal = Math.sin(index / 4);
      return {
        timestamp: index * 50,
        armOpen: 90 + signal * 45,
        legSpread: 140 + signal * 55,
      };
    });

    const result = calculateJumpingJackSyncMetrics(samples);

    expect(result.score).toBeGreaterThan(85);
    expect(result.lagMs).toBe(0);
    expect(result.confidence).toBe(1);
  });

  it("captures jumping jack synchronization samples during active frames", async () => {
    const state = makeState({
      stage: "down",
      history: [70, 70, 70, 70],
      isInExercisePosture: true,
    });

    const result = await engine.process(
      jumpingJackConfig,
      {
        shoulder: 85,
        jumpingJackArmOpen: 90,
        jumpingJackLegSpread: 160,
      },
      { shoulder: 1.0 },
      state
    );

    expect(result.jumpingJackSyncSamples).toHaveLength(1);
    expect(result.jumpingJackSync?.samples).toBe(1);
  });
});
