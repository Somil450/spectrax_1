/**
 * poseService.ts
 * Refactored to offload MediaPipe pose landmark extraction into a dedicated
 * Web Worker. The main thread sends ImageBitmap frames to the worker and
 * receives `results` objects back via `postMessage`.
 */

type ResultsLike = any;

export class PoseService {
  private worker: Worker | null = null;
  private inProgress = false;
  private callback: ((results: ResultsLike) => void) | null = null;
  private frameId = 0;
  private pendingPromises = new Map<number, { resolve: () => void; reject: (e: any) => void }>();

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    if (this.worker) return;

    try {
      // Vite-compatible module worker bundling
      this.worker = new Worker(new URL('../workers/poseLandmarkWorker.ts', import.meta.url), { type: 'module' });

      this.worker.onmessage = (evt: MessageEvent) => {
        const data = evt.data || {};
        const { frameId, results, error } = data;

        if (error) {
          const pending = this.pendingPromises.get(frameId);
          if (pending) {
            pending.reject(error);
            this.pendingPromises.delete(frameId);
          }
          this.inProgress = false;
          console.error('PoseService worker error:', error);
          return;
        }

        // mark frame as processed
        const pending = this.pendingPromises.get(frameId);
        if (pending) {
          pending.resolve();
          this.pendingPromises.delete(frameId);
        }

        this.inProgress = false;
        this.callback && results && this.callback(results);
      };

      this.worker.onerror = (e) => {
        console.error('PoseService worker thrown error', e);
      };

      console.log('PoseService: worker initialized');
    } catch (err) {
      console.error('PoseService: failed to spawn worker', err);
      this.worker = null;
    }
  }

  onResults(cb: (results: ResultsLike) => void) {
    this.callback = cb;
  }

  /**
   * Send a frame to the worker. Uses `createImageBitmap` for efficient transfer.
   */
  async send(image: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement) {
    if (!this.worker || this.inProgress) return;
    this.inProgress = true;
    this.frameId += 1;
    const id = this.frameId;

    try {
      const bitmap = await createImageBitmap(image as any);

      const promise = new Promise<void>((resolve, reject) => {
        this.pendingPromises.set(id, { resolve, reject });
        // Transfer the ImageBitmap for zero-copy
        try {
          this.worker!.postMessage({ type: 'processFrame', frameId: id, imageBitmap: bitmap }, [bitmap]);
        } catch (err) {
          this.pendingPromises.delete(id);
          reject(err);
        }
      });

      // wait for processing to finish (or timeout)
      const timeout = new Promise<void>((_, rej) => setTimeout(() => rej(new Error('pose worker timeout')), 2000));
      await Promise.race([promise, timeout]);
    } catch (error) {
      console.error('PoseService.send error', error);
      this.inProgress = false;
    }
  }

  close() {
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch (e) {
        console.warn('Error terminating pose worker', e);
      }
      this.worker = null;
    }
  }
}

const globalPoseService = new PoseService();
export { globalPoseService as poseService };
