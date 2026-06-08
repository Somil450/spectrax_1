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