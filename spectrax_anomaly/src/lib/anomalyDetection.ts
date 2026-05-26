// lib/anomalyDetection.ts — SpectraX Anomaly Detection Module (Issue #85)

import type {
  PoseLandmark,
  PoseFrame,
  EnrichedFrame,
  PoseFeatures,
  AnomalyResult,
  DetectionSummary,
  AnomalyAlgorithm,
  SimilarFrame,
} from '../types/anomaly';

// ---------------------------------------------------------------------------
// MediaPipe Pose landmark indices (for reference)
// ---------------------------------------------------------------------------
const LM = {
  NOSE: 0, L_EYE: 1, R_EYE: 2,
  L_SHOULDER: 11, R_SHOULDER: 12,
  L_ELBOW: 13,    R_ELBOW: 14,
  L_WRIST: 15,    R_WRIST: 16,
  L_HIP: 23,      R_HIP: 24,
  L_KNEE: 25,     R_KNEE: 26,
  L_ANKLE: 27,    R_ANKLE: 28,
} as const;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/** Returns the angle (degrees) at vertex B in the A-B-C triplet */
function angleDeg(A: PoseLandmark, B: PoseLandmark, C: PoseLandmark): number {
  const ax = A.x - B.x, ay = A.y - B.y;
  const cx = C.x - B.x, cy = C.y - B.y;
  const dot = ax * cx + ay * cy;
  const magAB = Math.sqrt(ax * ax + ay * ay);
  const magCB = Math.sqrt(cx * cx + cy * cy);
  if (magAB < 1e-9 || magCB < 1e-9) return 180;
  const cos = Math.min(1, Math.max(-1, dot / (magAB * magCB)));
  return Math.acos(cos) * (180 / Math.PI);
}

/** Vertical angle from a 2-point vector to the downward Y axis */
function verticalAngleDeg(A: PoseLandmark, B: PoseLandmark): number {
  const dx = B.x - A.x, dy = B.y - A.y;
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag < 1e-9) return 0;
  return Math.acos(Math.min(1, Math.max(-1, dy / mag))) * (180 / Math.PI);
}

// ---------------------------------------------------------------------------
// Feature extraction
// ---------------------------------------------------------------------------

/**
 * Extracts biomechanical features from a single MediaPipe pose frame.
 * Falls back gracefully when landmarks are occluded (visibility < 0.5).
 */
export function extractFeatures(landmarks: PoseLandmark[]): PoseFeatures {
  const lm = (idx: number) => landmarks[idx] ?? { x: 0.5, y: 0.5, z: 0, visibility: 0 };

  const lShoulder = lm(LM.L_SHOULDER), rShoulder = lm(LM.R_SHOULDER);
  const lElbow    = lm(LM.L_ELBOW),    rElbow    = lm(LM.R_ELBOW);
  const lWrist    = lm(LM.L_WRIST),    rWrist    = lm(LM.R_WRIST);
  const lHip      = lm(LM.L_HIP),      rHip      = lm(LM.R_HIP);
  const lKnee     = lm(LM.L_KNEE),     rKnee     = lm(LM.R_KNEE);
  const lAnkle    = lm(LM.L_ANKLE),    rAnkle    = lm(LM.R_ANKLE);

  // Mid-points
  const midShoulder: PoseLandmark = {
    x: (lShoulder.x + rShoulder.x) / 2,
    y: (lShoulder.y + rShoulder.y) / 2,
    z: (lShoulder.z + rShoulder.z) / 2,
  };
  const midHip: PoseLandmark = {
    x: (lHip.x + rHip.x) / 2,
    y: (lHip.y + rHip.y) / 2,
    z: (lHip.z + rHip.z) / 2,
  };

  return {
    kneeLeft:          angleDeg(lHip, lKnee, lAnkle),
    kneeRight:         angleDeg(rHip, rKnee, rAnkle),
    elbowLeft:         angleDeg(lShoulder, lElbow, lWrist),
    elbowRight:        angleDeg(rShoulder, rElbow, rWrist),
    hipFlexion:        angleDeg(midShoulder, lHip, lKnee),
    trunkLean:         verticalAngleDeg(midHip, midShoulder),
    shoulderSymmetry:  Math.abs(lShoulder.y - rShoulder.y),
    wristHeight:       (lWrist.y + rWrist.y) / 2,
  };
}

