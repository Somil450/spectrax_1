import type { Pose as PoseType, Results, NormalizedLandmarkList } from '@mediapipe/pose';
import { gpuAngleCalculator } from './gpuAngleUtils';
import { FrameInterpolationEngine, frameInterpolationEngine } from './frameInterpolationEngine';

// MediaPipe Pose Landmarker wrapper support
export const mediaPipePoseLandmarkerConfig = {
  runningMode: 'VIDEO' as const,
  numPoses: 1,
};

// MediaPipe ships as a UMD bundle loaded via CDN in index.html — not ESM-importable.
const Pose = (window as any).Pose as typeof PoseType;

// ─── Pose Buffer Configuration ────────────────────────────────────────────────

export interface PoseBufferConfig {
  landmarkCount: number;   // default: 33
  components: number;      // default: 4 (x, y, z, visibility)
  historySize: number;     // default: 30
}

/** BlazePose landmark indices for readable call sites */
export const enum BlazePoseLandmark {
  NOSE = 0,
  LEFT_EYE_INNER = 1,
  LEFT_EYE = 2,
  LEFT_EYE_OUTER = 3,
  RIGHT_EYE_INNER = 4,
  RIGHT_EYE = 5,
  RIGHT_EYE_OUTER = 6,
  LEFT_EAR = 7,
  RIGHT_EAR = 8,
  MOUTH_LEFT = 9,
  MOUTH_RIGHT = 10,
  LEFT_SHOULDER = 11,
  RIGHT_SHOULDER = 12,
  LEFT_ELBOW = 13,
  RIGHT_ELBOW = 14,
  LEFT_WRIST = 15,
  RIGHT_WRIST = 16,
  LEFT_PINKY = 17,
  RIGHT_PINKY = 18,
  LEFT_INDEX = 19,
  RIGHT_INDEX = 20,
  LEFT_THUMB = 21,
  RIGHT_THUMB = 22,
  LEFT_HIP = 23,
  RIGHT_HIP = 24,
  LEFT_KNEE = 25,
  RIGHT_KNEE = 26,
  LEFT_ANKLE = 27,
  RIGHT_ANKLE = 28,
  LEFT_HEEL = 29,
  RIGHT_HEEL = 30,
  LEFT_FOOT_INDEX = 31,
  RIGHT_FOOT_INDEX = 32,
}

export type LandmarkIndex = number; // 0–32

// ─── Preallocated Pose Buffer (Zero-Alloc Per Frame) ──────────────────────────

const STRIDE = 4; // floats per landmark: x, y, z, visibility
const LM_COUNT = 33;
const BUF_BYTES = LM_COUNT * STRIDE * Float32Array.BYTES_PER_ELEMENT;
const SHARED_HEADER_BYTES = Int32Array.BYTES_PER_ELEMENT;
const SHARED_BUF_BYTES = SHARED_HEADER_BYTES + BUF_BYTES;

/** Module-level preallocated pose buffer — written in-place every frame */
const poseBuffer = new Float32Array(LM_COUNT * STRIDE);

// ─── Ring Buffer for Pose History ─────────────────────────────────────────────

const HISTORY_SIZE = 30;
const poseHistory = new Float32Array(HISTORY_SIZE * LM_COUNT * STRIDE);
let historyHead = 0;

/** Write current poseBuffer into the ring buffer history */
function writePoseToHistory(): void {
  const offset = historyHead * LM_COUNT * STRIDE;
  poseHistory.set(poseBuffer, offset);
  historyHead = (historyHead + 1) % HISTORY_SIZE;
}

/**
 * Read a historical frame from the ring buffer.
 * @param framesAgo - 0 = most recent written, 1 = one frame before, etc.
 * @returns A subarray view into the ring buffer (do NOT cache across frames)
 */
export function getHistoryFrame(framesAgo: number): Float32Array {
  const idx = ((historyHead - 1 - framesAgo) % HISTORY_SIZE + HISTORY_SIZE) % HISTORY_SIZE;
  const offset = idx * LM_COUNT * STRIDE;
  return poseHistory.subarray(offset, offset + LM_COUNT * STRIDE);
}

// ─── Scratch Vectors for Hot-Path Calculations ────────────────────────────────

interface Vec3 { x: number; y: number; z: number }

