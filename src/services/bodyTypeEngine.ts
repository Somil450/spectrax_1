export type BodyType = 'ecto' | 'meso' | 'endo' | 'scanning';

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

  private readonly REFERENCE_TORSO_FEMUR_RATIO = 1.6;

  public analyze(landmarks: any[]): BodyTypeResult {
    // We only use visible landmarks > 0.5
    const checkVis = (...indices: number[]) => indices.every(i => landmarks[i] && landmarks[i].visibility > 0.5);

    if (!checkVis(11, 12, 23, 24, 25, 27, 26, 28, 13, 15, 14, 16)) {
      return { bodyType: 'scanning', confidence: 0, adaptiveFactor: 1.0, explanation: 'Waiting for full body visibility...' };
    }

    const dist = (p1: any, p2: any) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(p1.z - p2.z, 2));

    const shoulderWidth = dist(landmarks[11], landmarks[12]);
    const hipWidth = dist(landmarks[23], landmarks[24]);
    
    // Midpoints
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

    const torsoLength = dist(shoulderMid, hipMid);
    
    // Femurs (hip-to-knee) — the key ratio for squat/lunge mechanics
    const leftFemur = dist(landmarks[23], landmarks[25]);
    const rightFemur = dist(landmarks[24], landmarks[26]);
    const femurLength = (leftFemur + rightFemur) / 2;

    // Full legs (hip-to-knee + knee-to-ankle)
    const leftLeg = leftFemur + dist(landmarks[25], landmarks[27]);
    const rightLeg = rightFemur + dist(landmarks[26], landmarks[28]);
    const legLength = (leftLeg + rightLeg) / 2;

    // Arms
    const leftArm = dist(landmarks[11], landmarks[13]) + dist(landmarks[13], landmarks[15]);
    const rightArm = dist(landmarks[12], landmarks[14]) + dist(landmarks[14], landmarks[16]);
    const armLength = (leftArm + rightArm) / 2;

    // Prevent div by 0 just in case
    if (hipWidth === 0 || legLength === 0 || torsoLength === 0 || femurLength === 0) {
      return { bodyType: 'scanning', confidence: 0, adaptiveFactor: 1.0, explanation: 'Invalid body dimensions...' };
    }

    const shoulderToHip = shoulderWidth / hipWidth;
    const torsoToLeg = torsoLength / legLength;
    const torsoToFemur = torsoLength / femurLength;
    const armToTorso = armLength / torsoLength;

    // Adaptive calibration factor: body-type-specific ±10% threshold scaling
    // When torsoToFemur > reference → shorter femurs → thresholds decrease (factor < 1.0)
    // When torsoToFemur < reference → longer femurs → thresholds increase (factor > 1.0)
    const rawFactor = this.REFERENCE_TORSO_FEMUR_RATIO / torsoToFemur;
    Math.min(1.1, Math.max(0.9, rawFactor));

    this.history.push({ shoulderToHip, torsoToLeg, torsoToFemur, armToTorso });
    if (this.history.length > this.HISTORY_SIZE) {
      this.history.shift();
    }

    if (this.history.length < this.HISTORY_SIZE) {
      const pct = Math.round((this.history.length / this.HISTORY_SIZE) * 100);
      return { bodyType: 'scanning', confidence: 0, adaptiveFactor: 1.0, explanation: `Scanning geometry ${pct}%...` };
    }

    const avg = this.history.reduce((acc, curr) => ({
      shoulderToHip: acc.shoulderToHip + curr.shoulderToHip,
      torsoToLeg: acc.torsoToLeg + curr.torsoToLeg,
      torsoToFemur: acc.torsoToFemur + curr.torsoToFemur,
      armToTorso: acc.armToTorso + curr.armToTorso,
    }), { shoulderToHip: 0, torsoToLeg: 0, torsoToFemur: 0, armToTorso: 0 });

    avg.shoulderToHip /= this.HISTORY_SIZE;
    avg.torsoToLeg /= this.HISTORY_SIZE;
    avg.torsoToFemur /= this.HISTORY_SIZE;
    avg.armToTorso /= this.HISTORY_SIZE;

    // Recompute adaptive factor from smoothed ratios
    const smoothedFactor = this.REFERENCE_TORSO_FEMUR_RATIO / avg.torsoToFemur;
    const smoothedAdaptiveFactor = Math.min(1.1, Math.max(0.9, smoothedFactor));

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
        shoulderWidth,
        hipWidth,
        torsoLength,
        legLength,
        femurLength,
        armLength,
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
