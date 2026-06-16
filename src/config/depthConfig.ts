import type { DepthEstimationConfig } from "../types/pose";

/**
 * Default depth estimation configuration.
 * Uses Depth-Anything V2 Small (~80MB) via Xenova transformers hub.
 * MiDaS v3.1 Small is available as fallback by swapping modelName.
 */
export const DEFAULT_DEPTH_CONFIG: DepthEstimationConfig = {
  modelName: "Xenova/depth-anything-small-hf",
  frameSkip: 3,
  targetWidth: 518,
  targetHeight: 518,
  bilateralFilterSigma: 2.0,
  maxDepthMeters: 10.0,
  minDepthMeters: 0.1,
};

/** MiDaS v3.1 Small fallback config (~30MB, faster, slightly less accurate) */
export const MIDAS_DEPTH_CONFIG: DepthEstimationConfig = {
  modelName: "Xenova/MiDaS-small",
  frameSkip: 3,
  targetWidth: 256,
  targetHeight: 256,
  bilateralFilterSigma: 1.5,
  maxDepthMeters: 10.0,
  minDepthMeters: 0.1,
};