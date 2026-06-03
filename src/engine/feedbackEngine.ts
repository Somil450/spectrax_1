
// --- Types & Interfaces ---
import { skeletalSense } from "../services/skeletalSense";

/**
 * Gaussian Mixture Model for clustering motion/pose metrics
 */
export class GaussianMixtureModel {
  private k: number;
  private means: number[] = [];
  private variances: number[] = [];
  private weights: number[] = [];

  constructor(k: number) {
    this.k = k;
  }

  fit(data: number[], iterations: number = 20) {
    if (data.length === 0) return;

    const min = Math.min(...data);
    const max = Math.max(...data);

    this.means = Array.from(
      { length: this.k },
      (_, i) => min + ((i + 1) / (this.k + 1)) * (max - min)
    );

    this.variances = Array(this.k).fill(
      Math.max(0.001, Math.pow(max - min, 2) / (this.k * this.k))
    );

    this.weights = Array(this.k).fill(1 / this.k);

    for (let iter = 0; iter < iterations; iter++) {
      const responsibilities = data.map((x) => {
        const probs = this.means.map(
          (mean, j) => this.weights[j] * this.pdf(x, mean, this.variances[j])
        );

        const sum = probs.reduce((a, b) => a + b, 0);

        return sum === 0
          ? Array(this.k).fill(1 / this.k)
          : probs.map((p) => p / sum);
      });

      for (let j = 0; j < this.k; j++) {
        const sumR = responsibilities.reduce((acc, r) => acc + r[j], 0);

        if (sumR > 0) {
          this.weights[j] = sumR / data.length;

          this.means[j] =
            responsibilities.reduce((acc, r, i) => acc + r[j] * data[i], 0) /
            sumR;

          this.variances[j] = Math.max(
            0.001,
            responsibilities.reduce(
              (acc, r, i) =>
                acc + r[j] * Math.pow(data[i] - this.means[j], 2),
              0
            ) / sumR
          );
        }
      }
    }
  }

  predict(x: number): number {
    if (this.means.length === 0) return 0;

    let maxP = -1;
    let bestK = 0;

    for (let j = 0; j < this.k; j++) {
      const p =
        this.weights[j] * this.pdf(x, this.means[j], this.variances[j]);

      if (p > maxP) {
        maxP = p;
        bestK = j;
      }
    }

    return bestK;
  }

  getClusters() {
    return this.means.map((mean, i) => ({
      mean,
      variance: this.variances[i],
      weight: this.weights[i],
    }));
  }

  private pdf(x: number, mean: number, variance: number): number {
    return (
      (1 / Math.sqrt(2 * Math.PI * variance)) *
      Math.exp(-Math.pow(x - mean, 2) / (2 * variance))
    );
  }
}

/**
 * Tracks deviation stability over time
 */
class JointDeviationProfiler {
  private values: number[] = [];
  private allValues: number[] = [];
  private readonly maxSamples = 30;

  update(value: number) {
    this.values.push(value);
    this.allValues.push(value);

    if (this.values.length > this.maxSamples) {
      this.values.shift();
    }
  }

  getStandardDeviation(): number {
    if (this.values.length < 2) return 0;

    const mean =
      this.values.reduce((a, b) => a + b, 0) / this.values.length;

    const variance =
      this.values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
      this.values.length;

    return Math.sqrt(variance);
  }

  getAllValues(): number[] {
    return this.allValues;
  }

  reset() {
    this.values = [];
    this.allValues = [];
  }
}
const jointDeviationProfiler = new JointDeviationProfiler();
export interface DetectionIssue {
  type: string;
  severity: "high" | "medium" | "low";
  message: string;
  penalty: number;
}

export interface FeedbackResult {
  score: number;
  color: "green" | "yellow" | "red";
  message: string;
  issues: DetectionIssue[];
  deviation: number;
}

type ExerciseRule = (ctx: any) => DetectionIssue[];

// --- Rule Definitions ---

