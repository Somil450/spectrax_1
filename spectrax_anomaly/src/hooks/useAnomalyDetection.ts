// hooks/useAnomalyDetection.ts — SpectraX Anomaly Detection Module (Issue #85)

import { useState, useCallback, useRef, useMemo } from 'react';
import {
  extractFeatures,
  detectAnomalies,
  findSimilarFrames,
  smoothLandmarks,
} from '../lib/anomalyDetection';
import type {
  PoseFrame,
  EnrichedFrame,
  DetectionSummary,
  AnomalyAlgorithm,
  SimilarFrame,
} from '../types/anomaly';
import type { NormalizedLandmarkList } from '@mediapipe/pose'; // MediaPipe type

export interface UseAnomalyDetectionOptions {
  /** Detection algorithm (default: 'zscore') */
  algorithm?: AnomalyAlgorithm;
  /** Score threshold — frames above this are flagged (default: 2.0) */
  threshold?: number;
  /** How many frames to keep in the rolling buffer (default: 300 = 10s @30fps) */
  bufferSize?: number;
  /** Apply landmark smoothing before detection (default: true) */
  smoothing?: boolean;
  /** Smoothing window size in frames (default: 5) */
  smoothingWindow?: number;
}

export interface UseAnomalyDetectionReturn {
  /** Call this on every MediaPipe pose result */
  recordFrame: (landmarks: NormalizedLandmarkList, timestamp?: number) => void;
  /** Run detection on the current buffer — call after workout or on demand */
  runDetection: () => DetectionSummary | null;
  /** Latest detection summary (null if not run yet) */
  summary: DetectionSummary | null;
  /** Find frames similar to a given frameId */
  searchSimilar: (frameId: number, topK?: number) => SimilarFrame[];
  /** All buffered enriched frames */
  enrichedFrames: EnrichedFrame[];
  /** Clear the frame buffer (e.g. on new workout start) */
  reset: () => void;
  /** How many frames are currently buffered */
  frameCount: number;
  /** Whether detection is in progress */
  isRunning: boolean;
}

/**
 * useAnomalyDetection — plug into your MediaPipe pose loop and get
 * automatic form-anomaly detection + similarity search.
 *
 * @example
 * const { recordFrame, runDetection, summary } = useAnomalyDetection({
 *   algorithm: 'zscore',
 *   threshold: 2.0,
 * });
 *
 * // Inside your pose result callback:
 * onPoseResults((results) => {
 *   if (results.poseLandmarks) {
 *     recordFrame(results.poseLandmarks);
 *   }
 * });
 *
 * // After workout ends:
 * const analysis = runDetection();
 * console.log(analysis?.summaryText);
 */
export function useAnomalyDetection(
  options: UseAnomalyDetectionOptions = {},
): UseAnomalyDetectionReturn {
  const {
    algorithm       = 'zscore',
    threshold       = 2.0,
    bufferSize      = 300,
    smoothing       = true,
    smoothingWindow = 5,
  } = options;

  const frameBuffer = useRef<PoseFrame[]>([]);
  const frameCounter = useRef(0);
  const startTime = useRef<number | null>(null);

  const [summary, setSummary]           = useState<DetectionSummary | null>(null);
  const [enrichedFrames, setEnriched]   = useState<EnrichedFrame[]>([]);
  const [isRunning, setIsRunning]       = useState(false);
  const [frameCount, setFrameCount]     = useState(0);

  /**
   * Record a single pose frame from MediaPipe.
   * Call this inside your pose callback — it's fast (feature extraction only,
   * no heavy ML until you call runDetection()).
   */
  const recordFrame = useCallback(
    (landmarks: NormalizedLandmarkList, timestamp?: number) => {
      if (startTime.current === null) startTime.current = Date.now();
      const ts = timestamp ?? (Date.now() - startTime.current) / 1000;

      const frame: PoseFrame = {
        frameId:   frameCounter.current++,
        timestamp: +ts.toFixed(3),
        landmarks: landmarks.map(lm => ({
          x: lm.x, y: lm.y, z: lm.z, visibility: lm.visibility ?? 1,
        })),
      };

      frameBuffer.current.push(frame);
      // Keep buffer bounded
      if (frameBuffer.current.length > bufferSize) {
        frameBuffer.current = frameBuffer.current.slice(-bufferSize);
      }

      setFrameCount(frameBuffer.current.length);
    },
    [bufferSize],
  );

  /**
   * Run anomaly detection on the buffered frames.
   * This is the heavier operation — call it after the workout or on demand.
   */
  const runDetection = useCallback((): DetectionSummary | null => {
    const raw = frameBuffer.current;
    if (raw.length < 5) {
      console.warn('[SpectraX] Not enough frames to run anomaly detection (need ≥ 5).');
      return null;
    }

    setIsRunning(true);

    try {
      // Optional smoothing pass
      const prepared = smoothing ? smoothLandmarks(raw, smoothingWindow) : raw;

      // Feature extraction
      const enriched: EnrichedFrame[] = prepared.map(f => ({
        ...f,
        features: extractFeatures(f.landmarks),
      }));

      // Detection
      const result = detectAnomalies(enriched, { algorithm, threshold });

      setEnriched(enriched);
      setSummary(result);
      return result;
    } finally {
      setIsRunning(false);
    }
  }, [algorithm, threshold, smoothing, smoothingWindow]);

  /**
   * Cosine-similarity search against the current enriched buffer.
   * Only valid after runDetection() has been called.
   */
  const searchSimilar = useCallback(
    (frameId: number, topK = 5): SimilarFrame[] => {
      if (enrichedFrames.length === 0) return [];
      try {
        return findSimilarFrames(enrichedFrames, frameId, topK);
      } catch {
        return [];
      }
    },
    [enrichedFrames],
  );

  /** Reset buffer — call at the start of a new workout session */
  const reset = useCallback(() => {
    frameBuffer.current = [];
    frameCounter.current = 0;
    startTime.current = null;
    setSummary(null);
    setEnriched([]);
    setFrameCount(0);
  }, []);

  return {
    recordFrame,
    runDetection,
    summary,
    searchSimilar,
    enrichedFrames,
    reset,
    frameCount,
    isRunning,
  };
}