/** Enriches a batch of raw pose frames with computed features */
export function enrichFrames(frames: PoseFrame[]): EnrichedFrame[] {
  return frames.map(f => ({
    ...f,
    features: extractFeatures(f.landmarks),
  }));
}

// ---------------------------------------------------------------------------
// Statistics utilities
// ---------------------------------------------------------------------------

interface FeatureStats {
  mean: number;
  std: number;
  median: number;
  mad: number;   // median absolute deviation
}

function computeStats(values: number[]): FeatureStats {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const std  = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / n) || 1e-9;

  const sorted   = [...values].sort((a, b) => a - b);
  const median   = sorted[Math.floor(n / 2)];
  const devs     = sorted.map(v => Math.abs(v - median)).sort((a, b) => a - b);
  const mad      = devs[Math.floor(n / 2)] || 1e-9;

  return { mean, std, median, mad };
}

type FeatureStatsMap = Record<keyof PoseFeatures, FeatureStats>;

function buildStatsMap(frames: EnrichedFrame[]): FeatureStatsMap {
  const keys = Object.keys(frames[0].features) as Array<keyof PoseFeatures>;
  return Object.fromEntries(
    keys.map(k => [k, computeStats(frames.map(f => f.features[k]))])
  ) as FeatureStatsMap;
}

// ---------------------------------------------------------------------------
// Algorithm implementations
// ---------------------------------------------------------------------------

function zScoreScore(value: number, stats: FeatureStats): number {
  return Math.abs((value - stats.mean) / stats.std);
}

function madScore(value: number, stats: FeatureStats): number {
  // Modified Z-score (Iglewicz & Hoaglin) — robust to outliers in training data
  return Math.abs((value - stats.median) / (1.4826 * stats.mad));
}

// Simplified Isolation Forest (pure TS — no sklearn needed in browser/Node)
type IsoNode =
  | { isLeaf: true; size: number }
  | { isLeaf: false; featureKey: keyof PoseFeatures; splitVal: number; left: IsoNode; right: IsoNode };

function avgPathLength(n: number): number {
  if (n <= 1) return 0;
  return 2 * (Math.log(n - 1) + 0.5772156649) - 2 * (n - 1) / n;
}

function buildIsoTree(
  data: Array<Record<keyof PoseFeatures, number>>,
  indices: number[],
  depth: number,
  maxDepth: number,
  keys: Array<keyof PoseFeatures>,
): IsoNode {
  if (indices.length <= 1 || depth >= maxDepth) {
    return { isLeaf: true, size: indices.length };
  }

  const key = keys[Math.floor(Math.random() * keys.length)];
  const vals = indices.map(i => data[i][key]);
  const min = Math.min(...vals), max = Math.max(...vals);

  if (min === max) return { isLeaf: true, size: indices.length };

  const split = min + Math.random() * (max - min);
  const left  = indices.filter(i => data[i][key] < split);
  const right = indices.filter(i => data[i][key] >= split);

  return {
    isLeaf: false, featureKey: key, splitVal: split,
    left:  buildIsoTree(data, left,  depth + 1, maxDepth, keys),
    right: buildIsoTree(data, right, depth + 1, maxDepth, keys),
  };
}

function isoPathLength(node: IsoNode, point: Record<keyof PoseFeatures, number>, depth = 0): number {
  if (node.isLeaf) return depth + avgPathLength(node.size);
  const nonLeaf = node as { isLeaf: false; featureKey: keyof PoseFeatures; splitVal: number; left: IsoNode; right: IsoNode };
  return point[nonLeaf.featureKey] < nonLeaf.splitVal
    ? isoPathLength(nonLeaf.left,  point, depth + 1)
    : isoPathLength(nonLeaf.right, point, depth + 1);
}

function isoForestScore(
  data: Array<Record<keyof PoseFeatures, number>>,
  numTrees = 100,
  subSample = 256,
): number[] {
  const n = data.length;
  const sampleSize = Math.min(subSample, n);
  const maxDepth   = Math.ceil(Math.log2(sampleSize));
  const keys = Object.keys(data[0]) as Array<keyof PoseFeatures>;
  const cn   = avgPathLength(sampleSize);

  // Build forest
  const trees: IsoNode[] = [];
  for (let t = 0; t < numTrees; t++) {
    // Random sub-sample (with replacement)
    const idx: number[] = Array.from({ length: sampleSize }, () => Math.floor(Math.random() * n));
    trees.push(buildIsoTree(data, idx, 0, maxDepth, keys));
  }

  // Score each point: anomaly score 0–1, higher = more anomalous
  return data.map(point => {
    const avgPath = trees.reduce((sum, tree) => sum + isoPathLength(tree, point), 0) / trees.length;
    return Math.pow(2, -avgPath / cn); // standard IF score
  });
}

