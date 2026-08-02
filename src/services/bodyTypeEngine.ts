export type BodyType = 'ecto' | 'meso' | 'endo' | 'scanning';

/**
 * Reference torso-to-femur bone ratio (average human ~1.6). Ratios above it
 * mean relatively shorter femurs (compact/tight frame); ratios below it mean
 * relatively longer femurs (extended limbs). Drives the ±10% adaptive shift.
 */
export const REFERENCE_TORSO_FEMUR_RATIO = 1.6;

/**
 * Maps a measured torso-to-femur ratio to an adaptive calibration factor
 * clamped to a ±10% margin.
 *
 *   ratio > reference (short femurs) → factor < 1 (relax thresholds)
 *   ratio < reference (long femurs)  → factor > 1 (tighten thresholds)
 */
export function computeAdaptiveFactor(
  torsoToFemur: number,
  reference: number = REFERENCE_TORSO_FEMUR_RATIO,
): number {
  if (!Number.isFinite(torsoToFemur) || torsoToFemur <= 0) return 1.0;
  const factor = reference / torsoToFemur;
  return Math.min(1.1, Math.max(0.9, factor));
}

export interface BodyMetrics {
  shoulderWidth: number;
  hipWidth: number;
  torsoLength: number;
  legLength: number;
  femurLength: number;
  armLength: number;
  ratios: {
    shoulderToHip: number;
    torsoToLeg: number;
    torsoToFemur: number;
    armToTorso: number;
  };
}

export interface BodyTypeResult {
  bodyType: BodyType;
  confidence: number;
  metrics?: BodyMetrics;
  adaptiveFactor: number;
  explanation: string;
}

class BodyTypeEngine {
  private history: {
    shoulderToHip: number;
    torsoToLeg: number;
    torsoToFemur: number;
    armToTorso: number;
  }[] = [];
  private readonly HISTORY_SIZE = 15;

  public reset() {
    this.history = [];
  }

  private dist(p1: any, p2: any): number {
    return Math.sqrt(
      Math.pow(p1.x - p2.x, 2) +
      Math.pow(p1.y - p2.y, 2) +
      Math.pow(p1.z - p2.z, 2),
    );
  }

  /**
   * Computes bone lengths and the key body ratios from a single frame, usable
   * during the calibration phase before the 15-frame history accumulates.
   * Returns null while key joints aren't all visible.
   */
  public computeBoneRatios(landmarks: any[]): BodyMetrics | null {
    const checkVis = (...indices: number[]) =>
      indices.every((i) => landmarks[i] && landmarks[i].visibility > 0.5);

    if (!checkVis(11, 12, 23, 24, 25, 27, 26, 28, 13, 15, 14, 16)) {
      return null;
    }

    const shoulderWidth = this.dist(landmarks[11], landmarks[12]);
    const hipWidth = this.dist(landmarks[23], landmarks[24]);

    const shoulderMid = {
      x: (landmarks[11].x + landmarks[12].x) / 2,
      y: (landmarks[11].y + landmarks[12].y) / 2,
      z: (landmarks[11].z + landmarks[12].z) / 2,
    };
    const hipMid = {
      x: (landmarks[23].x + landmarks[24].x) / 2,
      y: (landmarks[23].y + landmarks[24].y) / 2,
      z: (landmarks[23].z + landmarks[24].z) / 2,
    };

    const torsoLength = this.dist(shoulderMid, hipMid);

    // Femurs (hip-to-knee) — the key ratio for squat/lunge mechanics
    const leftFemur = this.dist(landmarks[23], landmarks[25]);
    const rightFemur = this.dist(landmarks[24], landmarks[26]);
    const femurLength = (leftFemur + rightFemur) / 2;

    // Full legs (hip-to-knee + knee-to-ankle)
    const leftLeg = leftFemur + this.dist(landmarks[25], landmarks[27]);
    const rightLeg = rightFemur + this.dist(landmarks[26], landmarks[28]);
    const legLength = (leftLeg + rightLeg) / 2;

    // Arms
    const leftArm = this.dist(landmarks[11], landmarks[13]) + this.dist(landmarks[13], landmarks[15]);
    const rightArm = this.dist(landmarks[12], landmarks[14]) + this.dist(landmarks[14], landmarks[16]);
    const armLength = (leftArm + rightArm) / 2;

    if (
      hipWidth === 0 ||
      legLength === 0 ||
      torsoLength === 0 ||
      femurLength === 0
    ) {
      return null;
    }

    return {
      shoulderWidth,
      hipWidth,
      torsoLength,
      legLength,
      femurLength,
      armLength,
      ratios: {
        shoulderToHip: shoulderWidth / hipWidth,
        torsoToLeg: torsoLength / legLength,
        torsoToFemur: torsoLength / femurLength,
        armToTorso: armLength / torsoLength,
      },
    };
  }

