/**
 * skeletalSense.ts
 * Offline geometric heuristic engine for exercise detection.
 * Uses joint angles and relative positions for deterministic classification.
 */

export interface SkeletalResult {
  label: string;
  confidence: number;
}

export interface PoseFrame {
  timestamp: number;
  landmarks: any[];
}

export interface JointStressEntry {
  joint: string;
  landmarkIndex: number;
  peakSpeed: number;
  rangeOfMotion: number;
  bsi: number;
  riskTier: "low" | "moderate" | "high" | "critical";
}

export interface BSIReport {
  generatedAt: string;
  framesAnalysed: number;
  durationSeconds: number;
  joints: JointStressEntry[];
  mostStressedJoint: string;
  sessionBSI: number;
  sessionRiskTier: "low" | "moderate" | "high" | "critical";
  recommendation: string;
}

export interface BSIDashboardSeries {
  labels: string[];
  bsiValues: number[];
  speedValues: number[];
  romValues: number[];
  riskColors: string[];
}


const SPEED_MAX_DEG_S = 500;
const ROM_MAX_DEG = 180;
const WEIGHT_SPEED = 0.55;
const WEIGHT_ROM = 0.45;
const VISIBILITY_THRESHOLD = 0.5;

const RISK_COLORS: Record<string, string> = {
  low: "#22c55e",
  moderate: "#f59e0b",
  high: "#ef4444",
  critical: "#7c3aed",
};

const RECOMMENDATIONS: Record<string, string> = {
  low: "Joint load is within safe limits. Maintain current form and stay hydrated.",
  moderate: "Moderate joint stress detected. Consider a brief rest and focus on controlled movements.",
  high: "High joint stress detected. Reduce speed or load and prioritise recovery.",
  critical: "Critical stress level! Stop and rest immediately before continuing.",
};

interface JointDefinition {
  name: string;
  proximal: number;
  vertex: number;
  distal: number;
}

const JOINT_DEFINITIONS: JointDefinition[] = [
  { name: "LEFT_HIP", proximal: 11, vertex: 23, distal: 25 },
  { name: "RIGHT_HIP", proximal: 12, vertex: 24, distal: 26 },
  { name: "LEFT_KNEE", proximal: 23, vertex: 25, distal: 27 },
  { name: "RIGHT_KNEE", proximal: 24, vertex: 26, distal: 28 },
  { name: "LEFT_ANKLE", proximal: 25, vertex: 27, distal: 31 },
  { name: "RIGHT_ANKLE", proximal: 26, vertex: 28, distal: 32 },
  { name: "LEFT_SHOULDER", proximal: 11, vertex: 11, distal: 13 },
  { name: "RIGHT_SHOULDER", proximal: 12, vertex: 12, distal: 14 },
  { name: "LEFT_ELBOW", proximal: 11, vertex: 13, distal: 15 },
  { name: "RIGHT_ELBOW", proximal: 12, vertex: 14, distal: 16 },
  { name: "LEFT_WRIST", proximal: 13, vertex: 15, distal: 17 },
  { name: "RIGHT_WRIST", proximal: 14, vertex: 16, distal: 18 },
];

function jointAngleDeg(a: any, b: any, c: any): number {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) angle = 360 - angle;
  return angle;
}

