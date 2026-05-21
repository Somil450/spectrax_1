import type { Pose as PoseType, Results } from '@mediapipe/pose';

// Read the runtime constructor from `window` instead of importing `Pose` as a value
// from `@mediapipe/pose`, because the global script path is the Vite/ESM-safe option.
const Pose = (window as any).Pose as typeof PoseType;


/**
 * poseService.ts
 * Wraps MediaPipe Pose for high-performance body tracking.
 * Pre-processes raw landmarks through a runtime-configurable smoothing pipeline
 * before downstream evaluation, rendering, and recording consume them.
 */

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
  private isLoaded = false;
  private inProgress = false;
  private errorCount = 0;
  private smoothingFilters: LandmarkFilter[] = DEFAULT_FILTERS.map(createFilter);

  constructor() {
    this.init();
  }

  private init() {
    if (this.pose) return;

    try {
      const PoseConstructor = (window as any).Pose as
        | MediaPipePoseConstructor
        | undefined;

      if (!PoseConstructor) {
        throw new Error('MediaPipe Pose global is not available.');
      }

      this.pose = new PoseConstructor({
        locateFile: (file) => {
          // JSDelivr CDN is used for MediaPipe WASM assets loaded from index.html.
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        },
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
    } catch (error) {
      console.error('PoseService: Failed to initialize MediaPipe Pose', error);
    }
  }

  /**
   * Replaces the smoothing pipeline.
   * Filters run in array order, so developers can choose Kalman, EMA, or both.
   */
  setSmoothingFilters(filters: PoseSmoothingFilterConfig[]) {
    this.smoothingFilters = filters.map(createFilter);
  }

  /**
   * Convenience toggle for an existing filter type without rebuilding callers.
   * If the filter does not exist yet, it is appended with default settings.
   */
  setSmoothingFilterEnabled(
    type: PoseSmoothingFilterType,
    enabled: boolean,
  ) {
    const existingFilter = this.smoothingFilters.find(
      (filter) => filter.type === type,
    );

    if (!existingFilter) {
      const defaultFilter =
        DEFAULT_FILTERS.find((filter) => filter.type === type) ?? { type };
      this.smoothingFilters = [
        ...this.smoothingFilters,
        createFilter({ ...defaultFilter, enabled } as PoseSmoothingFilterConfig),
      ];
      return;
    }

    existingFilter.enabled = enabled;
  }

  getSmoothingFilters() {
    return this.smoothingFilters.map((filter) => filter.toConfig());
  }

  resetSmoothingFilters() {
    this.smoothingFilters.forEach((filter) => filter.reset());
  }

  /**
   * Sets the callback function when pose results are available.
   */
  onResults(callback: (results: Results) => void) {
    if (!this.pose) return;

    this.pose.onResults((results: any) => {
      this.inProgress = false;
      this.errorCount = 0;

      if (results) {
        callback(this.preprocessResults(results));
      }
    });
  }

  /**
   * Processes a single video frame.
   */
  async send(image: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement) {
    if (!this.pose || !this.isLoaded || this.inProgress) return;

    this.inProgress = true;
    try {
      await this.pose.send({ image });
    } catch (error) {
      this.inProgress = false;
      this.errorCount++;
      console.error('PoseService: send error', error);

      // Re-initialize after too many consecutive errors.
      if (this.errorCount > 10) {
        console.warn('PoseService: too many errors, attempting reset...');
        await this.close();
        this.init();
        this.errorCount = 0;
      }
    }
  }

  /**
   * Cleans up the Pose instance.
   */
  async close() {
    if (this.pose) {
      try {
        await this.pose.close();
      } catch (error) {
        console.warn('Error closing pose:', error);
      }

      this.pose = null;
      this.isLoaded = false;
      this.inProgress = false;
      this.resetSmoothingFilters();
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

// Singleton: one shared instance across the app.
const globalPoseService = new PoseService();
export { globalPoseService as poseService };