const _vecA: Vec3 = { x: 0, y: 0, z: 0 };
const _vecB: Vec3 = { x: 0, y: 0, z: 0 };
const _vecC: Vec3 = { x: 0, y: 0, z: 0 };

/** Subtract b from a, writing result into out. Zero allocations. */
export function subtractInto(out: Vec3, a: Vec3, b: Vec3): void {
  out.x = a.x - b.x;
  out.y = a.y - b.y;
  out.z = a.z - b.z;
}

/** Dot product of two Vec3 */
function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** Magnitude of a Vec3 */
function magnitude(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/**
 * Calculate angle between three landmarks using scratch vectors.
 * Zero heap allocations.
 */
export function calculateAngleFromBuffer(
  aIdx: LandmarkIndex,
  bIdx: LandmarkIndex,
  cIdx: LandmarkIndex,
): number {
  const aOff = aIdx * STRIDE;
  const bOff = bIdx * STRIDE;
  const cOff = cIdx * STRIDE;

  _vecA.x = poseBuffer[aOff] - poseBuffer[bOff];
  _vecA.y = poseBuffer[aOff + 1] - poseBuffer[bOff + 1];
  _vecA.z = poseBuffer[aOff + 2] - poseBuffer[bOff + 2];

  _vecB.x = poseBuffer[cOff] - poseBuffer[bOff];
  _vecB.y = poseBuffer[cOff + 1] - poseBuffer[bOff + 1];
  _vecB.z = poseBuffer[cOff + 2] - poseBuffer[bOff + 2];

  const magA = magnitude(_vecA);
  const magB = magnitude(_vecB);
  if (magA < 1e-8 || magB < 1e-8) return 0;

  const cosAngle = dot(_vecA, _vecB) / (magA * magB);
  return Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);
}

// ─── Snapshot Read API (Zero-Copy) ───────────────────────────────────────────

/** Returns a read view into the live pose buffer — do not store the reference. */
export function getPoseBufferView(): Readonly<Float32Array> {
  return poseBuffer;
}

/** Safe copy for consumers that need to persist data across frames. */
export function copyPoseSnapshot(): Float32Array {
  return poseBuffer.slice();
}

/** Read a single landmark's coordinates from the buffer without allocation */
export function readLandmark(index: LandmarkIndex): Readonly<Vec3> {
  const off = index * STRIDE;
  _vecC.x = poseBuffer[off];
  _vecC.y = poseBuffer[off + 1];
  _vecC.z = poseBuffer[off + 2];
  return _vecC;
}

// ─── Internal Types ───────────────────────────────────────────────────────────

type MediaPipePoseConstructor = new (options: {
  locateFile: (file: string) => string;
}) => PoseType;

type LandmarkCoordinate = "x" | "y" | "z" | "visibility";

type LandmarkStream = "poseLandmarks" | "poseWorldLandmarks";

type LandmarkSnapshot = Array<{
  x: number;
  y: number;
  z: number;
  visibility: number;
}>;

interface SharedLandmarkFrame {
  buffer: SharedArrayBuffer;
  sequence: Int32Array;
  view: Float32Array;
}

export type PoseSmoothingFilterType = "kalman" | "ema";

export interface KalmanFilterOptions {
  type: "kalman";
  enabled?: boolean;
  processNoise?: number;
  measurementNoise?: number;
}

export interface EmaFilterOptions {
  type: "ema";
  enabled?: boolean;
  alpha?: number;
}

export type PoseSmoothingFilterConfig =
  | KalmanFilterOptions
  | EmaFilterOptions;

interface LandmarkFilter {
  readonly type: PoseSmoothingFilterType;
  enabled: boolean;

  apply(
    landmarks: NormalizedLandmarkList,
    stream: LandmarkStream,
  ): NormalizedLandmarkList;

  reset(): void;

  toConfig(): PoseSmoothingFilterConfig;
}

const LANDMARK_COORDINATES: LandmarkCoordinate[] = [
  "x",
  "y",
  "z",
  "visibility",
];

const DEFAULT_FILTERS: PoseSmoothingFilterConfig[] = [
  {
    type: "kalman",
    enabled: true,
    processNoise: 0.0015,
    measurementNoise: 0.02,
  },
  {
    type: "ema",
    enabled: false,
    alpha: 0.45,
  },
];

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

// ─── Dynamic Joint Confidence Hashing ──────────────────────────────────────────

