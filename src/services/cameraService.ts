/**
 * cameraService.ts
 * Manages webcam access, permissions, and streaming.
 * Includes a requestAnimationFrame-based precision scheduler
 * to synchronize pose detection with browser repaint timing,
 * preventing redundant frame calculations and reducing CPU load.
 */

export class CameraService {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;

  // ── RAF Precision Scheduler & Dynamic Adaptation ────────────────
  private rafId: number = 0;
  private isProcessing: boolean = false;
  private lastFrameTime: number = 0;
  private fpsLimit: number = 20; // Max frames per second to send to MediaPipe
  private minFpsLimit: number = 10;
  private fpsDecrementStep: number = 5;
  private resolutionScale: number = 1.0;
  private fpsHistory: number[] = [];
  private consecutiveLagFrames: number = 0;
  private lastResultTime: number = 0;
  private downscaleCanvas: HTMLCanvasElement | null = null;
  private frameCallback: ((source: HTMLVideoElement | HTMLCanvasElement) => void) | null = null;

  /**
   * Requests camera permission and starts the stream.
   * @param videoElement The HTML video element to attach the stream to.
   */
  async startCamera(videoElement: HTMLVideoElement): Promise<MediaStream> {
    this.videoElement = videoElement;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      this.videoElement.srcObject = this.stream;

      return new Promise((resolve) => {
        if (!this.videoElement) return;
        this.videoElement.onloadedmetadata = () => {
          this.videoElement?.play();
          resolve(this.stream!);
        };
      });
    } catch (error: any) {
      console.error("Camera access denied or unavailable:", error);
      if (error.name === 'NotAllowedError') {
        throw new Error("PERMISSION_DENIED");
      } else if (error.name === 'NotFoundError') {
        throw new Error("NO_CAMERA_FOUND");
      }
      throw error;
    }
  }

  /**
   * Starts the RAF-based frame processing loop.
   * Synchronized with browser repaint cycle for optimal performance.
   * @param callback Function called with each video frame.
   * @param fpsLimit Max detections per second (default: 20).
   */
  startFrameLoop(
    callback: (source: HTMLVideoElement | HTMLCanvasElement) => void,
    fpsLimit: number = 20,
    minFpsLimit: number = 10,
    fpsDecrementStep: number = 5
  ): void {
    this.frameCallback = callback;
    this.fpsLimit = fpsLimit;
    this.minFpsLimit = minFpsLimit;
    this.fpsDecrementStep = fpsDecrementStep;
    this.isProcessing = false;
    this.lastFrameTime = 0;
    this.resolutionScale = 1.0;
    this.fpsHistory = [];
    this.consecutiveLagFrames = 0;
    this.lastResultTime = 0;

    const loop = (timestamp: number) => {
      if (!this.videoElement || !this.frameCallback) return;

      const elapsed = timestamp - this.lastFrameTime;
      const interval = 1000 / this.fpsLimit;

      // Only process if enough time has passed AND previous frame is done
      if (
        elapsed >= interval &&
        !this.isProcessing &&
        this.videoElement.readyState >= 2 &&
        !this.videoElement.paused
      ) {
        this.isProcessing = true;      // Lock — prevent overlapping calls
        this.lastFrameTime = timestamp;

        let sourceToProcess: HTMLVideoElement | HTMLCanvasElement = this.videoElement;

        if (this.resolutionScale < 1.0) {
          if (!this.downscaleCanvas) {
            this.downscaleCanvas = document.createElement('canvas');
          }
          const canvas = this.downscaleCanvas;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          canvas.width = this.videoElement.videoWidth * this.resolutionScale;
          canvas.height = this.videoElement.videoHeight * this.resolutionScale;
          if (ctx) {
            ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);
            sourceToProcess = canvas;
          }
        }

        // Bug fix for #744: wrap frameCallback in a try/catch so a synchronous
        // exception can never leave isProcessing permanently set to true.
        //
        // Previously, isProcessing was set to true before the callback and only
        // reset inside onFrameComplete(), which is called externally after
        // MediaPipe finishes. If frameCallback threw synchronously — or if the
        // MediaPipe pose.send() promise rejected without triggering onResults —
        // onFrameComplete() was never called, leaving isProcessing = true forever.
        //
        // Impact without this fix: the camera feed silently freezes, the RAF loop
        // keeps burning CPU, and the only recovery is a full page reload.
        try {
          this.frameCallback(sourceToProcess);
        } catch (err) {
          console.error('[CameraService] frameCallback threw synchronously:', err);
          this.isProcessing = false; // release the lock so the loop self-recovers
        }
      }

      // Schedule next tick synchronized with browser repaint
      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  /**
   * Call this when MediaPipe finishes processing a frame.
   * Unlocks the isProcessing guard so the next frame can be sent.
   */
  onFrameComplete(): void {
    this.isProcessing = false;

    const now = Date.now();
    if (this.lastResultTime > 0) {
      const dt = now - this.lastResultTime;
      this.fpsHistory.push(1000 / dt);
      if (this.fpsHistory.length > 30) {
        this.fpsHistory.shift();
      }

      if (this.fpsHistory.length === 30) {
        const avgFps = this.fpsHistory.reduce((a, b) => a + b, 0) / 30;
        if (avgFps < this.fpsLimit * 0.7) {
          // Lagging by 30%+
          this.consecutiveLagFrames++;
          if (this.consecutiveLagFrames > 15) {
            // Consistently lagging
            if (this.fpsLimit > this.minFpsLimit) {
              this.fpsLimit -= this.fpsDecrementStep;
              console.warn(
                `[Performance] Lag detected. Dropping sample frequency to ${this.fpsLimit} FPS`
              );
            } else if (this.resolutionScale > 0.5) {
              this.resolutionScale -= 0.25;
              console.warn(
                `[Performance] Lag detected. Dropping resolution scale to ${this.resolutionScale}`
              );
            }
            this.consecutiveLagFrames = 0;
            this.fpsHistory = [];
          }
        } else {
          this.consecutiveLagFrames = 0;
        }
      }
    }
    this.lastResultTime = now;
  }

  /**
   * Stops the RAF loop and cancels any pending animation frame.
   * Prevents memory leaks when component unmounts.
   */
  stopFrameLoop(): void {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.isProcessing = false;
    this.frameCallback = null;
    this.downscaleCanvas = null;
  }

  /**
   * Stops the camera stream and cleans up all resources.
   */
  stopCamera(): void {
    this.stopFrameLoop(); // Always stop loop before stopping camera

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
  }
}

