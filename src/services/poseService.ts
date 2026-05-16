import type { Pose as PoseType, Results } from '@mediapipe/pose';

// MediaPipe's npm packages are not ESM-compatible. Since we load them via CDN in index.html,
// we use the global variables to avoid Vite module resolution errors.
const Pose = (window as any).Pose as typeof PoseType;



/**
 * poseService.ts (Updated for Stability)
 * Wraps MediaPipe Pose for high-performance body tracking.
 * Uses robust CDN loading and frame guards to prevent WASM and asset errors.
 */

export class PoseService {
  private pose: Pose | null = null;
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
          // Standard CDN - JSDelivr is usually the most reliable for MediaPipe
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
    
    this.pose.onResults((results) => {
      this.inProgress = false;
      this.errorCount = 0; // Reset error count on success
      if (results) {
        callback(results);
      }
    });
  }

  /**
   * Processes a single frame.
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
      
      // If we see recurring fatal errors, try to re-initialize
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

// Ensure singleton instance
const globalPoseService = new PoseService();
export { globalPoseService as poseService };