/**
 * Rolling entry for a single landmark coordinate's confidence history.
 */
interface ConfidenceEntry {
  /** Rolling window of recent confidence values */
  history: number[];
  /** Dynamic safety threshold — adapts to recent confidence levels */
  dynamicThreshold: number;
  /** Last known good value (when confidence was above threshold) */
  lastGoodValue: number;
  /** Consecutive frames below threshold */
  lowConfidenceFrames: number;
  /** Whether this entry has seen a valid value at least once */
  initialized: boolean;
}

/**
 * Hash-table system that maps each (landmark, coordinate) pair to a rolling
 * confidence tracker. On every frame, each coordinate is checked against its
 * own dynamically adjusted threshold. Unstable coordinates (confidence below
 * the adaptive threshold) are replaced with an interpolated estimate derived
 * from the last known good value, bypassing jittery or lost landmarks.
 *
 * The threshold adapts per-entry using an exponential moving average of recent
 * confidence values scaled by a safety factor, with a static floor so that
 * extremely low confidence never becomes "normal".
 */
class JointConfidenceHash {
  private readonly entries = new Map<string, ConfidenceEntry>();
  private readonly confidenceWindow: number;
  private readonly thresholdFloor: number;
  private readonly safetyFactor: number;
  private readonly blendFactor: number;

  constructor(
    confidenceWindow = 10,
    thresholdFloor = 0.45,
    safetyFactor = 0.8,
    blendFactor = 0.3,
  ) {
    this.confidenceWindow = confidenceWindow;
    this.thresholdFloor = thresholdFloor;
    this.safetyFactor = safetyFactor;
    this.blendFactor = blendFactor;
  }

  /**
   * Hash a (landmark, coordinate) pair to a stable string key.
   */
  private hash(landmarkIndex: number, coordinate: LandmarkCoordinate): string {
    return `${landmarkIndex}:${coordinate}`;
  }

  /**
   * Get or create a confidence entry for the given key.
   */
  private getOrCreateEntry(key: string): ConfidenceEntry {
    let entry = this.entries.get(key);
    if (!entry) {
      entry = {
        history: [],
        dynamicThreshold: this.thresholdFloor,
        lastGoodValue: 0,
        lowConfidenceFrames: 0,
        initialized: false,
      };
      this.entries.set(key, entry);
    }
    return entry;
  }

  /**
   * Update the rolling confidence history and recompute the dynamic threshold.
   */
  private updateThreshold(entry: ConfidenceEntry, currentConfidence: number): void {
    entry.history.push(currentConfidence);
    if (entry.history.length > this.confidenceWindow) {
      entry.history.shift();
    }

    const avgConfidence =
      entry.history.reduce((sum, v) => sum + v, 0) / entry.history.length;
    entry.dynamicThreshold = Math.max(
      avgConfidence * this.safetyFactor,
      this.thresholdFloor,
    );
  }

  /**
   * Process all 33 landmarks, checking each (x, y, z) coordinate against its
   * dynamic confidence threshold. Low-confidence coordinates are replaced with
   * an interpolated estimate (blend of last-good and current).
   */
  process(landmarks: Array<{ x: number; y: number; z?: number; visibility?: number }>): void {
    const limit = Math.min(landmarks.length, 33);
    const coords: LandmarkCoordinate[] = ["x", "y", "z"];

    for (let i = 0; i < limit; i++) {
      const lm = landmarks[i];
      const visibility = lm.visibility ?? 1;

      for (const coord of coords) {
        const key = this.hash(i, coord);
        const entry = this.getOrCreateEntry(key);
        const currentValue = lm[coord] ?? 0;

        this.updateThreshold(entry, visibility);

        if (visibility < entry.dynamicThreshold) {
          entry.lowConfidenceFrames++;

          if (entry.initialized) {
            // Blend toward the last known good value to avoid hard snaps
            lm[coord] =
              entry.lastGoodValue * this.blendFactor +
              currentValue * (1 - this.blendFactor);
          }
          // If not initialized, leave the current value as-is
        } else {
          entry.lastGoodValue = currentValue;
          entry.lowConfidenceFrames = 0;
          entry.initialized = true;
        }
      }
    }
  }

  reset(): void {
    this.entries.clear();
  }
}