export const cameraService = new CameraService();

// src/services/cameraService.ts
import { throttleMonitor } from "./performanceThrottleService";

let currentThrottleLevel = throttleMonitor.getCurrentLevel();

// Subscribe to level changes
throttleMonitor.onLevelChange((level) => {
  currentThrottleLevel = level;
});

// MediaPipe BlazePose full-skeleton connection pairs (33 landmarks).
const POSE_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  // Face / head
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  // Torso
  [9, 10], [11, 12], [11, 23], [12, 24], [23, 24],
  // Left arm
  [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  // Right arm
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  // Left leg
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
  // Right leg
  [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
];

// Joints that get a text label (landmark index -> label).
const POSE_JOINT_LABELS: ReadonlyArray<[number, string]> = [
  [11, "L_SHOULDER"],
  [12, "R_SHOULDER"],
  [13, "L_ELBOW"],
  [14, "R_ELBOW"],
  [15, "L_WRIST"],
  [16, "R_WRIST"],
  [23, "L_HIP"],
  [24, "R_HIP"],
  [25, "L_KNEE"],
  [26, "R_KNEE"],
  [27, "L_ANKLE"],
  [28, "R_ANKLE"],
];

// Helper drawing functions
function drawFullSkeleton(ctx: CanvasRenderingContext2D, landmarks: any[]) {
  if (!landmarks || landmarks.length < 33) return;

  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;
  const toXY = (lm: any) => ({
    x: lm.x * canvasW,
    y: lm.y * canvasH,
  });

  // 1. Skeleton connections (with neon glow shadow)
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "#00ffcc";
  ctx.shadowBlur = 6;

  ctx.strokeStyle = "rgba(0, 255, 204, 0.85)";
  ctx.lineWidth = 3;
  for (const [a, b] of POSE_CONNECTIONS) {
    const la = landmarks[a];
    const lb = landmarks[b];
    if (!la || !lb || la.visibility < 0.3 || lb.visibility < 0.3) continue;
    const pa = toXY(la);
    const pb = toXY(lb);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
  ctx.restore();

  // 2. Joints as filled circles with a soft outer glow
  for (const lm of landmarks) {
    if (!lm || lm.visibility < 0.3) continue;
    const p = toXY(lm);
    ctx.save();
    ctx.shadowColor = "#ff3366";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = "#ff3366";
    ctx.fill();
    ctx.restore();
  }

  // 3. Labels for the primary joints (small, low-opacity text)
  ctx.save();
  ctx.font = "10px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
  for (const [idx, label] of POSE_JOINT_LABELS) {
    const lm = landmarks[idx];
    if (!lm || lm.visibility < 0.3) continue;
    const p = toXY(lm);
    ctx.fillText(label, p.x, p.y - 7);
  }
  ctx.restore();
}

function drawReducedSkeleton(ctx: CanvasRenderingContext2D, landmarks: any[]) {
  // Draw only major joints: shoulders, hips, knees, ankles
  const majorIndices = [11, 12, 23, 24, 25, 26, 27, 28]; // MediaPipe indices
  // Draw simple circles and lines between them
  for (const idx of majorIndices) {
    const lm = landmarks[idx];
    if (lm && lm.visibility > 0.5) {
      ctx.beginPath();
      ctx.arc(
        lm.x * ctx.canvas.width,
        lm.y * ctx.canvas.height,
        4,
        0,
        2 * Math.PI,
      );
      ctx.fillStyle = "#00ffcc";
      ctx.fill();
    }
  }
  // Optionally draw connections (e.g., shoulder to hip)
}

function drawBoundingBox(ctx: CanvasRenderingContext2D, landmarks: any[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const lm of landmarks) {
    if (lm && lm.visibility > 0.3) {
      const x = lm.x * ctx.canvas.width;
      const y = lm.y * ctx.canvas.height;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (isFinite(minX)) {
    ctx.strokeStyle = "#ff3366";
    ctx.lineWidth = 2;
    ctx.strokeRect(minX - 10, minY - 10, maxX - minX + 20, maxY - minY + 20);
  }
}

// Replace your existing draw call with this
export function drawLandmarksOnCanvas(
  ctx: CanvasRenderingContext2D,
  landmarks: any[],
) {
  if (!ctx || !landmarks) return;

  if (currentThrottleLevel === 0) {
    drawFullSkeleton(ctx, landmarks);
  } else if (currentThrottleLevel === 1) {
    drawReducedSkeleton(ctx, landmarks);
  } else {
    drawBoundingBox(ctx, landmarks);
  }
}

// TODO: Consider adding more comprehensive JSDoc comments
