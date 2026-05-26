/**
 * activityClassificationService.ts
 * Coordinates the activityWorker to perform real-time exercise detection.
 */

export interface ClassificationResult {
  label: string;
  score: number;
}

export type ActivityWorkerResponse = 
  | { type: 'ready'; quantized: boolean }
  | { type: 'model-loaded'; quantized: boolean; fallback: boolean }
  | { type: 'progress'; progress: number }
  | { type: 'prediction'; results: ClassificationResult[]; inferenceTimeMs: number; quantized: boolean; frameId?: number }
  | { type: 'error'; error: string };

export class ActivityClassificationService {
  private worker: Worker | null = null;
  private isReady = false;
  private readonly CAPTURE_INTERVAL = 200; // ms between frame captures (5 FPS)
  
  private onActivityDetected: ((results: ClassificationResult[]) => void) | null = null;
  private captureLoopTimeout: ReturnType<typeof setTimeout> | null = null;
  private isCapturing = false;

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    // Vite-style worker instantiation
    this.worker = new Worker(
      new URL('../workers/activityWorker.ts', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = (event: MessageEvent<ActivityWorkerResponse>) => {
      const data = event.data;
      
      if (data.type === 'ready') {
        this.isReady = true;
        console.log(`[ActivityService] Worker is ready. (quantized=${data.quantized})`);
      } else if (data.type === 'model-loaded') {
        console.log(`[ActivityService] Model loaded. Quantized: ${data.quantized}, Fallback: ${data.fallback}`);
      } else if (data.type === 'prediction') {
        console.log(`[ActivityService] Inference completed in ${data.inferenceTimeMs.toFixed(2)} ms (quantized=${data.quantized})`);
        if (this.onActivityDetected) {
          this.onActivityDetected(data.results);
        }
      } else if (data.type === 'error') {
        console.error('[ActivityService] Worker error:', data.error);
      }
    };

    this.worker.postMessage({ type: 'init', quantized: true });
  }

  /**
   * Starts capturing frames from the video element and sending them to the worker.
   */
  start(videoElement: HTMLVideoElement, callback: (results: ClassificationResult[]) => void) {
    this.stop();
    
    this.onActivityDetected = callback;
    this.isCapturing = true;
    
    const captureLoop = async () => {
      if (!this.isCapturing) {
        return;
      }

      if (!videoElement || videoElement.paused || videoElement.ended) {
        // Continue scheduling the loop instead of permanently stopping
        this.captureLoopTimeout = setTimeout(captureLoop, this.CAPTURE_INTERVAL);
        return;
      }

      try {
        if (this.isReady) {
          // Capture frame as ImageBitmap
          const bitmap = await createImageBitmap(videoElement);
          
          this.worker?.postMessage(
            { 
              type: 'analyze', 
              image: bitmap, 
              labels: ['squat', 'pushup', 'plank', 'bicep curl', 'jumping jack'], 
              frameId: Date.now() 
            },
            [bitmap] // Transferable objects
          );
        }
      } catch (err) {
        console.error('[ActivityService] Capture error:', err);
      }

      if (this.isCapturing) {
        this.captureLoopTimeout = setTimeout(captureLoop, this.CAPTURE_INTERVAL);
      }
    };

    captureLoop();
  }

  stop() {
    this.isCapturing = false;
    this.onActivityDetected = null;
    if (this.captureLoopTimeout) {
      clearTimeout(this.captureLoopTimeout);
      this.captureLoopTimeout = null;
    }
  }

  destroy() {
    this.stop();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isReady = false;
  }
}

export const activityClassificationService = new ActivityClassificationService();