/** Singleton hash instance used by the pose service */
const jointConfidenceHash = new JointConfidenceHash();

// ─── Optimized EMA Filter (In-Place Mutation) ─────────────────────────────────


/**
 * EMA filter using Float32Array storage for zero-alloc per-frame smoothing.
 * State is stored in a flat typed array indexed by (stream, landmark, coordinate).
 */
class EmaLandmarkFilter implements LandmarkFilter {
  readonly type = "ema" as const;
  enabled: boolean;

  private readonly alpha: number;
  // Flat storage: 2 streams × 33 landmarks × 4 coords = 264 entries
  private readonly state = new Float32Array(2 * LM_COUNT * 4);
  private readonly initialized = new Uint8Array(2 * LM_COUNT * 4);

  constructor(config: EmaFilterOptions) {
    this.enabled = config.enabled ?? true;
    this.alpha = clamp(config.alpha ?? 0.45, 0.01, 1);
  }

  private getStreamOffset(stream: LandmarkStream): number {
    return stream === "poseLandmarks" ? 0 : LM_COUNT * 4;
  }

  apply(
    landmarks: NormalizedLandmarkList,
    stream: LandmarkStream,
  ): NormalizedLandmarkList {
    const streamOffset = this.getStreamOffset(stream);

    if (!this.enabled) {
      // Prime state without smoothing
      for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i];
        const base = streamOffset + i * 4;
        this.state[base] = lm.x;
        this.state[base + 1] = lm.y;
        this.state[base + 2] = lm.z ?? 0;
        this.state[base + 3] = lm.visibility ?? 1;
        this.initialized[base] = 1;
        this.initialized[base + 1] = 1;
        this.initialized[base + 2] = 1;
        this.initialized[base + 3] = 1;
      }
      return landmarks;
    }

    // Apply EMA in-place — mutate landmarks directly (MediaPipe results are not reused)
    const alpha = this.alpha;
    const oneMinusAlpha = 1 - alpha;

    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      const base = streamOffset + i * 4;

      const vals = [lm.x, lm.y, lm.z ?? 0, lm.visibility ?? 1];

      for (let c = 0; c < 4; c++) {
        const idx = base + c;
        if (this.initialized[idx]) {
          const smoothed = alpha * vals[c] + oneMinusAlpha * this.state[idx];
          this.state[idx] = smoothed;
          vals[c] = smoothed;
        } else {
          this.state[idx] = vals[c];
          this.initialized[idx] = 1;
        }
      }

      lm.x = vals[0];
      lm.y = vals[1];
      (lm as { z: number }).z = vals[2];
      (lm as { visibility: number }).visibility = vals[3];
    }

    return landmarks;
  }

  reset() {
    this.state.fill(0);
    this.initialized.fill(0);
  }

  toConfig(): EmaFilterOptions {
    return {
      type: "ema",
      enabled: this.enabled,
      alpha: this.alpha,
    };
  }
}

// ─── Optimized Kalman Filter (In-Place Mutation) ──────────────────────────────

/**
 * Kalman filter using Float32Array storage for zero-alloc per-frame smoothing.
 * Stores estimate + covariance in flat typed arrays.
 */
class KalmanLandmarkFilter implements LandmarkFilter {
  readonly type = "kalman" as const;
  enabled: boolean;

  private readonly processNoise: number;
  private readonly measurementNoise: number;

  // Flat storage: 2 streams × 33 landmarks × 4 coords
  private readonly estimates = new Float32Array(2 * LM_COUNT * 4);
  private readonly covariances = new Float32Array(2 * LM_COUNT * 4);
  private readonly initialized = new Uint8Array(2 * LM_COUNT * 4);

  constructor(config: KalmanFilterOptions) {
    this.enabled = config.enabled ?? true;
    this.processNoise = Math.max(config.processNoise ?? 0.0015, 0.000001);
    this.measurementNoise = Math.max(config.measurementNoise ?? 0.02, 0.000001);
    this.covariances.fill(1);
  }

  private getStreamOffset(stream: LandmarkStream): number {
    return stream === "poseLandmarks" ? 0 : LM_COUNT * 4;
  }