const rules: Record<string, ExerciseRule> = {
  pushup: (ctx: any) => {
    const issues: DetectionIssue[] = [];
    if (ctx.lateralScore < 70) {
      issues.push({
        type: "orientation",
        severity: "low",
        message: "TURN SIDEWAYS 🔄",
        penalty: 10,
      });
    }
    if (ctx.horizontalStretch < 40) {
      issues.push({
        type: "stretch",
        severity: "medium",
        message: "STRETCH OUT YOUR BODY 📏",
        penalty: 35,
      });
    }
    if (ctx.bodyLine < 135) {
      issues.push({
        type: "posture",
        severity: "high",
        message: "Keep your back straight ❌",
        penalty: 35,
      });
    }
    if (ctx.stage === "down" && ctx.downAngleReached > 105) {
      issues.push({
        type: "depth",
        severity: "medium",
        message: "Go lower for full range ⚠️",
        penalty: 35,
      });
    }
    return issues;
  },

  squat: (ctx: any) => {
    const issues: DetectionIssue[] = [];
    if (ctx.knee < 70) {
      issues.push({
        type: "knees",
        severity: "medium",
        message: "Don't over-bend knees ⚠️",
        penalty: 35,
      });
    }
    if (ctx.stage === "down" && ctx.downAngleReached > 95) {
      issues.push({
        type: "depth",
        severity: "medium",
        message: "Drive your hips lower 👇",
        penalty: 35,
      });
    }
    return issues;
  },

  bicepCurl: (ctx: any) => {
    const issues: DetectionIssue[] = [];

    // ── Existing form checks ──────────────────────────────────────────────
    if (ctx.stage === "down" && ctx.downAngleReached > 75) {
      issues.push({
        type: "squeeze",
        severity: "medium",
        message: "Squeeze at the top! ⚡",
        penalty: 35,
      });
    }
    if (ctx.shoulder > 35) {
      issues.push({
        type: "posture",
        severity: "medium",
        message: "Keep elbows at side ⚠️",
        penalty: 35,
      });
    }

    // ── Pronation / Supination check ─────────────────────────────────────
    // At the top of the curl ("down" stage) the palm should be fully
    // supinated (facing upward).  A score below the threshold means the
    // user is curling without twisting the wrist correctly.
    const supScore: number | undefined = ctx.wristSupinationScore;

    if (typeof supScore === 'number' && !isNaN(supScore)) {
      if (ctx.stage === 'down' && supScore < 0.2) {
        // Palm is pronated or neutral at peak of curl
        issues.push({
          type: 'wrist_pronation',
          severity: 'high',
          message: supScore < -0.2
            ? 'Flip your wrist! Palm should face UP 🔄'
            : 'Rotate wrist – supinate at the top 🔄',
          penalty: 40,
        });
      } else if (ctx.stage === 'up' && supScore > 0.2) {
        // Wrist should return to neutral / slight pronation at the bottom
        // This is optional coaching – use a lower penalty
        issues.push({
          type: 'wrist_return',
          severity: 'low',
          message: 'Return wrist to neutral at the bottom ↩️',
          penalty: 10,
        });
      }
    }

    return issues;
  },

  jumpingJack: (ctx: any) => {
    const issues: DetectionIssue[] = [];
    if (ctx.shoulder < 40) {
      issues.push({
        type: "range",
        severity: "medium",
        message: "Raise arms higher ⚠️",
        penalty: 35,
      });
    }
    return issues;
  },

  plank: (ctx) => {
    const issues: DetectionIssue[] = [];
    if (ctx.bodyLine < 160) {
      issues.push({
        type: "hips",
        severity: "medium",
        message: "Drop your hips ⚠️",
        penalty: 35,
      });
    }
    if (ctx.bodyLine > 185) {
      issues.push({
        type: "hips",
        severity: "medium",
        message: "Hips too high ⚠️",
        penalty: 35,
      });
    }
    if (ctx.hipSagging) {
      issues.push({
        type: "hipSag",
        severity: "high",
        message: "Hip sagging – keep core tight!",
        penalty: 40,
      });
    }
    if (ctx.hipHyperextension) {
      issues.push({
        type: "hipHyper",
        severity: "high",
        message: "Hip hyper‑extension – lower hips!",
        penalty: 40,
      });
    }
    return issues;
  },

  lunge: (ctx: any) => {
    const issues: DetectionIssue[] = [];
    if (ctx.kneePastToes === 1) {
      issues.push({
        type: "knee_alignment",
        severity: "medium",
        message: "Knee past toes! Shift weight back ⚠️",
        penalty: 35,
      });
    }
    if (ctx.stage === "down" && ctx.downAngleReached > 115) {
      issues.push({
        type: "depth",
        severity: "medium",
        message: "Go lower for full depth 👇",
        penalty: 35,
      });
    }
    if (ctx.stage === "down" && ctx.backKnee > 130) {
      issues.push({
        type: "back_knee",
        severity: "medium",
        message: "Bend your back knee more ⚠️",
        penalty: 30,
      });
    }
    return issues;
  },

  flutterKicks: (ctx: any) => {
    const issues: DetectionIssue[] = [];
    if (ctx.knee < 155) {
      issues.push({
        type: "knee_bend",
        severity: "medium",
        message: "Keep your legs straight ⚠️",
        penalty: 30,
      });
    }
    if (ctx.bodyLine < 120) {
      issues.push({
        type: "leg_height",
        severity: "medium",
        message: "Keep legs lower for core engagement ⚠️",
        penalty: 25,
      });
    }
    return issues;
  },

  shoulderPress: (ctx: any) => {
    const issues: DetectionIssue[] = [];
    if (ctx.elbow < 70) {
      issues.push({
        type: "elbows",
        severity: "medium",
        message: "Don't drop elbows too low ⚠️",
        penalty: 35,
      });
    }
    if (ctx.shoulder < 60) {
      issues.push({
        type: "posture",
        severity: "medium",
        message: "Keep elbows up ⚠️",
        penalty: 35,
      });
    }
    return issues;
  },

  chestPressPunches: (ctx: any) => {
    const issues: DetectionIssue[] = [];
    if (ctx.shoulder < 65) {
      issues.push({
        type: "posture",
        severity: "medium",
        message: "Keep arms at shoulder level ⚠️",
        penalty: 25,
      });
    }
    if (ctx.bodyLine < 155) {
      issues.push({
        type: "posture",
        severity: "high",
        message: "Keep your back straight ❌",
        penalty: 35,
      });
    }
    if (ctx.stage === "down" && ctx.downAngleReached > 110) {
      issues.push({
        type: "depth",
        severity: "medium",
        message: "Bring hands all the way back to chest ⚠️",
        penalty: 30,
      });
    }
    return issues;
  },
};

