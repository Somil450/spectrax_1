// types/anomaly.ts — SpectraX Anomaly Detection Module (Issue #85)

/** MediaPipe Pose NormalizedLandmark (we only need x, y, z, visibility) */
export interface PoseLandmark {
  x: number;   // 0–1 normalized
  y: number;
  z: number;
  visibility?: number;
}

/**
 * Features extracted from a single pose frame.
 * All angles are in degrees.
 */
export interface PoseFeatures {
  kneeLeft: number;       // left hip → left knee → left ankle
  kneeRight: number;      // right hip → right knee → right ankle
  elbowLeft: number;      // left shoulder → left elbow → left wrist
  elbowRight: number;     // right shoulder → right elbow → right wrist
  hipFlexion: number;     // trunk-to-leg angle, left side
  trunkLean: number;      // lateral lean of spine from vertical
  shoulderSymmetry: number; // absolute height difference between shoulders (normalised)
  wristHeight: number;    // average normalised y-position of wrists
}

/** A raw pose frame from MediaPipe */
export interface PoseFrame {
  frameId: number;
  timestamp: number;        // seconds since workout start
  landmarks: PoseLandmark[];  // 33 MediaPipe landmarks
}

/** One frame enriched with computed features */
export interface EnrichedFrame extends PoseFrame {
  features: PoseFeatures;
}

/** Detection result for a single frame */
export interface AnomalyResult {
  frameId: number;
  timestamp: number;
  anomalyScore: number;       // 0–∞ (higher = more anomalous)
  isAnomaly: boolean;
  label: 'Normal' | 'Suspicious' | 'Anomaly';
  featureScores: Record<keyof PoseFeatures, number>; // per-joint scores
  /** Plain-English description of what looks off */
  humanReadable: string;
}

/** Summary of a full detection run */
export interface DetectionSummary {
  algorithm: AnomalyAlgorithm;
  threshold: number;
  totalFrames: number;
  anomalyCount: number;
  suspiciousCount: number;
  results: AnomalyResult[];
  worstFrame: AnomalyResult | null;
  /** e.g. "3 anomalies detected around the 2–4s window" */
  summaryText: string;
}

/** Supported detection algorithms */
export type AnomalyAlgorithm = 'zscore' | 'mad' | 'isoforest';

/** Similarity search result */
export interface SimilarFrame {
  frameId: number;
  timestamp: number;
  similarity: number;  // cosine similarity 0–1
}
