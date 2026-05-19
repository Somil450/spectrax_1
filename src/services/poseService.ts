// MediaPipe packages are CDN-loaded via index.html; import types only, not the runtime module.
import type { Results } from '@mediapipe/pose';

const Pose = (window as any).Pose as new (config: {
  locateFile: (file: string) => string;
}) => {
  setOptions(opts: Record<string, unknown>): void;
  onResults(cb: (r: Results) => void): void;
  send(input: { image: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement }): Promise<void>;
  close(): Promise<void>;
};

// ─── Landmark types ───────────────────────────────────────────────────────────

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export type LandmarkInterceptor = (landmarks: Landmark[]) => Landmark[];

// ─── EMA filter ───────────────────────────────────────────────────────────────

export class EMAFilter {
  private prev: Array<{ x: number; y: number; z: number }> = [];

  constructor(private alpha = 0.4) {}

  apply: LandmarkInterceptor = (landmarks) => {
    if (this.prev.length !== landmarks.length) {
      this.prev = landmarks.map(({ x, y, z }) => ({ x, y, z }));
      return landmarks;
    }

    return landmarks.map((lm, i) => {
      const p = this.prev[i];
      const smoothed = {
        x: this.alpha * lm.x + (1 - this.alpha) * p.x,
        y: this.alpha * lm.y + (1 - this.alpha) * p.y,
        z: this.alpha * lm.z + (1 - this.alpha) * p.z,
        visibility: lm.visibility,
      };
      this.prev[i] = smoothed;
      return smoothed;
    });
  };

  reset() {
    this.prev = [];
  }
}

// ─── Kalman filter ────────────────────────────────────────────────────────────

interface KalmanState {
  x: number; y: number; z: number;
  px: number; py: number; pz: number;
}

export class KalmanFilter {
  private states: KalmanState[] = [];

  constructor(
    private processNoise = 1e-3,
    private measurementNoise = 0.1,
  ) {}

  private scalar(est: number, p: number, measurement: number): { est: number; p: number } {
    const pPred = p + this.processNoise;
    const k = pPred / (pPred + this.measurementNoise);
    return { est: est + k * (measurement - est), p: (1 - k) * pPred };
  }

  apply: LandmarkInterceptor = (landmarks) => {
    if (this.states.length !== landmarks.length) {
      this.states = landmarks.map(({ x, y, z }) => ({ x, y, z, px: 1, py: 1, pz: 1 }));
      return landmarks;
    }

    return landmarks.map((lm, i) => {
      const s = this.states[i];
      const rx = this.scalar(s.x, s.px, lm.x);
      const ry = this.scalar(s.y, s.py, lm.y);
      const rz = this.scalar(s.z, s.pz, lm.z);
      this.states[i] = { x: rx.est, y: ry.est, z: rz.est, px: rx.p, py: ry.p, pz: rz.p };
      return { x: rx.est, y: ry.est, z: rz.est, visibility: lm.visibility };
    });
  };

  reset() {
    this.states = [];
  }
}

// ─── Interceptor pipeline ─────────────────────────────────────────────────────

interface InterceptorEntry {
  name: string;
  fn: LandmarkInterceptor;
  enabled: boolean;
}

export class InterceptorPipeline {
  private entries: InterceptorEntry[] = [];

  add(name: string, fn: LandmarkInterceptor): this {
    if (this.entries.some((e) => e.name === name)) return this;
    this.entries.push({ name, fn, enabled: true });
    return this;
  }

  remove(name: string): this {
    this.entries = this.entries.filter((e) => e.name !== name);
    return this;
  }

  enable(name: string): this {
    const entry = this.entries.find((e) => e.name === name);
    if (entry) entry.enabled = true;
    return this;
  }

  disable(name: string): this {
    const entry = this.entries.find((e) => e.name === name);
    if (entry) entry.enabled = false;
    return this;
  }

  isEnabled(name: string): boolean {
    return this.entries.find((e) => e.name === name)?.enabled ?? false;
  }

  process(landmarks: Landmark[]): Landmark[] {
    return this.entries
      .filter((e) => e.enabled)
      .reduce((acc, e) => e.fn(acc), landmarks);
  }
}

// ─── PoseService ──────────────────────────────────────────────────────────────

export class PoseService {
  private pose: InstanceType<typeof Pose> | null = null;
  private isLoaded = false;
  private inProgress = false;
  private errorCount = 0;

  readonly pipeline = new InterceptorPipeline();

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
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      this.isLoaded = true;
    } catch (error) {
      console.error('PoseService: init failed', error);
    }
  }

  onResults(callback: (results: Results) => void) {
    if (!this.pose) return;

    this.pose.onResults((results: Results) => {
      this.inProgress = false;
      this.errorCount = 0;

      if (!results) return;

      if (results.poseLandmarks) {
        (results as any).poseLandmarks = this.pipeline.process(
          results.poseLandmarks as unknown as Landmark[]
        );
      }

      callback(results);
    });
  }

  async send(image: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement) {
    if (!this.pose || !this.isLoaded || this.inProgress) return;

    this.inProgress = true;
    try {
      await this.pose.send({ image });
    } catch (error) {
      this.inProgress = false;
      this.errorCount++;
      console.error('PoseService: send error', error);

      if (this.errorCount > 10) {
        console.warn('PoseService: too many errors, resetting...');
        await this.close();
        this.init();
        this.errorCount = 0;
      }
    }
  }

  async close() {
    if (this.pose) {
      try {
        await this.pose.close();
      } catch {
        // best-effort cleanup
      }
      this.pose = null;
      this.isLoaded = false;
    }
  }
}

// ─── Singleton + default pipeline ─────────────────────────────────────────────

const globalPoseService = new PoseService();

// Named exports so callers can reset/reconfigure individual filters at runtime.
export const kalmanFilter = new KalmanFilter();
export const emaFilter = new EMAFilter();

// Kalman runs first (physics-model correction), EMA second (perceptual smoothing).
globalPoseService.pipeline
  .add('kalman', kalmanFilter.apply)
  .add('ema', emaFilter.apply);

export { globalPoseService as poseService };
