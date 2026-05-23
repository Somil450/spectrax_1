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
  totalReps: number;
  correctReps: number;
  minScoreInRep: number;
  repScores: number[];
  accuracy: number;

  // 🔥 ADAPTIVE TRACKING RECOVERY
  visibilityBuffer?: number[];
  lastValidAngles?: Record<string, number>;
  trackingLostFrames?: number;
}

// ─── JSON Layout Parser ───────────────────────────────────────────────────────

interface RawRule {
  condition: string;
  message: string;
  type: "warning" | "error";
}

export interface LayoutDef {
  key: string;
  name: string;
  primaryJoint: string;
  downThreshold: number;
  upThreshold: number;
  joints?: number[][];
  demoUrl?: string;
  feedbackRules?: RawRule[];
  repCooldown?: number;
  hysteresis?: number;
  smoothingWindow?: number;
  minDownDuration?: number;
  correctRepMinScore?: number;
  streakMinScore?: number;
}

export interface ParsedLayout extends ExerciseConfig {
  repCooldown: number;
  hysteresis: number;
  smoothingWindow: number;
  minDownDuration: number;
  correctRepMinScore: number;
  streakMinScore: number;
}

const REQUIRED = ["key", "name", "primaryJoint", "downThreshold", "upThreshold"] as const;