  apply(
    landmarks: NormalizedLandmarkList,
    stream: LandmarkStream,
  ): NormalizedLandmarkList {
    const streamOffset = this.getStreamOffset(stream);

    if (!this.enabled) {
      // Prime state
      for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i];
        const base = streamOffset + i * 4;
        this.estimates[base] = lm.x;
        this.estimates[base + 1] = lm.y;
        this.estimates[base + 2] = lm.z ?? 0;
        this.estimates[base + 3] = lm.visibility ?? 1;
        this.initialized[base] = 1;
        this.initialized[base + 1] = 1;
        this.initialized[base + 2] = 1;
        this.initialized[base + 3] = 1;
      }
      return landmarks;
    }

    const pNoise = this.processNoise;
    const mNoise = this.measurementNoise;

    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      const base = streamOffset + i * 4;

      const measurements = [lm.x, lm.y, lm.z ?? 0, lm.visibility ?? 1];

      for (let c = 0; c < 4; c++) {
        const idx = base + c;
        const measurement = measurements[c];

        if (!this.initialized[idx]) {
          this.estimates[idx] = measurement;
          this.covariances[idx] = 1;
          this.initialized[idx] = 1;
          measurements[c] = measurement;
          continue;
        }

        const predictedCov = this.covariances[idx] + pNoise;
        const gain = predictedCov / (predictedCov + mNoise);
        const estimate = this.estimates[idx] + gain * (measurement - this.estimates[idx]);
        const covariance = (1 - gain) * predictedCov + pNoise * 0.001;

        this.estimates[idx] = estimate;
        this.covariances[idx] = covariance;
        measurements[c] = estimate;
      }

      lm.x = measurements[0];
      lm.y = measurements[1];
      (lm as { z: number }).z = measurements[2];
      (lm as { visibility: number }).visibility = measurements[3];
    }

    return landmarks;
  }

  reset() {
    this.estimates.fill(0);
    this.covariances.fill(1);
    this.initialized.fill(0);
  }

  toConfig(): KalmanFilterOptions {
    return {
      type: "kalman",
      enabled: this.enabled,
      processNoise: this.processNoise,
      measurementNoise: this.measurementNoise,
    };
  }
}

const createFilter = (
  config: PoseSmoothingFilterConfig,
): LandmarkFilter => {
  if (config.type === "ema") {
    return new EmaLandmarkFilter(config);
  }
  return new KalmanLandmarkFilter(config);
};

const createSharedLandmarkFrame = (): SharedLandmarkFrame | null => {
  if (typeof SharedArrayBuffer === "undefined" || !globalThis.crossOriginIsolated) {
    return null;
  }

  try {
    const buffer = new SharedArrayBuffer(SHARED_BUF_BYTES);
    return {
      buffer,
      sequence: new Int32Array(buffer, 0, 1),
      view: new Float32Array(buffer, SHARED_HEADER_BYTES, LM_COUNT * STRIDE),
    };
  } catch {
    return null;
  }
};

// ─── PoseService Class ────────────────────────────────────────────────────────

export class PoseService {
  private pose: PoseType | null = null;
  private isLoaded: boolean = false;
  private inProgress: boolean = false;
  private errorCount: number = 0;
  private sharedLandmarkFrame: SharedLandmarkFrame | null = createSharedLandmarkFrame();
  private pool: ArrayBuffer[] = [
    new ArrayBuffer(BUF_BYTES),
    new ArrayBuffer(BUF_BYTES),
  ];
  private smoothingFilters: LandmarkFilter[] = DEFAULT_FILTERS.map(createFilter);
  private interpolationEngine: FrameInterpolationEngine = frameInterpolationEngine;
  private interpolationEnabled: boolean = true;
  private userCallback: ((results: Results) => void) | null = null;

  constructor() {
    this.init();
  }

