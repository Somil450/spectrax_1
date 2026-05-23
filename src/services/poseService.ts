// Import MediaPipe types only; the runtime Pose constructor is provided via CDN on window.
import type { Results } from '@mediapipe/pose';
import type { Pose as PoseType } from '@mediapipe/pose';

// MediaPipe ships as a UMD bundle loaded via CDN in index.html — not ESM-importable.
const Pose = (window as any).Pose as typeof PoseType;

const STRIDE    = 4;       // floats per landmark: x, y, z, visibility
const LM_COUNT  = 33;
const BUF_BYTES = LM_COUNT * STRIDE * Float32Array.BYTES_PER_ELEMENT;

type MediaPipePoseConstructor = new (options: {
  locateFile: (file: string) => string;
}) => PoseType;

type LandmarkCoordinate = 'x' | 'y' | 'z';
type LandmarkStream = 'poseLandmarks' | 'poseWorldLandmarks';

export type PoseSmoothingFilterType = 'kalman' | 'ema';

export interface KalmanFilterOptions {
  type: 'kalman';
  enabled?: boolean;
  processNoise?: number;
  measurementNoise?: number;
}

export interface EmaFilterOptions {
  type: 'ema';
  enabled?: boolean;
  alpha?: number;
}

export type PoseSmoothingFilterConfig = KalmanFilterOptions | EmaFilterOptions;

interface LandmarkFilter {
  readonly type: PoseSmoothingFilterType;
  enabled: boolean;
  apply(landmarks: NormalizedLandmarkList, stream: LandmarkStream): NormalizedLandmarkList;
  reset(): void;
  toConfig(): PoseSmoothingFilterConfig;
}

const LANDMARK_COORDINATES: LandmarkCoordinate[] = ['x', 'y', 'z'];
const DEFAULT_FILTERS: PoseSmoothingFilterConfig[] = [
  {
    type: 'kalman',
    enabled: true,
    processNoise: 0.003,
    measurementNoise: 0.03,
  },
  {
    type: 'ema',
    enabled: false,
    alpha: 0.45,
  },
];

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

const getCoordinateKey = (
  stream: LandmarkStream,
  landmarkIndex: number,
  coordinate: LandmarkCoordinate,
) => `${stream}:${landmarkIndex}:${coordinate}`;

class EmaLandmarkFilter implements LandmarkFilter {
  readonly type = 'ema' as const;
  enabled: boolean;
  private readonly alpha: number;
  private readonly previousValues = new Map<string, number>();

  constructor(config: EmaFilterOptions) {
    this.enabled = config.enabled ?? true;
    this.alpha = clamp(config.alpha ?? 0.45, 0.01, 1);
  }

  apply(landmarks: NormalizedLandmarkList, stream: LandmarkStream) {
    if (!this.enabled) {
      this.prime(landmarks, stream);
      return landmarks;
    }

    return landmarks.map((landmark, landmarkIndex) => {
      const smoothed = { ...landmark };

      for (const coordinate of LANDMARK_COORDINATES) {
        const value = landmark[coordinate];
        if (typeof value !== 'number') continue;

        const key = getCoordinateKey(stream, landmarkIndex, coordinate);
        const previousValue = this.previousValues.get(key) ?? value;
        const nextValue = this.alpha * value + (1 - this.alpha) * previousValue;

        smoothed[coordinate] = nextValue;
        this.previousValues.set(key, nextValue);
      }

      return smoothed;
    }) as NormalizedLandmarkList;
  }

  reset() {
    this.previousValues.clear();
  }

  private prime(landmarks: NormalizedLandmarkList, stream: LandmarkStream) {
    landmarks.forEach((landmark, landmarkIndex) => {
      for (const coordinate of LANDMARK_COORDINATES) {
        const value = landmark[coordinate];
        if (typeof value !== 'number') continue;

        this.previousValues.set(
          getCoordinateKey(stream, landmarkIndex, coordinate),
          value,
        );
      }
    });
  }

  toConfig(): EmaFilterOptions {
    return {
      type: 'ema',
      enabled: this.enabled,
      alpha: this.alpha,
    };
  }
}

interface KalmanCoordinateState {
  estimate: number;
  covariance: number;
}

class KalmanLandmarkFilter implements LandmarkFilter {
  readonly type = 'kalman' as const;
  enabled: boolean;
  private readonly processNoise: number;
  private readonly measurementNoise: number;
  private readonly states = new Map<string, KalmanCoordinateState>();

  constructor(config: KalmanFilterOptions) {
    this.enabled = config.enabled ?? true;
    this.processNoise = Math.max(config.processNoise ?? 0.003, 0.000001);
    this.measurementNoise = Math.max(config.measurementNoise ?? 0.03, 0.000001);
  }

  apply(landmarks: NormalizedLandmarkList, stream: LandmarkStream) {
    if (!this.enabled) {
      this.prime(landmarks, stream);
      return landmarks;
    }

    return landmarks.map((landmark, landmarkIndex) => {
      const smoothed = { ...landmark };

      for (const coordinate of LANDMARK_COORDINATES) {
        const measurement = landmark[coordinate];
        if (typeof measurement !== 'number') continue;

        const key = getCoordinateKey(stream, landmarkIndex, coordinate);
        const state = this.states.get(key) ?? {
          estimate: measurement,
          covariance: 1,
        };

        const predictedCovariance = state.covariance + this.processNoise;
        const kalmanGain =
          predictedCovariance / (predictedCovariance + this.measurementNoise);
        const estimate =
          state.estimate + kalmanGain * (measurement - state.estimate);
        const covariance = (1 - kalmanGain) * predictedCovariance;

        smoothed[coordinate] = estimate;
        this.states.set(key, { estimate, covariance });
      }

      return smoothed;
    }) as NormalizedLandmarkList;
  }

