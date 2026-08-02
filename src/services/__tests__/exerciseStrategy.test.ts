import { describe, it, expect } from "vitest";
import { getStrategy } from "../strategies/StrategyFactory";
import { DefaultStrategy } from "../strategies/DefaultStrategy";
import { SquatPlugin } from "../../plugins/exercises/SquatPlugin";
import { PushupPlugin } from "../../plugins/exercises/PushupPlugin";
import { JumpingJackPlugin } from "../../plugins/exercises/JumpingJackPlugin";
import { exercisePluginRegistry } from "../../plugins/exercises/ExercisePluginRegistry";

describe("getStrategy", () => {
  it("returns a DefaultStrategy for unknown exercise keys", () => {
    const strategy = getStrategy("someNewExercise");
    expect(strategy).toBeInstanceOf(DefaultStrategy);
    expect(strategy.getCalibrationStage()).toBe("up");
    expect(strategy.getLiveFeedbackChannel()).toBeNull();
    expect(strategy.getDepthResultField()).toBeNull();
  });

  it("routes squat depth feedback to the squat channel", () => {
    const strategy = getStrategy("squat");
    expect(strategy).toBeInstanceOf(SquatPlugin);
    expect(strategy.getCalibrationStage()).toBe("up");
    expect(strategy.getLiveFeedbackChannel()).toBe("liveDepthFeedback");
    expect(strategy.getDepthResultField()).toBe("lastDepthResult");
  });

  it("routes pushup depth feedback to the pushup channel", () => {
    const strategy = getStrategy("pushup");
    expect(strategy).toBeInstanceOf(PushupPlugin);
    expect(strategy.getCalibrationStage()).toBe("up");
    expect(strategy.getLiveFeedbackChannel()).toBe("livePushupDepthFeedback");
    expect(strategy.getDepthResultField()).toBe("lastPushupDepthResult");
  });

  it("calibrates jumping jacks from the down posture", () => {
    const strategy = getStrategy("jumpingJack");
    expect(strategy).toBeInstanceOf(JumpingJackPlugin);
    expect(strategy.getCalibrationStage()).toBe("down");
    expect(strategy.getLiveFeedbackChannel()).toBeNull();
    expect(strategy.getDepthResultField()).toBeNull();
  });

  it("registers every exercise plugin with the registry", () => {
    const keys = exercisePluginRegistry
      .getAll()
      .map((plugin) => plugin.configKey)
      .sort();
    expect(keys).toContain("squat");
    expect(keys).toContain("pushup");
    expect(keys).toContain("jumpingJack");
    expect(keys).toContain("bicepCurl");
  });
});
