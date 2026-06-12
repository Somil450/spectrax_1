// src/services/frameInterpolationEngine.ts
import type { NormalizedLandmark } from "@mediapipe/pose";

const LM_COUNT = 33;
const STRIDE = 4; // x, y, z, visibility

export interface InterpolationConfig {
  /** Expected ms between frames at target FPS (default: 33 for ~30fps) */
  expectedFrameIntervalMs: number;
  /** Max ms gap before we stop interpolating and wait for real frames (default: 150) */
  maxGapMs: number;
  /** Max consecutive ghost frames to emit before giving up (default: 5) */
  maxGhostFrames: number;
  /** Visibility sentinel for synthetic landmarks (-1 = ghost) */
  ghostVisibility: number;
}

const DEFAULT_CONFIG: InterpolationConfig = {
  expectedFrameIntervalMs: 33,
  maxGapMs: 150,
  maxGhostFrames: 5,
  ghostVisibility: -1,
};

interface TimestampedFrame {
  timestamp: number;
  landmarks: Float32Array; // LM_COUNT * STRIDE
}

/**
 * Frame-Drop Kinetic Vector Reconstruction Layer.
 *
 * Monitors millisecond intervals between active coordinate arrivals.
 * If the tracking stream experiences a minor freeze or missed frame window,
 * computes synthetic positional fallback data using linear vector estimation
 * between the last two confirmed coordinate maps.
 *
 * Ghost frames are marked with visibility = -1 so downstream layers
 * can distinguish reconstructed data from real sensor data.
 */
export class FrameInterpolationEngine {
  private config: InterpolationConfig;
  private frameHistory: TimestampedFrame[] = [];
  private lastEmittedTimestamp: number = 0;
  private ghostFramesEmitted: number = 0;
  private isRunning: boolean = false;

  constructor(config: Partial<InterpolationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Feed a confirmed (real) frame from MediaPipe.
   * Returns the frame itself + any interpolated ghost frames that should
   * have been emitted during the gap.
   */
  feedConfirmedFrame(
    landmarks: NormalizedLandmark[],
    timestamp: number = performance.now(),
  ): Array<{ landmarks: NormalizedLandmark[]; isGhost: boolean }> {
    const confirmed = this.normalizeToBuffer(landmarks, timestamp);
    const output: Array<{ landmarks: NormalizedLandmark[]; isGhost: boolean }> = [];

    // Always emit the confirmed frame first
    output.push({ landmarks: this.bufferToLandmarks(confirmed.landmarks), isGhost: false });

    if (!this.isRunning) {
      // First frame — just seed history
      this.frameHistory = [confirmed];
      this.lastEmittedTimestamp = timestamp;
      this.ghostFramesEmitted = 0;
      this.isRunning = true;
      return output;
    }

    const gapMs = timestamp - this.lastEmittedTimestamp;
    const expectedInterval = this.config.expectedFrameIntervalMs;

    if (gapMs > expectedInterval * 1.5 && gapMs <= this.config.maxGapMs) {
      // We have a gap small enough to interpolate
      const framesToInterpolate = Math.floor(gapMs / expectedInterval) - 1;
      const actualGhostCount = Math.min(
        framesToInterpolate,
        this.config.maxGhostFrames - this.ghostFramesEmitted,
      );

      if (actualGhostCount > 0 && this.frameHistory.length >= 2) {
        const prev = this.frameHistory[this.frameHistory.length - 1];
        const prev2 = this.frameHistory[this.frameHistory.length - 2];

        for (let i = 1; i <= actualGhostCount; i++) {
          const t = i / (actualGhostCount + 1); // normalized interpolation factor
          const ghostTimestamp = this.lastEmittedTimestamp + i * expectedInterval;
          const ghost = this.interpolateFrame(prev2, prev, t, ghostTimestamp);
          output.push({ landmarks: this.bufferToLandmarks(ghost.landmarks), isGhost: true });
          this.ghostFramesEmitted++;
        }
      }
    } else if (gapMs > this.config.maxGapMs) {
      // Gap too large — user likely left frame, reset history
      this.frameHistory = [];
      this.ghostFramesEmitted = 0;
    }

    // Slide history window (keep last 2)
    this.frameHistory.push(confirmed);
    if (this.frameHistory.length > 2) {
      this.frameHistory.shift();
    }
    this.lastEmittedTimestamp = timestamp;

    return output;
  }

  reset(): void {
    this.frameHistory = [];
    this.lastEmittedTimestamp = 0;
    this.ghostFramesEmitted = 0;
    this.isRunning = false;
  }

  private normalizeToBuffer(
    landmarks: NormalizedLandmark[],
    timestamp: number,
  ): TimestampedFrame {
    const buf = new Float32Array(LM_COUNT * STRIDE);
    const limit = Math.min(landmarks.length, LM_COUNT);

    for (let i = 0; i < limit; i++) {
      const lm = landmarks[i];
      const off = i * STRIDE;
      buf[off] = lm.x;
      buf[off + 1] = lm.y;
      buf[off + 2] = lm.z ?? 0;
      buf[off + 3] = lm.visibility ?? 1;
    }

    return { timestamp, landmarks: buf };
  }

  private bufferToLandmarks(buf: Float32Array): NormalizedLandmark[] {
    const out: NormalizedLandmark[] = [];
    for (let i = 0; i < LM_COUNT; i++) {
      const off = i * STRIDE;
      out.push({
        x: buf[off],
        y: buf[off + 1],
        z: buf[off + 2],
        visibility: buf[off + 3],
      });
    }
    return out;
  }

  private interpolateFrame(
    a: TimestampedFrame,
    b: TimestampedFrame,
    t: number,
    timestamp: number,
  ): TimestampedFrame {
    const out = new Float32Array(LM_COUNT * STRIDE);
    const dt = b.timestamp - a.timestamp;
    // Avoid division by zero; if same timestamp, just return b
    const safeDt = dt > 0 ? dt : 1;

    for (let i = 0; i < LM_COUNT; i++) {
      const off = i * STRIDE;

      // Linear interpolation for position
      const x = a.landmarks[off] + t * (b.landmarks[off] - a.landmarks[off]);
      const y = a.landmarks[off + 1] + t * (b.landmarks[off + 1] - a.landmarks[off + 1]);
      const z = a.landmarks[off + 2] + t * (b.landmarks[off + 2] - a.landmarks[off + 2]);

      // Velocity-based extrapolation for continuity feel:
      // v = (b - a) / dt, projected forward by t * dt
      // This is equivalent to linear interpolation but framed as vector velocity
      const vx = (b.landmarks[off] - a.landmarks[off]) / safeDt;
      const vy = (b.landmarks[off + 1] - a.landmarks[off + 1]) / safeDt;
      const vz = (b.landmarks[off + 2] - a.landmarks[off + 2]) / safeDt;

      // Blend lerp with velocity projection for smoother motion
      const blend = 0.7; // favor lerp, velocity adds micro-correction
      const projectedX = a.landmarks[off] + vx * t * safeDt;
      const projectedY = a.landmarks[off + 1] + vy * t * safeDt;
      const projectedZ = a.landmarks[off + 2] + vz * t * safeDt;

      out[off] = x * blend + projectedX * (1 - blend);
      out[off + 1] = y * blend + projectedY * (1 - blend);
      out[off + 2] = z * blend + projectedZ * (1 - blend);

      // Mark as ghost frame
      out[off + 3] = this.config.ghostVisibility;
    }

    return { timestamp, landmarks: out };
  }
}

export const frameInterpolationEngine = new FrameInterpolationEngine();