// Turns a condition string like "knee < 70 && stage == 'down'" into a real predicate.
// Supports &&-joined clauses with <, >, <=, >=, ==, != against number or string literals.
function compileCondition(expr: string): (ctx: any) => boolean {
  const fns = expr.split("&&").map((clause) => {
    const m = clause.trim().match(/^(\w+)\s*(<=|>=|==|!=|<|>)\s*(.+)$/);
    if (!m) throw new Error(`unreadable condition: "${clause.trim()}"`);
    const [, prop, op, rawVal] = m;
    const num = parseFloat(rawVal);
    const str = rawVal.replace(/['"]/g, "").trim();
    const isNum = !isNaN(num);
    return (ctx: any) => {
      const v = ctx[prop];
      if (op === "<")  return v < num;
      if (op === ">")  return v > num;
      if (op === "<=") return v <= num;
      if (op === ">=") return v >= num;
      if (op === "==") return isNum ? v == num : v == str;
      if (op === "!=") return isNum ? v != num : v != str;
      return false;
    };
  });
  return (ctx) => fns.every((fn) => fn(ctx));
}

function parseLayout(raw: unknown): ParsedLayout {
  if (!raw || typeof raw !== "object") throw new Error("invalid layout");
  const obj = raw as Record<string, unknown>;

  for (const field of REQUIRED) {
    if (obj[field] == null) throw new Error(`missing field: ${field}`);
  }

  const down = obj.downThreshold as number;
  const up = obj.upThreshold as number;
  if (typeof down !== "number" || typeof up !== "number")
    throw new Error("thresholds must be numbers");
  if (down >= up) throw new Error("downThreshold must be < upThreshold");

  const rawRules = Array.isArray(obj.feedbackRules) ? (obj.feedbackRules as RawRule[]) : [];
  const feedbackRules = rawRules.map((r, idx) => {
    if (typeof r.condition !== "string") throw new Error(`rule[${idx}]: condition must be a string`);
    if (typeof r.message !== "string")   throw new Error(`rule[${idx}]: missing message`);
    return {
      condition: compileCondition(r.condition),
      message: r.message,
      type: (r.type === "error" ? "error" : "warning") as "warning" | "error",
    };
  });

  const num = (field: string, fallback: number) =>
    typeof obj[field] === "number" ? (obj[field] as number) : fallback;

  return {
    key:            String(obj.key),
    name:           String(obj.name),
    primaryJoint:   String(obj.primaryJoint),
    downThreshold:  down,
    upThreshold:    up,
    joints:         Array.isArray(obj.joints) ? (obj.joints as number[][]) : [],
    demoUrl:        typeof obj.demoUrl === "string" ? obj.demoUrl : undefined,
    feedbackRules,
    repCooldown:        num("repCooldown",        600),
    hysteresis:         num("hysteresis",         10),
    smoothingWindow:    num("smoothingWindow",     5),
    minDownDuration:    num("minDownDuration",     150),
    correctRepMinScore: num("correctRepMinScore",  70),
    streakMinScore:     num("streakMinScore",      80),
  };
}

class LayoutParser {
  private registry = new Map<string, ParsedLayout>();

  load(input: string | object): ParsedLayout {
    const raw = typeof input === "string" ? JSON.parse(input) : input;
    return parseLayout(raw);
  }

  register(input: string | object): ParsedLayout {
    const layout = this.load(input);
    this.registry.set(layout.key, layout);
    return layout;
  }

  get(key: string): ParsedLayout | undefined {
    return this.registry.get(key);
  }

  list(): string[] {
    return [...this.registry.keys()];
  }

  remove(key: string): boolean {
    return this.registry.delete(key);
  }
}

export const layoutParser = new LayoutParser();

// ─── Engine ───────────────────────────────────────────────────────────────────

const ENGINE_DEFAULTS = {
  repCooldown:        600,
  hysteresis:         10,
  smoothingWindow:    5,
  minDownDuration:    150,
  correctRepMinScore: 70,
  streakMinScore:     80,
};

export class ExerciseEngine {
  // Pull rep-counter params from a registered layout, falling back to defaults.
  // Called per-frame so runtime layout changes take effect immediately.
  private repParams(key: string) {
    const custom = layoutParser.get(key);
    if (!custom) return ENGINE_DEFAULTS;
    return {
      repCooldown:        custom.repCooldown,
      hysteresis:         custom.hysteresis,
      smoothingWindow:    custom.smoothingWindow,
      minDownDuration:    custom.minDownDuration,
      correctRepMinScore: custom.correctRepMinScore,
      streakMinScore:     custom.streakMinScore,
    };
  }

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

    if (isInRestingPosition && movementDelta < 2) return false;
    return true;
  }

  async process(
    config: ExerciseConfig,
    angles: Record<string, number>,
    visibility: Record<string, number>,
    currentState: EngineState,
  ): Promise<EngineState> {
    const now = Date.now();
    const p = this.repParams(config.key);

    let { reps, stage, lastRepTime, isCalibrated, history, stageStartTime } = currentState;

    const currentVisibility = visibility[config.primaryJoint];

    if (currentVisibility < 0.5) {
      return {
        ...currentState,
        feedback: "PARTIAL BODY LOST — ADJUST POSITION",
        status: "yellow",
        isInExercisePosture: false,
        visibilityBuffer: newVisibilityBuffer,
        trackingLostFrames: nextTrackingLostFrames,
        lastValidAngles: nextLastValidAngles
      };
    }

    const newHistory = [...history, rawAngle].slice(-p.smoothingWindow);
    const smoothedAngle = newHistory.reduce((a, b) => a + b, 0) / newHistory.length;

    if (!isCalibrated) {
      const isUpPosture   = smoothedAngle > config.upThreshold - 5;
      const isDownPosture = smoothedAngle < config.downThreshold + 5;
      const fromDown = config.key === "jumpingJack" && isDownPosture;
      const fromUp   = config.key !== "jumpingJack" && isUpPosture;

      if ((fromDown || fromUp) && newHistory.length >= p.smoothingWindow) {
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
        lastValidAngles: nextLastValidAngles
      };
    }

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
      feedbackResult = { score: 100, color: "green", message: "READY 🟢", issues: [] };
      frameScore = 100;
    }

    let nextMinScoreInRep = currentState.minScoreInRep;
    if (isInExercisePosture) {
      nextMinScoreInRep = Math.min(nextMinScoreInRep, frameScore);
    }

    let nextCurrentStreak = currentState.currentStreak;
    let nextBestStreak    = currentState.bestStreak;
    let nextTotalReps     = currentState.totalReps;
    let nextCorrectReps   = currentState.correctReps;
    let nextRepScores     = [...currentState.repScores];
    let allowRep          = currentState.allowRep;

    if (repJustCounted) {
      nextTotalReps += 1;
      nextRepScores.push(nextMinScoreInRep);
      nextLastRepTime = now;

      allowRep = nextMinScoreInRep > p.correctRepMinScore;

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
      displayStatus   = "yellow";
    } else {
      displayFeedback = feedbackResult.message;
      displayStatus   = feedbackResult.color;
    }

    const nextMistakes = { ...currentState.mistakes };
    if (isInExercisePosture && displayStatus !== "green" && displayFeedback !== "Good form ✅") {
      nextMistakes[displayFeedback] = (nextMistakes[displayFeedback] || 0) + 1;
    }

    const nextTotalScore  = isInExercisePosture ? currentState.totalScore  + frameScore : currentState.totalScore;
    const nextTotalFrames = isInExercisePosture ? currentState.totalFrames + 1          : currentState.totalFrames;

    const accuracy = nextTotalReps > 0
      ? Math.round((nextCorrectReps / nextTotalReps) * 100)
      : 100;

    return {
      reps:               nextReps,
      stage:              nextStage,
      feedback:           displayFeedback,
      status:             displayStatus,
      lastRepTime:        nextLastRepTime,
      isCalibrated,
      history:            newHistory,
      stageStartTime,
      frameScore:         isInExercisePosture ? frameScore : 100,
      totalScore:         nextTotalScore,
      totalFrames:        nextTotalFrames,
      allowRep,
      mistakes:           nextMistakes,
      currentStreak:      nextCurrentStreak,
      bestStreak:         nextBestStreak,
      isInExercisePosture,
      downAngleReached,
      totalReps:          nextTotalReps,
      correctReps:        nextCorrectReps,
      minScoreInRep:      nextMinScoreInRep,
      repScores:          nextRepScores,
      accuracy,

      visibilityBuffer: newVisibilityBuffer,
      trackingLostFrames: nextTrackingLostFrames,
      lastValidAngles: nextLastValidAngles
    };
  }
}

export const exerciseEngine = new ExerciseEngine();