function normalise(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function toRiskTier(bsi: number): "low" | "moderate" | "high" | "critical" {
  if (bsi < 25) return "low";
  if (bsi < 50) return "moderate";
  if (bsi < 75) return "high";
  return "critical";
}

function hasValidLandmarks(def: JointDefinition, landmarks: any[]): boolean {
  return [def.proximal, def.vertex, def.distal].every((idx) => {
    const lm = landmarks[idx];
    return lm != null && (lm.visibility == null || lm.visibility >= VISIBILITY_THRESHOLD);
  });
}

export class SkeletalSense {
  private calculateAngle(a: any, b: any, c: any): number {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
  }

  analyze(landmarks: any[]): SkeletalResult | null {
    if (!landmarks || landmarks.length < 33) return null;

    // 1. Extract Key Joints
    const lElbow = landmarks[13], lShoulder = landmarks[11], lWrist = landmarks[15];
    const rElbow = landmarks[14], rShoulder = landmarks[12], rWrist = landmarks[16];
    const lHip = landmarks[23], lKnee = landmarks[25], lAnkle = landmarks[27];
    const rHip = landmarks[24], rKnee = landmarks[26], rAnkle = landmarks[28];

    // 2. Calculate Angles
    const leftArmAngle = this.calculateAngle(lShoulder, lElbow, lWrist);
    const rightArmAngle = this.calculateAngle(rShoulder, rElbow, rWrist);
    const leftLegAngle = this.calculateAngle(lHip, lKnee, lAnkle);
    const rightLegAngle = this.calculateAngle(rHip, rKnee, rAnkle);

    // 3. Classification Heuristics

    // SQUAT: Significant knee bend + hips lower than shoulders
    if (leftLegAngle < 120 && rightLegAngle < 120 && lHip.y > lShoulder.y) {
      return { label: "SQUAT", confidence: 0.95 };
    }

    // BICEP CURL: Significant elbow bend + arms mostly vertical
    if ((leftArmAngle < 60 || rightArmAngle < 60) && Math.abs(lShoulder.x - lElbow.x) < 0.1) {
      return { label: "BICEP CURL", confidence: 0.90 };
    }

    // PUSHUP: Horizontal body alignment (shoulders and hips same height)
    if (Math.abs(lShoulder.y - lHip.y) < 0.15 && Math.abs(lShoulder.y - landmarks[0].y) < 0.2) {
      // Check for arm movement in and out of 90 degrees
      return { label: "PUSHUP", confidence: 0.85 };
    }

    // JUMPING JACKS: Arms and legs wide
    const armWidth = Math.abs(lWrist.x - rWrist.x);
    const legWidth = Math.abs(lAnkle.x - rAnkle.x);
    if (armWidth > 0.6 && legWidth > 0.4) {
      return { label: "JUMPING JACK", confidence: 0.88 };
    }

    // CHEST PRESS / PUNCHES: Standing with elbows at chest/shoulder height, and arms pressing forward (not wide like jumping jacks)
    const leftShoulderAngle = this.calculateAngle(lElbow, lShoulder, lHip);
    const rightShoulderAngle = this.calculateAngle(rElbow, rShoulder, rHip);
    if (
      lHip.y > lShoulder.y &&
      rHip.y > rShoulder.y &&
      ((leftShoulderAngle > 65 && leftShoulderAngle < 115) || (rightShoulderAngle > 65 && rightShoulderAngle < 115)) &&
      armWidth < 0.5 &&
      (leftArmAngle > 70 || rightArmAngle > 70)
    ) {
      return { label: "CHEST PRESS / PUNCHES", confidence: 0.85 };
    }

    // FLUTTER KICKS: lying flat on back with legs kicking
    if (Math.abs(lShoulder.y - lHip.y) < 0.12 && Math.abs(lShoulder.y - lWrist.y) < 0.15) {
      return { label: "FLUTTER KICKS", confidence: 0.88 };
    }

    // PLANK: Steady horizontal posture
    if (Math.abs(lShoulder.y - lHip.y) < 0.1 && Math.abs(lHip.y - lAnkle.y) < 0.1) {
      return { label: "PLANK", confidence: 0.82 };
    }

    return { label: "STANDING", confidence: 0.5 };
  }

  analyseBSI(frames: PoseFrame[]): BSIReport {
    if (frames.length < 2) {
      return {
        generatedAt: new Date().toISOString(),
        framesAnalysed: frames.length,
        durationSeconds: 0,
        joints: [],
        mostStressedJoint: "N/A",
        sessionBSI: 0,
        sessionRiskTier: "low",
        recommendation: "Not enough data. Ensure pose detection is active.",
      };
    }

    const durationSeconds =
      (frames[frames.length - 1].timestamp - frames[0].timestamp) / 1000;

    const joints = JOINT_DEFINITIONS.map((def) => this._computeJointStress(def, frames));
    const sessionBSI = joints.reduce((sum, j) => sum + j.bsi, 0) / joints.length;
    const mostStressed = joints.reduce((prev, curr) => (curr.bsi > prev.bsi ? curr : prev));
    const sessionRiskTier = toRiskTier(sessionBSI);

    return {
      generatedAt: new Date().toISOString(),
      framesAnalysed: frames.length,
      durationSeconds,
      joints,
      mostStressedJoint: mostStressed.joint,
      sessionBSI: parseFloat(sessionBSI.toFixed(2)),
      sessionRiskTier,
      recommendation: RECOMMENDATIONS[sessionRiskTier],
    };
  }

  snapshotBSI(frameA: PoseFrame, frameB: PoseFrame): Record<string, number> {
    const dtSeconds = (frameB.timestamp - frameA.timestamp) / 1000;
    if (dtSeconds <= 0) return {};

    const result: Record<string, number> = {};
    for (const def of JOINT_DEFINITIONS) {
      if (!hasValidLandmarks(def, frameA.landmarks) || !hasValidLandmarks(def, frameB.landmarks)) continue;

      const angleA = jointAngleDeg(frameA.landmarks[def.proximal], frameA.landmarks[def.vertex], frameA.landmarks[def.distal]);
      const angleB = jointAngleDeg(frameB.landmarks[def.proximal], frameB.landmarks[def.vertex], frameB.landmarks[def.distal]);
      const bsi = clamp(
        WEIGHT_SPEED * normalise(Math.abs(angleB - angleA) / dtSeconds, 0, SPEED_MAX_DEG_S) +
        WEIGHT_ROM * normalise(Math.abs(angleB - angleA), 0, ROM_MAX_DEG),
        0, 100
      );
      result[def.name] = parseFloat(bsi.toFixed(2));
    }
    return result;
  }

  private _computeJointStress(def: JointDefinition, frames: PoseFrame[]): JointStressEntry {
    const angles: number[] = [];
    const velocities: number[] = [];

    for (const frame of frames) {
      if (!hasValidLandmarks(def, frame.landmarks)) continue;
      angles.push(jointAngleDeg(frame.landmarks[def.proximal], frame.landmarks[def.vertex], frame.landmarks[def.distal]));
    }

    for (let i = 1; i < frames.length; i++) {
      const lmA = frames[i - 1].landmarks, lmB = frames[i].landmarks;
      const dt = (frames[i].timestamp - frames[i - 1].timestamp) / 1000;
      if (dt <= 0 || !hasValidLandmarks(def, lmA) || !hasValidLandmarks(def, lmB)) continue;
      const aA = jointAngleDeg(lmA[def.proximal], lmA[def.vertex], lmA[def.distal]);
      const aB = jointAngleDeg(lmB[def.proximal], lmB[def.vertex], lmB[def.distal]);
      velocities.push(Math.abs(aB - aA) / dt);
    }

    const peakSpeed = velocities.length > 0 ? Math.max(...velocities) : 0;
    const rangeOfMotion = angles.length > 1 ? Math.max(...angles) - Math.min(...angles) : 0;
    const bsi = clamp(
      WEIGHT_SPEED * normalise(peakSpeed, 0, SPEED_MAX_DEG_S) +
      WEIGHT_ROM * normalise(rangeOfMotion, 0, ROM_MAX_DEG),
      0, 100
    );

    return {
      joint: def.name,
      landmarkIndex: def.vertex,
      peakSpeed: parseFloat(peakSpeed.toFixed(2)),
      rangeOfMotion: parseFloat(rangeOfMotion.toFixed(2)),
      bsi: parseFloat(bsi.toFixed(2)),
      riskTier: toRiskTier(bsi),
    };
  }

}

export const skeletalSense = new SkeletalSense();


export function toBSIDashboardSeries(report: BSIReport): BSIDashboardSeries {
  return {
    labels: report.joints.map((j) => j.joint),
    bsiValues: report.joints.map((j) => j.bsi),
    speedValues: report.joints.map((j) => j.peakSpeed),
    romValues: report.joints.map((j) => j.rangeOfMotion),
    riskColors: report.joints.map((j) => RISK_COLORS[j.riskTier]),
  };
}

/**
 * A helper class to compute running variance and standard deviation
 * dynamically using Welford's online algorithm. Used to track form fatigue
 * and posture inconsistencies across repetitions.
 */
export class JointDeviationProfiler {
  private count = 0;
  private mean = 0;
  private m2 = 0;

  /**
   * Adds a new value to the running statistics.
   */
  public update(value: number): void {
    this.count++;
    const delta = value - this.mean;
    this.mean += delta / this.count;
    const delta2 = value - this.mean;
    this.m2 += delta * delta2;
  }

  /**
   * Returns the current variance of the collected values.
   */
  public getVariance(): number {
    if (this.count < 2) return 0;
    return this.m2 / (this.count - 1);
  }

  /**
   * Returns the current standard deviation of the collected values.
   */
  public getStandardDeviation(): number {
    return Math.sqrt(this.getVariance());
  }

  /**
   * Returns the current mean.
   */
  public getMean(): number {
    return this.mean;
  }

  /**
   * Resets the running statistics.
   */
  public reset(): void {
    this.count = 0;
    this.mean = 0;
    this.m2 = 0;
  }
}