  reset() {
    this.states.clear();
  }

  private prime(landmarks: NormalizedLandmarkList, stream: LandmarkStream) {
    landmarks.forEach((landmark, landmarkIndex) => {
      for (const coordinate of LANDMARK_COORDINATES) {
        const measurement = landmark[coordinate];
        if (typeof measurement !== 'number') continue;

        this.states.set(getCoordinateKey(stream, landmarkIndex, coordinate), {
          estimate: measurement,
          covariance: 1,
        });
      }
    });
  }

  toConfig(): KalmanFilterOptions {
    return {
      type: 'kalman',
      enabled: this.enabled,
      processNoise: this.processNoise,
      measurementNoise: this.measurementNoise,
    };
  }
}

const createFilter = (config: PoseSmoothingFilterConfig): LandmarkFilter => {
  if (config.type === 'ema') {
    return new EmaLandmarkFilter(config);
  }

  return new KalmanLandmarkFilter(config);
};

export class PoseService {
  private pose: PoseType | null = null;
  private isLoaded   = false;
  private inProgress = false;
  private errorCount = 0;

  // Two buffers in a pool: one can be in flight to the worker while the other
  // is ready. Avoids per-frame allocation and GC churn.
  private pool: ArrayBuffer[] = [new ArrayBuffer(BUF_BYTES), new ArrayBuffer(BUF_BYTES)];

  constructor() {
    this.init();
  }

  private init() {
    if (this.pose) return;
    try {
      this.pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });
      this.pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: false,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      this.isLoaded = true;
      console.log('PoseService: initialized.');
    } catch (e) {
      console.error('PoseService init failed:', e);
    }
  }

  // Pack landmarks into a Float32Array from the pool for zero-copy transfer.
  // Returns null if the pool is empty (both buffers are in flight).
  packLandmarks(
    landmarks: Array<{ x: number; y: number; z?: number; visibility?: number }>
  ): { buf: ArrayBuffer; t0: number } | null {
    if (!this.pool.length) return null;
    const buf  = this.pool.pop()!;
    const view = new Float32Array(buf);
    const len  = Math.min(landmarks.length, LM_COUNT);
    for (let i = 0; i < len; i++) {
      const lm = landmarks[i];
      const o  = i * STRIDE;
      view[o]     = lm.x;
      view[o + 1] = lm.y;
      view[o + 2] = lm.z ?? 0;
      view[o + 3] = lm.visibility ?? 1;
    }
    return { buf, t0: performance.now() };
  }

  // Call this when the worker returns the buffer so the pool stays full.
  returnBuffer(buf: ArrayBuffer) {
    if (this.pool.length < 2) this.pool.push(buf);
  }

  // Unpack a transferred buffer back into landmark objects.
  static unpackLandmarks(
    buf: ArrayBuffer
  ): Array<{ x: number; y: number; z: number; visibility: number }> {
    const view = new Float32Array(buf);
    const out  = [];
    for (let i = 0; i < LM_COUNT; i++) {
      const o = i * STRIDE;
      out.push({ x: view[o], y: view[o + 1], z: view[o + 2], visibility: view[o + 3] });
    }
    return out;
  }

  onResults(callback: (results: Results) => void) {
  if (!this.pose) return;

    this.pose.onResults((results: any) => {
      this.inProgress = false;
      this.errorCount = 0;
      if (results) callback(results);
    });
  }

  this.pose.onResults((results: any) => {
    this.inProgress = false;
    this.errorCount = 0;
    if (results) {
      callback(results);
    }
  });
}
 6aba145 (fix: resolve Vite build failures in poseService.ts and WorkoutScreen.tsx)

  async send(image: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement) {
    if (!this.pose || !this.isLoaded || this.inProgress) return;
    this.inProgress = true;
    try {
      await this.pose.send({ image });
    } catch (e) {
      this.inProgress = false;
      this.errorCount++;
      if (this.errorCount > 10) {
        console.warn('PoseService: too many errors, resetting...');
        this.close();
        this.init();
        this.errorCount = 0;
      }
    }
  }

  async close() {
    if (this.pose) {
      try { await this.pose.close(); } catch {}
      this.pose      = null;
      this.isLoaded  = false;
    }
  }

  private preprocessResults(results: Results): Results {
    if (this.smoothingFilters.length === 0) return results;

    if (!results.poseLandmarks && !results.poseWorldLandmarks) {
      this.resetSmoothingFilters();
      return results;
    }

    return {
      ...results,
      poseLandmarks: results.poseLandmarks
        ? this.applyFilters(results.poseLandmarks, 'poseLandmarks')
        : results.poseLandmarks,
      poseWorldLandmarks: results.poseWorldLandmarks
        ? this.applyFilters(results.poseWorldLandmarks, 'poseWorldLandmarks')
        : results.poseWorldLandmarks,
    };
  }

  private applyFilters(
    landmarks: NormalizedLandmarkList,
    stream: LandmarkStream,
  ) {
    return this.smoothingFilters.reduce((currentLandmarks, filter) => {
      return filter.apply(currentLandmarks, stream);
    }, landmarks);
  }
}

const globalPoseService = new PoseService();
export { globalPoseService as poseService };
