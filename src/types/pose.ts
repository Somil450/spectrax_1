// src/types/pose.ts
import type { Results } from '@mediapipe/pose';

/**
 * Extended Results type that includes ghost frame metadata
 * injected by the Frame Interpolation Engine.
 */
export interface InterpolatedResults extends Results {
  /** True if this frame was synthetically generated during a frame drop */
  __isGhostFrame?: boolean;
}

/** Configuration for the kinetic vector reconstruction layer */
export interface FrameInterpolationConfig {
  expectedFrameIntervalMs?: number;
  maxGapMs?: number;
  maxGhostFrames?: number;
  ghostVisibility?: number;
}

/** Per-vertex depth-augmented landmark (z is now true camera-space depth in meters) */
export interface DepthLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
  depthConfidence: number;
}

/** 3D mesh vertex in camera space (unprojected from 2D + depth) */
export interface Mesh3DVertex {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

/** Depth estimation runtime configuration */
export interface DepthEstimationConfig {
  modelName: string;
  frameSkip: number;
  targetWidth: number;
  targetHeight: number;
  bilateralFilterSigma: number;
  maxDepthMeters: number;
  minDepthMeters: number;
}

/** Results from a single depth inference pass */
export interface DepthMapResult {
  width: number;
  height: number;
  data: Float32Array;
  timestamp: number;
}

/** Pose results augmented with per-landmark depth */
export interface DepthAugmentedResults {
  landmarks: DepthLandmark[];
  meshVertices: Mesh3DVertex[];
  depthMap: DepthMapResult | null;
  is3D: boolean;
}