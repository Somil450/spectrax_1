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
          frameRate: { ideal: 30 }
        },
        audio: false
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

        this.frameCallback(sourceToProcess);
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
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
  }
}

export const cameraService = new CameraService();