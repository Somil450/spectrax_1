/**
 * cameraService.ts
 * Manages webcam access, permissions, and streaming.
 */

export class CameraService {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;

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
    } catch (error) {
      console.error("Camera access denied or unavailable:", error);
      throw error;
    }
  }

  /**
   * Stops the camera stream and cleans up resources.
   */
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
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

// Helper drawing functions
function drawFullSkeleton(ctx: CanvasRenderingContext2D, landmarks: any[]) {
  // Your existing full drawing logic (connections + labels + shadows)
  // ...
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