// ---------------------------------------------------------------------------
// Label & human-readable helpers
// ---------------------------------------------------------------------------

const FEATURE_READABLE: Record<keyof PoseFeatures, string> = {
  kneeLeft:          'left knee angle',
  kneeRight:         'right knee angle',
  elbowLeft:         'left elbow angle',
  elbowRight:        'right elbow angle',
  hipFlexion:        'hip flexion',
  trunkLean:         'trunk lean',
  shoulderSymmetry:  'shoulder symmetry',
  wristHeight:       'wrist height',
};

function buildHumanReadable(
  featureScores: Record<keyof PoseFeatures, number>,
  threshold: number,
  isAnomaly: boolean,
): string {
  if (!isAnomaly) return 'This frame looks normal — keep it up!';

  const hot = (Object.entries(featureScores) as Array<[keyof PoseFeatures, number]>)
    .filter(([, s]) => s > threshold * 0.75)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([k]) => FEATURE_READABLE[k]);

  if (hot.length === 0) return 'Slight deviation from your typical pattern.';
  if (hot.length === 1) return `Your ${hot[0]} looks off — check your form here.`;
  return `Unusual ${hot.slice(0, -1).join(', ')} and ${hot[hot.length - 1]} — possible form breakdown.`;
}

function scoreToLabel(score: number, threshold: number): AnomalyResult['label'] {
  if (score > threshold)       return 'Anomaly';
  if (score > threshold * 0.7) return 'Suspicious';
  return 'Normal';
}

function buildSummaryText(results: AnomalyResult[], threshold: number): string {
  const anomalies = results.filter(r => r.isAnomaly);
  if (anomalies.length === 0) return 'No anomalies detected — your form looks consistent throughout.';

  const worstTs = anomalies.reduce((w, r) => r.anomalyScore > w.anomalyScore ? r : w).timestamp;
  const windows = groupConsecutive(anomalies.map(r => Math.round(r.timestamp)));

  const windowStr = windows.length === 1
    ? `around the ${worstTs.toFixed(1)}s mark`
    : `at ${windows.length} separate moments`;

  return `${anomalies.length} anomalous frame${anomalies.length > 1 ? 's' : ''} detected ${windowStr}. Pay close attention to your form in those sections.`;
}

function groupConsecutive(nums: number[]): number[][] {
  const sorted = [...new Set(nums)].sort((a, b) => a - b);
  const groups: number[][] = [];
  let group: number[] = [];
  for (const n of sorted) {
    if (group.length === 0 || n - group[group.length - 1] <= 2) {
      group.push(n);
    } else {
      groups.push(group); group = [n];
    }
  }
  if (group.length) groups.push(group);
  return groups;
}

// ---------------------------------------------------------------------------
// Main public API
// ---------------------------------------------------------------------------

/**
 * Run anomaly detection on a batch of enriched pose frames.
 *
 * @example
 * const enriched = enrichFrames(rawFrames);
 * const summary  = detectAnomalies(enriched, { algorithm: 'zscore', threshold: 2.0 });
 * console.log(summary.summaryText);
 */