  public analyze(landmarks: any[]): BodyTypeResult {
    const metrics = this.computeBoneRatios(landmarks);

    if (!metrics) {
      return {
        bodyType: 'scanning',
        confidence: 0,
        adaptiveFactor: 1.0,
        explanation: 'Waiting for full body visibility...',
      };
    }

    const { shoulderToHip, torsoToLeg, torsoToFemur, armToTorso } = metrics.ratios;

    // Adaptive calibration factor: body-type-specific ±10% threshold scaling
    // When torsoToFemur > reference → shorter femurs → thresholds relax (factor < 1.0)
    // When torsoToFemur < reference → longer femurs → thresholds tighten (factor > 1.0)
    this.history.push({ shoulderToHip, torsoToLeg, torsoToFemur, armToTorso });
    if (this.history.length > this.HISTORY_SIZE) {
      this.history.shift();
    }

    if (this.history.length < this.HISTORY_SIZE) {
      const pct = Math.round((this.history.length / this.HISTORY_SIZE) * 100);
      return {
        bodyType: 'scanning',
        confidence: 0,
        adaptiveFactor: 1.0,
        explanation: `Scanning geometry ${pct}%...`,
      };
    }

    const avg = this.history.reduce(
      (acc, curr) => ({
        shoulderToHip: acc.shoulderToHip + curr.shoulderToHip,
        torsoToLeg: acc.torsoToLeg + curr.torsoToLeg,
        torsoToFemur: acc.torsoToFemur + curr.torsoToFemur,
        armToTorso: acc.armToTorso + curr.armToTorso,
      }),
      { shoulderToHip: 0, torsoToLeg: 0, torsoToFemur: 0, armToTorso: 0 },
    );

    avg.shoulderToHip /= this.HISTORY_SIZE;
    avg.torsoToLeg /= this.HISTORY_SIZE;
    avg.torsoToFemur /= this.HISTORY_SIZE;
    avg.armToTorso /= this.HISTORY_SIZE;

    // Recompute adaptive factor from smoothed ratios
    const smoothedAdaptiveFactor = computeAdaptiveFactor(avg.torsoToFemur);

    let type: BodyType = 'meso';
    let explanation = '';
    let confidence = 0.85;

    // Ecto: shoulder/hip ~1.0 AND torsoToLeg is low (long legs relative to torso)
    // Meso: shoulder/hip > 1.15 (broad shoulders)
    // Endo: shoulder/hip < 1.0 OR wide physical traits, torsoToLeg is high (short legs relative to torso)

    if (avg.shoulderToHip > 1.18) {
      type = 'meso';
      explanation = 'Broad shoulders & athletic structure \u2192 Mesomorph';
      confidence += Math.min(avg.shoulderToHip - 1.18, 0.1);
    } else if (avg.shoulderToHip < 1.05 || avg.torsoToLeg > 1.2) {
      type = 'endo';
      explanation = 'Wider torso & grounded limbs \u2192 Endomorph';
      confidence += Math.min(1.05 - avg.shoulderToHip, 0.1);
    } else {
      if (avg.torsoToLeg < 1.0) {
         type = 'ecto';
         explanation = 'Longer limbs & tighter frame \u2192 Ectomorph';
         confidence += Math.min(1.0 - avg.torsoToLeg, 0.1);
      } else {
         type = 'meso'; 
         explanation = 'Balanced frame & average limbs \u2192 Mesomorph';
      }
    }

    return {
      bodyType: type,
      // Cap confidence at 0.99 for realism
      confidence: Math.min(confidence, 0.99),
      adaptiveFactor: smoothedAdaptiveFactor,
      metrics: {
        shoulderWidth: metrics.shoulderWidth,
        hipWidth: metrics.hipWidth,
        torsoLength: metrics.torsoLength,
        legLength: metrics.legLength,
        femurLength: metrics.femurLength,
        armLength: metrics.armLength,
        ratios: {
          shoulderToHip: avg.shoulderToHip,
          torsoToLeg: avg.torsoToLeg,
          torsoToFemur: avg.torsoToFemur,
          armToTorso: avg.armToTorso,
        }
      },
      explanation
    };
  }
}

export const bodyTypeEngine = new BodyTypeEngine();
