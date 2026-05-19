import type { Pose as PoseType, Results } from '@mediapipe/pose';

// MediaPipe ships as a UMD bundle loaded via CDN in index.html — not ESM-importable.
const Pose = (window as any).Pose as typeof PoseType;

const STRIDE    = 4;       // floats per landmark: x, y, z, visibility
const LM_COUNT  = 33;
const BUF_BYTES = LM_COUNT * STRIDE * Float32Array.BYTES_PER_ELEMENT;

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
        smoothLandmarks: true,
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
}

const globalPoseService = new PoseService();
export { globalPoseService as poseService };
