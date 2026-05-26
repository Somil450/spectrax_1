/**
 * skeletalSense.ts
 * Offline geometric heuristic engine for exercise detection.
 * Uses joint angles and relative positions for deterministic classification.
 */

export interface SkeletalResult {
  label: string;
  confidence: number;
}

class SkeletalSense {
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

    // PLANK: Steady horizontal posture
    if (Math.abs(lShoulder.y - lHip.y) < 0.1 && Math.abs(lHip.y - lAnkle.y) < 0.1) {
      return { label: "PLANK", confidence: 0.82 };
    }

    return { label: "STANDING", confidence: 0.5 };
  }
}

export const skeletalSense = new SkeletalSense();

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
