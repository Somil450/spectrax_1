/**
 * feedbackEngine.ts
 * Real-time fitness coaching engine with prioritized feedback and scoring.
 */

// --- Types & Interfaces ---
import { JointDeviationProfiler } from '../services/skeletalSense';

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

const jointDeviationProfiler = new JointDeviationProfiler();

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
      deviation: jointDeviationProfiler.getStandardDeviation(),
    };
  }

  // Update the deviation profiler with a posture metric specific to the exercise
  let postureMetric = 0;
  if (exerciseKey === 'pushup' || exerciseKey === 'plank') {
    postureMetric = ctx.bodyLine;
  } else if (exerciseKey === 'squat' || exerciseKey === 'lunge') {
    postureMetric = ctx.lateralScore;
  } else if (exerciseKey === 'bicepCurl') {
    postureMetric = ctx.shoulder;
  }
  
  if (postureMetric !== undefined && postureMetric !== null && !isNaN(postureMetric)) {
    jointDeviationProfiler.update(postureMetric);
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
    deviation: jointDeviationProfiler.getStandardDeviation(),
  };
}

/**
 * Resets the smoothing history (call when starting a new session)
 */
export function resetFeedbackEngine(): void {
  scoreHistory = [];
  jointDeviationProfiler.reset();
}