export function detectAnomalies(
  frames: EnrichedFrame[],
  options: {
    algorithm?: AnomalyAlgorithm;
    threshold?: number;
    isoForestTrees?: number;
  } = {},
): DetectionSummary {
  const {
    algorithm    = 'zscore',
    threshold    = 2.0,
    isoForestTrees = 100,
  } = options;

  if (frames.length < 3) throw new Error('Need at least 3 frames to run anomaly detection.');

  const featureData = frames.map(f => f.features as unknown as Record<keyof PoseFeatures, number>);
  const keys = Object.keys(frames[0].features) as Array<keyof PoseFeatures>;

  let rawScores: number[];
  let perFeatureScores: Array<Record<keyof PoseFeatures, number>>;

  if (algorithm === 'isoforest') {
    // Isolation Forest: single composite score, no per-feature breakdown
    const isoScores = isoForestScore(featureData, isoForestTrees);
    // Re-scale from [0,1] to [0, 5] for consistency with other methods
    rawScores = isoScores.map(s => s * 5);
    perFeatureScores = frames.map(() =>
      Object.fromEntries(keys.map(k => [k, 0])) as Record<keyof PoseFeatures, number>
    );
  } else {
    const statsMap = buildStatsMap(frames);
    perFeatureScores = featureData.map(fv =>
      Object.fromEntries(
        keys.map(k => {
          const s = algorithm === 'mad'
            ? madScore(fv[k], statsMap[k])
            : zScoreScore(fv[k], statsMap[k]);
          return [k, +s.toFixed(3)];
        })
      ) as Record<keyof PoseFeatures, number>
    );
    rawScores = perFeatureScores.map(fs =>
      keys.reduce((sum, k) => sum + fs[k], 0) / keys.length
    );
  }

  const results: AnomalyResult[] = frames.map((frame, i) => {
    const anomalyScore = +rawScores[i].toFixed(3);
    const isAnomaly    = anomalyScore > threshold;
    const label        = scoreToLabel(anomalyScore, threshold);
    const featureScores = perFeatureScores[i];
    return {
      frameId:       frame.frameId,
      timestamp:     frame.timestamp,
      anomalyScore,
      isAnomaly,
      label,
      featureScores,
      humanReadable: buildHumanReadable(featureScores, threshold, isAnomaly),
    };
  });

  const anomalyCount    = results.filter(r => r.isAnomaly).length;
  const suspiciousCount = results.filter(r => r.label === 'Suspicious').length;
  const worstFrame      = results.reduce<AnomalyResult | null>((best, r) =>
    !best || r.anomalyScore > best.anomalyScore ? r : best, null
  );

  return {
    algorithm,
    threshold,
    totalFrames: frames.length,
    anomalyCount,
    suspiciousCount,
    results,
    worstFrame,
    summaryText: buildSummaryText(results, threshold),
  };
}

// ---------------------------------------------------------------------------
// Similarity search
// ---------------------------------------------------------------------------

function cosineSimilarity(a: Record<keyof PoseFeatures, number>, b: Record<keyof PoseFeatures, number>): number {
  const keys = Object.keys(a) as Array<keyof PoseFeatures>;
  let dot = 0, na = 0, nb = 0;
  for (const k of keys) {
    dot += a[k] * b[k];
    na  += a[k] * a[k];
    nb  += b[k] * b[k];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/**
 * Find the most similar frames to a given query frame using cosine similarity
 * on the feature vectors.
 *
 * @param frames - All enriched frames
 * @param queryFrameId - The frame to use as the search query
 * @param topK - How many results to return (default 5)
 */
export function findSimilarFrames(
  frames: EnrichedFrame[],
  queryFrameId: number,
  topK = 5,
): SimilarFrame[] {
  const queryFrame = frames.find(f => f.frameId === queryFrameId);
  if (!queryFrame) throw new Error(`Frame ${queryFrameId} not found.`);

  return frames
    .filter(f => f.frameId !== queryFrameId)
    .map(f => ({
      frameId:    f.frameId,
      timestamp:  f.timestamp,
      similarity: +cosineSimilarity(
        queryFrame.features as unknown as Record<keyof PoseFeatures, number>,
        f.features          as unknown as Record<keyof PoseFeatures, number>,
      ).toFixed(4),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

// ---------------------------------------------------------------------------
// Noise filtering (optional preprocessing)
// ---------------------------------------------------------------------------

/**
 * Applies a simple moving-average smoothing to landmark positions
 * before feature extraction. Helps reduce jitter from MediaPipe.
 *
 * @param frames - Raw pose frames in chronological order
 * @param windowSize - Smoothing window (odd number, default 5)
 */
export function smoothLandmarks(frames: PoseFrame[], windowSize = 5): PoseFrame[] {
  const half = Math.floor(windowSize / 2);
  return frames.map((frame, i) => {
    const start = Math.max(0, i - half);
    const end   = Math.min(frames.length - 1, i + half);
    const count = end - start + 1;

    const smoothed = frame.landmarks.map((_, lmIdx) => {
      let sx = 0, sy = 0, sz = 0, sv = 0;
      for (let j = start; j <= end; j++) {
        const lm = frames[j].landmarks[lmIdx];
        if (!lm) continue;
        sx += lm.x; sy += lm.y; sz += lm.z; sv += (lm.visibility ?? 1);
      }
      return { x: sx / count, y: sy / count, z: sz / count, visibility: sv / count };
    });

    return { ...frame, landmarks: smoothed };
  });
}
