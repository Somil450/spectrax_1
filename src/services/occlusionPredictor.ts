export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface PredictedLandmarks {
  landmarks: Landmark[];
  confidence: number[];
  wasOccluded: boolean[];
}

interface BoneLength {
  left: number;
  right: number;
  calibrated: boolean;
}

interface BoneLengthMap {
  upperArm: BoneLength;
  forearm: BoneLength;
  thigh: BoneLength;
  shin: BoneLength;
  torsoSide: BoneLength;
  shoulderWidth: number;
  hipWidth: number;
}

interface HistoryFrame {
  landmarks: Landmark[];
  timestamp: number;
}

const OCCLUSION_THRESHOLD = 0.5;
const HISTORY_SIZE = 10;
const CALIBRATION_FRAMES = 30;
const MAX_MIRROR_CONFIDENCE = 0.85;
const MAX_TEMPORAL_CONFIDENCE = 0.65;
const BONE_LENGTH_TOLERANCE = 0.15;

const PAIRS: [number, number][] = [
  [11, 12], [13, 14], [15, 16], [17, 18], [19, 20], [21, 22],
  [23, 24], [25, 26], [27, 28], [29, 30], [31, 32],
];

const BONE_CONNECTIONS: [number, number][] = [
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [23, 25], [25, 27],
  [24, 26], [26, 28],
  [11, 23], [12, 24],
];

const MIDLINE_JOINTS = [11, 12, 23, 24];

export class OcclusionPredictor {
  private history: HistoryFrame[] = [];
  private boneLengths: BoneLengthMap = this.freshBoneLengths();
  private calibFrames = 0;

  private freshBoneLengths(): BoneLengthMap {
    return {
      upperArm: { left: 0, right: 0, calibrated: false },
      forearm: { left: 0, right: 0, calibrated: false },
      thigh: { left: 0, right: 0, calibrated: false },
      shin: { left: 0, right: 0, calibrated: false },
      torsoSide: { left: 0, right: 0, calibrated: false },
      shoulderWidth: 0,
      hipWidth: 0,
    };
  }

  reset(): void {
    this.history = [];
    this.boneLengths = this.freshBoneLengths();
    this.calibFrames = 0;
  }

  predict(landmarks: Landmark[]): PredictedLandmarks {
    const result: Landmark[] = landmarks.map((lm) => ({ ...lm }));
    const confidence: number[] = new Array(33).fill(1);
    const wasOccluded: boolean[] = new Array(33).fill(false);

    if (!landmarks || landmarks.length < 33) {
      return { landmarks: result, confidence, wasOccluded };
    }

    this.updateHistory(landmarks);
    this.calibrateBoneLengths(landmarks);

    const midlineX = this.computeMidlineX(landmarks);

    for (let i = 0; i < 33; i++) {
      if (result[i].visibility >= OCCLUSION_THRESHOLD) continue;

      wasOccluded[i] = true;
      let bestPos: { x: number; y: number; z: number } | null = null;
      let bestConf = 0;

      const mirrorPos = this.mirrorPredict(i, landmarks, midlineX);
      if (mirrorPos) {
        bestPos = mirrorPos;
        bestConf = MAX_MIRROR_CONFIDENCE;
      }

      const temporalPos = this.temporalPredict(i);
      if (temporalPos && temporalPos.confidence > bestConf) {
        bestPos = temporalPos.position;
        bestConf = temporalPos.confidence;
      }

      if (bestPos) {
        result[i].x = bestPos.x;
        result[i].y = bestPos.y;
        result[i].z = bestPos.z;
        result[i].visibility = Math.max(result[i].visibility, 0.5);
      }

      confidence[i] = bestConf > 0 ? bestConf : 0.3;
    }

    this.boneLengthRefine(result, landmarks);

    return { landmarks: result, confidence, wasOccluded };
  }

  private computeMidlineX(landmarks: Landmark[]): number {
    const valid = MIDLINE_JOINTS.filter((i) => landmarks[i]?.visibility > OCCLUSION_THRESHOLD);
    if (valid.length === 0) return 0.5;
    return valid.reduce((s, i) => s + landmarks[i].x, 0) / valid.length;
  }

  private mirrorPredict(
    idx: number,
    landmarks: Landmark[],
    midlineX: number,
  ): { x: number; y: number; z: number } | null {
    const pair = PAIRS.find(([a, b]) => a === idx || b === idx);
    if (!pair) return null;

    const mirrorIdx = pair[0] === idx ? pair[1] : pair[0];
    const mirror = landmarks[mirrorIdx];
    if (!mirror || mirror.visibility < OCCLUSION_THRESHOLD) return null;

    return {
      x: 2 * midlineX - mirror.x,
      y: mirror.y,
      z: -mirror.z,
    };
  }

  private temporalPredict(
    idx: number,
  ): { position: { x: number; y: number; z: number }; confidence: number } | null {
    if (this.history.length < 3) return null;

    const prev = this.history[this.history.length - 2]?.landmarks[idx];
    const prevPrev = this.history[this.history.length - 3]?.landmarks[idx];

    if (!prev || !prevPrev) return null;
    if (prev.visibility < OCCLUSION_THRESHOLD && prevPrev.visibility < OCCLUSION_THRESHOLD) return null;

    const loss = this.history.slice(-3).filter((f) => f.landmarks[idx].visibility < OCCLUSION_THRESHOLD).length;

    const velocity = {
      x: prev.x - prevPrev.x,
      y: prev.y - prevPrev.y,
      z: prev.z - prevPrev.z,
    };

    const confidence = MAX_TEMPORAL_CONFIDENCE * (1 - loss / 3);

    return {
      position: {
        x: prev.x + velocity.x,
        y: prev.y + velocity.y,
        z: prev.z + velocity.z,
      },
      confidence,
    };
  }

