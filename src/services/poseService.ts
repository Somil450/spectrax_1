import type { Pose as PoseType, Results } from '@mediapipe/pose';

const Pose = (window as any).Pose as typeof PoseType;


/**
 * poseService.ts
 * Wraps MediaPipe Pose for high-performance body tracking.
 * Uses robust CDN loading and frame guards to prevent WASM and asset errors.
 */

export class PoseService {
  private pose: PoseType | null = null;
  private isLoaded: boolean = false;
  private inProgress: boolean = false;
  private errorCount: number = 0;

  constructor() {
    this.init();
  }

  private init() {
    if (this.pose) return;

    try {
      this.pose = new Pose({
        locateFile: (file) => {
          // JSDelivr CDN — most reliable for MediaPipe WASM assets
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }
      });

      this.pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      this.isLoaded = true;
      console.log("PoseService: initialized.");
    } catch (error) {
      console.error("PoseService: Failed to initialize MediaPipe Pose", error);
    }
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
        callback(results);
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
      console.error("PoseService: send error", error);

      // Re-initialize after too many consecutive errors
      if (this.errorCount > 10) {
        console.warn("PoseService: too many errors, attempting reset...");
        this.close();
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
      } catch (e) {
        console.warn("Error closing pose:", e);
      }
      this.pose = null;
      this.isLoaded = false;
    }
  }
}

// Singleton — one shared instance across the app
const globalPoseService = new PoseService();
export { globalPoseService as poseService };