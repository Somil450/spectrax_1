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

  // ── RAF Precision Scheduler ─────────────────────────────────────
  private rafId: number = 0;
  private isProcessing: boolean = false;
  private lastFrameTime: number = 0;
  private fpsLimit: number = 20; // Max frames per second to send to MediaPipe
  private frameCallback: ((video: HTMLVideoElement) => void) | null = null;

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
    callback: (video: HTMLVideoElement) => void,
    fpsLimit: number = 20
  ): void {
    this.frameCallback = callback;
    this.fpsLimit = fpsLimit;
    this.isProcessing = false;
    this.lastFrameTime = 0;

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
        try {
          this.frameCallback(this.videoElement);
        } catch (error) {
          this.isProcessing = false;
          console.error("Frame callback failed:", error);
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