  private calibrateBoneLengths(landmarks: Landmark[]): void {
    if (this.boneLengths.upperArm.calibrated) return;

    const allAboveThreshold = (indices: number[]) =>
      indices.every((i) => landmarks[i]?.visibility > 0.7);

    const tryCalibrate = (
      key: keyof BoneLengthMap,
      leftA: number,
      leftB: number,
      rightA: number,
      rightB: number,
    ) => {
      if (allAboveThreshold([leftA, leftB, rightA, rightB])) {
        const left = dist(landmarks[leftA], landmarks[leftB]);
        const right = dist(landmarks[rightA], landmarks[rightB]);
        const entry = this.boneLengths[key] as BoneLength;
        entry.left = entry.left * 0.9 + left * 0.1;
        entry.right = entry.right * 0.9 + right * 0.1;
      }
    };

    tryCalibrate("upperArm", 11, 13, 12, 14);
    tryCalibrate("forearm", 13, 15, 14, 16);
    tryCalibrate("thigh", 23, 25, 24, 26);
    tryCalibrate("shin", 25, 27, 26, 28);
    tryCalibrate("torsoSide", 11, 23, 12, 24);

    if (allAboveThreshold([11, 12])) {
      this.boneLengths.shoulderWidth =
        this.boneLengths.shoulderWidth * 0.9 + dist(landmarks[11], landmarks[12]) * 0.1;
    }
    if (allAboveThreshold([23, 24])) {
      this.boneLengths.hipWidth =
        this.boneLengths.hipWidth * 0.9 + dist(landmarks[23], landmarks[24]) * 0.1;
    }

    this.calibFrames++;

    if (this.calibFrames >= CALIBRATION_FRAMES) {
      const keys: (keyof BoneLengthMap)[] = [
        "upperArm", "forearm", "thigh", "shin", "torsoSide",
      ];
      for (const key of keys) {
        const entry = this.boneLengths[key] as BoneLength;
        if (entry.left > 0 && entry.right > 0) {
          entry.calibrated = true;
        }
      }
    }
  }

  private boneLengthRefine(landmarks: Landmark[], raw: Landmark[]): void {
    for (const [a, b] of BONE_CONNECTIONS) {
      const boneKey = this.getBoneKey(a, b);
      if (!boneKey) continue;

      const entry = this.boneLengths[boneKey] as BoneLength | undefined;
      if (!entry?.calibrated) continue;

      const expectedLength = this.getExpectedLength(a, entry);
      if (expectedLength <= 0) continue;

      const knownIdx = raw[a].visibility >= OCCLUSION_THRESHOLD ? a : raw[b].visibility >= OCCLUSION_THRESHOLD ? b : -1;
      const predictedIdx = knownIdx === a ? b : knownIdx === b ? a : -1;

      if (knownIdx === -1 || predictedIdx === -1) continue;

      const actualLength = dist(landmarks[knownIdx], landmarks[predictedIdx]);
      if (actualLength <= 0) continue;

      const ratio = expectedLength / actualLength;
      if (Math.abs(ratio - 1) > BONE_LENGTH_TOLERANCE) {
        landmarks[predictedIdx].x =
          landmarks[knownIdx].x + (landmarks[predictedIdx].x - landmarks[knownIdx].x) * ratio;
        landmarks[predictedIdx].y =
          landmarks[knownIdx].y + (landmarks[predictedIdx].y - landmarks[knownIdx].y) * ratio;
        landmarks[predictedIdx].z =
          landmarks[knownIdx].z + (landmarks[predictedIdx].z - landmarks[knownIdx].z) * ratio;
      }
    }
  }

  private getBoneKey(a: number, b: number): keyof BoneLengthMap | null {
    const sorted = [a, b].sort((x, y) => x - y);
    const map: Record<string, keyof BoneLengthMap> = {
      "11,13": "upperArm",
      "13,15": "forearm",
      "12,14": "upperArm",
      "14,16": "forearm",
      "23,25": "thigh",
      "25,27": "shin",
      "24,26": "thigh",
      "26,28": "shin",
      "11,23": "torsoSide",
      "12,24": "torsoSide",
    };
    return map[`${sorted[0]},${sorted[1]}`] ?? null;
  }

  private getExpectedLength(idx: number, entry: BoneLength): number {
    const isLeft = [11, 13, 23, 25].includes(idx);
    return isLeft ? entry.left : entry.right;
  }

  private updateHistory(landmarks: Landmark[]): void {
    this.history.push({
      landmarks: landmarks.map((lm) => ({ ...lm })),
      timestamp: Date.now(),
    });
    if (this.history.length > HISTORY_SIZE) {
      this.history.shift();
    }
  }
}

function dist(a: { x: number; y: number; z?: number }, b: { x: number; y: number; z?: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