  private init() {
    if (this.pose) return;

    try {
      this.pose = new Pose({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`,
      });

      this.pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: false,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      this.isLoaded = true;


      if (this.sharedLandmarkFrame) {
      }
    } catch (e) {
      console.error("PoseService init failed:", e);
    }
  }

  getSharedLandmarkBuffer() {
    return this.sharedLandmarkFrame?.buffer ?? null;
  }

  readSharedLandmarksSnapshot(): LandmarkSnapshot | null {
    const sharedFrame = this.sharedLandmarkFrame;
    if (!sharedFrame) return null;

    for (;;) {
      const startSequence = Atomics.load(sharedFrame.sequence, 0) as number;
      if (startSequence === 0 || (startSequence & 1) === 1) return null;

      const landmarks: LandmarkSnapshot = [];
      for (let i = 0; i < LM_COUNT; i++) {
        const offset = i * STRIDE;
        landmarks.push({
          x: sharedFrame.view[offset],
          y: sharedFrame.view[offset + 1],
          z: sharedFrame.view[offset + 2],
          visibility: sharedFrame.view[offset + 3],
        });
      }

      const endSequence = Atomics.load(sharedFrame.sequence, 0) as number;
      if (startSequence === endSequence && (endSequence & 1) === 0) {
        return landmarks;
      }
    }
  }

  private publishSharedLandmarks(
    landmarks: Array<{ x: number; y: number; z?: number; visibility?: number }>,
  ) {
    const sharedFrame = this.sharedLandmarkFrame;
    if (!sharedFrame) return;

    Atomics.add(sharedFrame.sequence, 0, 1);
    sharedFrame.view.fill(0);

    const limit = Math.min(landmarks.length, LM_COUNT);
    for (let i = 0; i < limit; i++) {
      const landmark = landmarks[i];
      const offset = i * STRIDE;
      sharedFrame.view[offset] = landmark.x;
      sharedFrame.view[offset + 1] = landmark.y;
      sharedFrame.view[offset + 2] = landmark.z ?? 0;
      sharedFrame.view[offset + 3] = landmark.visibility ?? 1;
    }

    Atomics.add(sharedFrame.sequence, 0, 1);
  }

  private clearSharedLandmarks() {
    const sharedFrame = this.sharedLandmarkFrame;
    if (!sharedFrame) return;
    sharedFrame.view.fill(0);
    Atomics.store(sharedFrame.sequence, 0, 0);
  }

  /**
   * Write landmarks into the preallocated poseBuffer and history ring buffer.
   * Zero heap allocations.
   */
  private writeToPoseBuffer(
    landmarks: Array<{ x: number; y: number; z?: number; visibility?: number }>,
  ): void {
    const limit = Math.min(landmarks.length, LM_COUNT);
    for (let i = 0; i < limit; i++) {
      const lm = landmarks[i];
      const off = i * STRIDE;
      poseBuffer[off] = lm.x;
      poseBuffer[off + 1] = lm.y;
      poseBuffer[off + 2] = lm.z ?? 0;
      poseBuffer[off + 3] = lm.visibility ?? 1;
    }
    writePoseToHistory();
  }

  packLandmarks(
    landmarks: Array<{ x: number; y: number; z?: number; visibility?: number }>,
  ): { buf: ArrayBuffer; t0: number } | null {
    if (!this.pool.length) return null;

    const buf = this.pool.pop()!;
    const view = new Float32Array(buf);
    const len = Math.min(landmarks.length, LM_COUNT);

    for (let i = 0; i < len; i++) {
      const lm = landmarks[i];
      const o = i * STRIDE;
      view[o] = lm.x;
      view[o + 1] = lm.y;
      view[o + 2] = lm.z ?? 0;
      view[o + 3] = lm.visibility ?? 1;
    }

    return { buf, t0: performance.now() };
  }

  returnBuffer(buf: ArrayBuffer) {
    if (this.pool.length < 2) {
      this.pool.push(buf);
    }
  }

  static unpackLandmarks(
    buf: ArrayBuffer,
  ): Array<{ x: number; y: number; z: number; visibility: number }> {
    const view = new Float32Array(buf);
    const out = [];
    for (let i = 0; i < LM_COUNT; i++) {
      const o = i * STRIDE;
      out.push({
        x: view[o],
        y: view[o + 1],
        z: view[o + 2],
        visibility: view[o + 3],
      });
    }
    return out;
  }

  setSmoothingFilters(filters: PoseSmoothingFilterConfig[]) {
    this.smoothingFilters = filters.map(createFilter);
  }

  setSmoothingFilterEnabled(type: PoseSmoothingFilterType, enabled: boolean) {
    const existingFilter = this.smoothingFilters.find((filter) => filter.type === type);

    if (!existingFilter) {
      const defaultFilter = DEFAULT_FILTERS.find((filter) => filter.type === type) ?? { type };
      this.smoothingFilters.push(
        createFilter({ ...defaultFilter, enabled } as PoseSmoothingFilterConfig),
      );
      return;
    }

    existingFilter.enabled = enabled;
  }

  getSmoothingFilters() {
    return this.smoothingFilters.map((filter) => filter.toConfig());
  }

  resetSmoothingFilters() {
    for (let i = 0; i < this.smoothingFilters.length; i++) {
      this.smoothingFilters[i].reset();
    }
  }

  setInterpolationEnabled(enabled: boolean) {
    this.interpolationEnabled = enabled;
    if (!enabled) {
      this.interpolationEngine.reset();
    }
  }

  getInterpolationEnabled(): boolean {
    return this.interpolationEnabled;
  }

  onResults(callback: (results: Results) => void) {
    if (!this.pose) return;
    this.userCallback = callback;

    this.pose.onResults((results: Results) => {
      this.inProgress = false;
      this.errorCount = 0;

      if (!results) return;

      const processed = this.preprocessResults(results);

      if (!this.interpolationEnabled || !processed.poseLandmarks) {
        callback(processed);
        return;
      }

      const frames = this.interpolationEngine.feedConfirmedFrame(
        processed.poseLandmarks,
        performance.now(),
      );

      // Emit all frames: confirmed + any ghosts
      for (const frame of frames) {
        const frameResults: Results = {
          ...processed,
          poseLandmarks: frame.landmarks as any,
          // Tag ghost frames so downstream can react
          // @ts-ignore — extending Results type for internal use
          __isGhostFrame: frame.isGhost,
        };
        callback(frameResults);
      }
    });
  }

  async send(
    image: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  ) {
    if (!this.pose || !this.isLoaded || this.inProgress) return;

    this.inProgress = true;

    try {
      await this.pose.send({ image });
    } catch (e) {
      this.inProgress = false;
      this.errorCount++;

      if (this.errorCount > 10) {
        console.warn("PoseService: too many errors, resetting...");
        this.close();
        this.init();
        this.errorCount = 0;
      }
    }
  }

  async close() {
    if (this.pose) {
      try {
        await this.pose.close();
      } catch {}
      this.pose = null;
      this.isLoaded = false;
    }
    this.interpolationEngine.reset();
    gpuAngleCalculator.destroy();
  }

  private depthLandmarks: Array<{ x: number; y: number; z: number; visibility: number; depthConfidence: number }> | null = null;

  setDepthLandmarks(landmarks: Array<{ x: number; y: number; z: number; visibility: number; depthConfidence: number }> | null) {
    this.depthLandmarks = landmarks;
  }

  getDepthLandmarks() {
    return this.depthLandmarks;
  }

  private preprocessResults(results: Results): Results {
    if (this.depthLandmarks && results.poseLandmarks) {
      (results as any).__depthLandmarks = this.depthLandmarks;
    }

    if (this.smoothingFilters.length === 0) {
      if (results.poseLandmarks) {
        jointConfidenceHash.process(results.poseLandmarks);
        this.writeToPoseBuffer(results.poseLandmarks);
        this.publishSharedLandmarks(results.poseLandmarks);
      }
      return results;
    }

    if (!results.poseLandmarks && !results.poseWorldLandmarks) {
      this.resetSmoothingFilters();
      jointConfidenceHash.reset();
      this.clearSharedLandmarks();
      return results;
    }

    // Apply filters in-place (no spread, no new object creation)
    if (results.poseLandmarks) {
      this.applyFilters(results.poseLandmarks, "poseLandmarks");
      jointConfidenceHash.process(results.poseLandmarks);
      this.writeToPoseBuffer(results.poseLandmarks);
      this.publishSharedLandmarks(results.poseLandmarks);
    } else {
      this.clearSharedLandmarks();
    }

    if (results.poseWorldLandmarks) {
      this.applyFilters(results.poseWorldLandmarks, "poseWorldLandmarks");
      jointConfidenceHash.process(results.poseWorldLandmarks);
    }

    return results;
  }

  private applyFilters(
    landmarks: NormalizedLandmarkList,
    stream: LandmarkStream,
  ): void {
    // Single-pass imperative loop — no .reduce() chain
    for (let i = 0; i < this.smoothingFilters.length; i++) {
      this.smoothingFilters[i].apply(landmarks, stream);
    }
  }
}

const globalPoseService = new PoseService();

export { globalPoseService as poseService };

// TODO: Consider adding more comprehensive JSDoc comments