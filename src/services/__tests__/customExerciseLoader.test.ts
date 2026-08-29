import { describe, it, expect, beforeEach } from "vitest";
import {
  CustomExerciseLayout,
  parseCustomExerciseLayout,
  registerCustomExercise,
  registerCustomExerciseFromJson,
  unregisterCustomExercise,
  isBuiltInExerciseKey,
  saveCustomExerciseLayouts,
  loadCustomExerciseLayouts,
  restoreCustomExercises,
} from "../customExerciseLoader";
import { exercises } from "../../config/exercises";
import { getStrategy } from "../strategies/StrategyFactory";
import { exercisePluginRegistry } from "../../plugins/exercises/ExercisePluginRegistry";

const VALID_JSON = JSON.stringify({
  key: "squatPulse",
  name: "Squat Pulses",
  primaryJoint: "knee",
  primaryJointIndex: 24,
  joints: [[23, 25], [25, 27]],
  downThreshold: 120,
  upThreshold: 165,
  isStatic: false,
  guide: {
    instructions: ["Lower down"],
    targetMuscles: ["Quads"],
  },
});

function makeValidLayout(): CustomExerciseLayout {
  return {
    key: "squatPulse",
    name: "Squat Pulses",
    primaryJoint: "knee",
    joints: [[23, 25], [25, 27]],
    downThreshold: 120,
    upThreshold: 165,
  };
}

describe("parseCustomExerciseLayout", () => {
  it("parses a valid JSON layout into a typed object", () => {
    const layout = parseCustomExerciseLayout(VALID_JSON);
    expect(layout.key).toBe("squatPulse");
    expect(layout.name).toBe("Squat Pulses");
    expect(layout.primaryJoint).toBe("knee");
    expect(layout.primaryJointIndex).toBe(24);
    expect(layout.downThreshold).toBe(120);
    expect(layout.upThreshold).toBe(165);
    expect(layout.guide?.targetMuscles).toEqual(["Quads"]);
  });

  it("rejects malformed JSON", () => {
    expect(() => parseCustomExerciseLayout("{not json")).toThrow(/not valid JSON/);
  });

  it("rejects a non-object root", () => {
    expect(() => parseCustomExerciseLayout("[1, 2, 3]")).toThrow(/must be an object/);
  });

  it("rejects missing or empty key/name/primaryJoint", () => {
    for (const missing of ["key", "name", "primaryJoint"]) {
      const layout = JSON.parse(VALID_JSON);
      delete layout[missing];
      expect(() => parseCustomExerciseLayout(JSON.stringify(layout))).toThrow(missing);
    }
    expect(() => parseCustomExerciseLayout(JSON.stringify({ ...JSON.parse(VALID_JSON), key: " " }))).toThrow(/key/);
  });

  it("rejects keys with illegal characters", () => {
    const layout = JSON.parse(VALID_JSON);
    layout.key = "bad key!";
    expect(() => parseCustomExerciseLayout(JSON.stringify(layout))).toThrow(/letters and digits/);
  });

  it("rejects non-finite thresholds", () => {
    const layout = JSON.parse(VALID_JSON);
    layout.downThreshold = "120";
    expect(() => parseCustomExerciseLayout(JSON.stringify(layout))).toThrow(/downThreshold/);
    layout.downThreshold = Infinity;
    expect(() => parseCustomExerciseLayout(JSON.stringify(layout))).toThrow(/finite number/);
  });

  it("rejects downThreshold >= upThreshold", () => {
    const layout = JSON.parse(VALID_JSON);
    layout.downThreshold = 170;
    layout.upThreshold = 165;
    expect(() => parseCustomExerciseLayout(JSON.stringify(layout))).toThrow(/less than upThreshold/);
  });

  it("rejects an out-of-range primaryJointIndex", () => {
    const layout = JSON.parse(VALID_JSON);
    layout.primaryJointIndex = 99;
    expect(() => parseCustomExerciseLayout(JSON.stringify(layout))).toThrow(/primaryJointIndex/);
  });

  it("rejects malformed joints", () => {
    const layout = JSON.parse(VALID_JSON);
    layout.joints = [[23, 25], "bad"];
    expect(() => parseCustomExerciseLayout(JSON.stringify(layout))).toThrow(/joints/);
  });

  it("rejects non-string guide arrays", () => {
    const layout = JSON.parse(VALID_JSON);
    layout.guide.instructions = [1, 2];
    expect(() => parseCustomExerciseLayout(JSON.stringify(layout))).toThrow(/guide.instructions/);
  });
});

describe("registerCustomExercise", () => {
  beforeEach(() => {
    for (const key of Object.keys(exercises)) {
      if (!isBuiltInExerciseKey(key)) {
        delete exercises[key];
        exercisePluginRegistry.unregister(key);
      }
    }
    localStorage.clear();
  });

  it("registers the config and a live plugin", () => {
    const config = registerCustomExercise(makeValidLayout());
    expect(config.key).toBe("squatPulse");
    expect(exercises.squatPulse).toEqual(config);
    expect(exercisePluginRegistry.has("squatPulse")).toBe(true);
  });

  it("makes the strategy factory resolve the custom exercise immediately", () => {
    registerCustomExercise(makeValidLayout());
    const strategy = getStrategy("squatPulse");
    expect(strategy.getPrimaryJointIndex()).toBe(24);
  });

  it("registerCustomExerciseFromJson parses then registers", () => {
    const config = registerCustomExerciseFromJson(VALID_JSON);
    expect(exercises.squatPulse).toBeDefined();
    expect(config.key).toBe("squatPulse");
  });

  it("unregister removes a custom exercise but not built-ins", () => {
    registerCustomExercise(makeValidLayout());
    expect(unregisterCustomExercise("squatPulse")).toBe(true);
    expect(exercises.squatPulse).toBeUndefined();

    expect(unregisterCustomExercise("squat")).toBe(false);
    expect(exercises.squat).toBeDefined();
  });
});

describe("persistence", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips layouts through localStorage", () => {
    saveCustomExerciseLayouts([makeValidLayout()]);
    const loaded = loadCustomExerciseLayouts();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].key).toBe("squatPulse");
  });

  it("restoreCustomExercises re-registers persisted layouts", () => {
    saveCustomExerciseLayouts([makeValidLayout()]);
    const restored = restoreCustomExercises();
    expect(restored).toHaveLength(1);
    expect(exercises.squatPulse).toBeDefined();
    expect(exercisePluginRegistry.has("squatPulse")).toBe(true);
  });

  it("returns an empty list when nothing is stored or storage is corrupted", () => {
    expect(loadCustomExerciseLayouts()).toEqual([]);
    localStorage.setItem("spectrax_custom_exercise_layouts", "{corrupt");
    expect(loadCustomExerciseLayouts()).toEqual([]);
  });
});
