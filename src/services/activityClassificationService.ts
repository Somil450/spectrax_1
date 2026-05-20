/**
 * activityClassificationService.ts
 * Coordinates the activityWorker to perform real-time exercise detection.
 */

export interface ClassificationResult {
  label: string;
  score: number;
}

export class ActivityClassificationService {
  private worker: Worker | null = null;
  private isReady = false;
  private frameBuffer: ImageBitmap[] = [];
  private readonly BUFFER_SIZE = 16; // Number of frames for the transformer model
  private readonly CAPTURE_INTERVAL = 200; // ms between frame captures (5 FPS)
  
  private onActivityDetected: ((results: ClassificationResult[]) => void) | null = null;

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    // Vite-style worker instantiation
    this.worker = new Worker(
      new URL('../workers/activityWorker.ts', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = (event) => {
      const { type, results, error } = event.data;
      
      if (type === 'ready') {
        this.isReady = true;
        console.log('[ActivityService] Worker is ready.');
      } else if (type === 'prediction') {
        if (this.onActivityDetected) {
          this.onActivityDetected(results);
        }
      } else if (type === 'error') {
        console.error('[ActivityService] Worker error:', error);
      }
    };

    this.worker.postMessage({ type: 'init' });
  }

  /**
   * Starts capturing frames from the video element and sending them to the worker.
   */
  start(videoElement: HTMLVideoElement, callback: (results: ClassificationResult[]) => void) {
    this.onActivityDetected = callback;
    
    const captureLoop = async () => {
      if (!videoElement || videoElement.paused || videoElement.ended) return;

      try {
        // Capture frame as ImageBitmap
        const bitmap = await createImageBitmap(videoElement);
        this.frameBuffer.push(bitmap);

        // Keep buffer size constant
        if (this.frameBuffer.length > this.BUFFER_SIZE) {
          const old = this.frameBuffer.shift();
          old?.close(); // Clean up memory
        }

        // If buffer is full, send for classification
        if (this.frameBuffer.length === this.BUFFER_SIZE && this.isReady) {
          // Transfer the bitmaps to the worker (efficient)
          // We create a copy for the worker so we can keep our buffer moving
          const framesToProcess = await Promise.all(
            this.frameBuffer.map(b => createImageBitmap(b))
          );
          
          this.worker?.postMessage(
            { frames: framesToProcess, frameId: Date.now() },
            framesToProcess // Transferable objects
          );
        }
      } catch (err) {
        console.error('[ActivityService] Capture error:', err);
      }

      setTimeout(captureLoop, this.CAPTURE_INTERVAL);
    };

    captureLoop();
  }

  stop() {
    this.onActivityDetected = null;
    this.frameBuffer.forEach(b => b.close());
    this.frameBuffer = [];
  }
}

export const activityClassificationService = new ActivityClassificationService();