// --- Scoring & Smoothing Logic ---

let scoreHistory: number[] = [];
const SMOOTHING_WINDOW = 5;

function getSmoothedScore(rawScore: number): number {
  scoreHistory.push(rawScore);
  if (scoreHistory.length > SMOOTHING_WINDOW) {
    scoreHistory.shift();
  }
  const sum = scoreHistory.reduce((a, b) => a + b, 0);
  return Math.round(sum / scoreHistory.length);
}

const severityWeight = {
  high: 0,
  medium: 1,
  low: 2,
};

// --- Main Engine Function ---


export function getFeedback(ctx: any, exerciseKey: string): FeedbackResult {
  const ruleFn = rules[exerciseKey];

  if (!ruleFn) {
    // Default fallback
    scoreHistory.push(100);
    if (scoreHistory.length > SMOOTHING_WINDOW) {
      scoreHistory.shift();
    }
    return {
      score: 100,
      color: "green",
      message: "Good form ✅",
      issues: [],
      deviation: 0,
    };
  }

  // Update the deviation profiler with a posture metric specific to the exercise
  let postureMetric = 0;
if (
  exerciseKey === "pushup" ||
  exerciseKey === "plank" ||
  exerciseKey === "flutterKicks"
) {
  postureMetric = ctx.bodyLine;

} else if (exerciseKey === "squat" || exerciseKey === "lunge") {
  postureMetric = ctx.lateralScore;

} else if (
  exerciseKey === "bicepCurl" ||
  exerciseKey === "shoulderPress" ||
  exerciseKey === "chestPressPunches"
) {
  // Use shoulder angle for primary posture tracking
  postureMetric = ctx.shoulder;

  // Also track wrist rotation deviation when available
  const supScore = ctx.wristSupinationScore;
  if (typeof supScore === "number" && !isNaN(supScore)) {
    jointDeviationProfiler.update(supScore * 100);
  }
}
  if (postureMetric !== undefined && postureMetric !== null && !isNaN(postureMetric)) {
   // skeletalSense.update(postureMetric);
  }

  const detectedIssues = ruleFn(ctx);

  // 1. Calculate Raw Score
  let rawScore = 100;
  detectedIssues.forEach((issue) => {
    rawScore -= issue.penalty;
  });
  rawScore = Math.max(0, Math.min(100, rawScore));

  // 2. Apply Smoothing
  const finalScore = getSmoothedScore(rawScore);

  // 3. Determine Color
  let color: "green" | "yellow" | "red" = "red";
  if (finalScore > 80) color = "green";
  else if (finalScore > 60) color = "yellow";

  // 4. Prioritize Feedback Message
  // Sort by severity (high weight first)
  const sortedIssues = [...detectedIssues].sort((a, b) => {
    return (
      (severityWeight[a.severity] || 0) - (severityWeight[b.severity] || 0)
    );
  });

  const message =
    sortedIssues.length > 0 ? sortedIssues[0].message : "Good form ✅";

  return {
    score: finalScore,
    color,
    message,
    issues: detectedIssues,
    deviation: 0,
  };
}

/**
 * Categorizes all collected posture deviation data points from the current session
 * into distinct error classes using a Gaussian Mixture Model.
 */
export function getPostureErrorCategories(): Record<string, number> {
  const data = jointDeviationProfiler.getAllValues();
  if (data.length < 3) return {};

  const gmm = new GaussianMixtureModel(3);
  gmm.fit(data);

  const clusters = gmm.getClusters().map((c, index) => ({ ...c, index })).sort((a, b) => a.mean - b.mean);

  const categories: Record<string, number> = {};

  // Create dynamic category names based on severity (mean deviation from ideal)
  // The lower mean might be "Minor", higher might be "Severe"
  const categoryNames = ["Minor Form Deviation", "Moderate Form Deviation", "Severe Form Deviation"];

  data.forEach(val => {
    const k = gmm.predict(val);
    const rank = clusters.findIndex(c => c.index === k);
    if (rank >= 0 && rank < 3) {
      const catName = categoryNames[rank];
      categories[catName] = (categories[catName] || 0) + 1;
    }
  });

  return categories;
}

/**
 * Resets the smoothing history (call when starting a new session)
 */
export function resetFeedbackEngine(): void {
  scoreHistory = [];
  //skeletalSense.reset();
}
