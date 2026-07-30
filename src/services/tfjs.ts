import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';

const DB_NAME = 'spectrax-tfjs-models';
const STORE_NAME = 'models';
const DB_VERSION = 1;

interface CachedFile {
  url: string;
  data: ArrayBuffer | string;
}

export interface MemoryStats {
  numTensors: number;
  numBytes: number;
  numBytesInGPU?: number;
  jsHeapSizeMB?: number;
  fps: number;
  resolutionScale: number;
  isThrottled: boolean;
}

class TFJSPoseService {
  private detector: poseDetection.PoseDetector | null = null;
  private db: IDBDatabase | null = null;
  private isProcessingFrame = false;

  // FPS and Dynamic Resolution Scaling state
  private frameTimestamps: number[] = [];
  private currentFps = 60;
  private resolutionScale = 1.0;
  private scaleCanvas: HTMLCanvasElement | null = null;
  private scaleCtx: CanvasRenderingContext2D | null = null;

  private async openDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'url' });
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async init(): Promise<void> {
    if (this.detector) return;
    await tf.ready();
    
    try {
      await tf.setBackend('webgl');
    } catch {
      await tf.setBackend('cpu');
    }

    try {
      this.detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.BlazePose,
        {
          runtime: 'tfjs',
          modelType: 'full',
        }
      );
      console.log('TFJS Pose Detector initialized successfully.');
    } catch (err) {
      console.error('Failed to initialize TFJS detector:', err);
    }
  }

  async initMultiPose(): Promise<void> {
    await this.init();
  }

  private updatePerformanceMetrics(): void {
    const now = performance.now();
    this.frameTimestamps.push(now);
    
    this.frameTimestamps = this.frameTimestamps.filter((ts) => now - ts <= 2000);

    if (this.frameTimestamps.length > 1) {
      const durationSeconds = (now - this.frameTimestamps[0]) / 1000;
      this.currentFps = Math.round((this.frameTimestamps.length - 1) / (durationSeconds || 1));
    }

    if (this.currentFps < 15 && this.resolutionScale > 0.5) {
      this.resolutionScale = Math.max(0.5, parseFloat((this.resolutionScale - 0.25).toFixed(2)));
      console.warn(`[TFJS] FPS dropped to ${this.currentFps}. Dynamic scaling down to ${this.resolutionScale}x`);
    } else if (this.currentFps > 28 && this.resolutionScale < 1.0) {
      this.resolutionScale = Math.min(1.0, parseFloat((this.resolutionScale + 0.25).toFixed(2)));
    }
  }

  private getScaledInput(
    image: HTMLVideoElement | HTMLCanvasElement
  ): HTMLVideoElement | HTMLCanvasElement {
    if (this.resolutionScale >= 1.0) return image;

    const srcWidth = image instanceof HTMLVideoElement ? image.videoWidth : image.width;
    const srcHeight = image instanceof HTMLVideoElement ? image.videoHeight : image.height;

    if (!srcWidth || !srcHeight) return image;

    const scaledWidth = Math.floor(srcWidth * this.resolutionScale);
    const scaledHeight = Math.floor(srcHeight * this.resolutionScale);

    if (!this.scaleCanvas) {
      this.scaleCanvas = document.createElement('canvas');
      this.scaleCtx = this.scaleCanvas.getContext('2d');
    }

    if (this.scaleCanvas.width !== scaledWidth || this.scaleCanvas.height !== scaledHeight) {
      this.scaleCanvas.width = scaledWidth;
      this.scaleCanvas.height = scaledHeight;
    }

    if (this.scaleCtx) {
      this.scaleCtx.drawImage(image, 0, 0, scaledWidth, scaledHeight);
      return this.scaleCanvas;
    }

    return image;
  }

  async estimatePose(image: HTMLVideoElement | HTMLCanvasElement): Promise<poseDetection.Pose[]> {
    if (this.isProcessingFrame) {
      return [];
    }

    this.isProcessingFrame = true;
    this.updatePerformanceMetrics();

    try {
      if (!this.detector) {
        await this.init();
      }
      if (!this.detector) return [];

      const scaledInput = this.getScaledInput(image);

      tf.engine().startScope();
      const poses = await this.detector.estimatePoses(scaledInput);
      tf.engine().endScope();

      return poses;
    } catch (err) {
      console.error('Error during pose estimation:', err);
      return [];
    } finally {
      this.isProcessingFrame = false;
    }
  }

  async estimateMultiplePoses(image: HTMLVideoElement | HTMLCanvasElement): Promise<poseDetection.Pose[]> {
    return this.estimatePose(image);
  }

  getMemoryInfo(): MemoryStats {
    const mem = tf.memory();
    const perfMem = (performance as any).memory;
    const jsHeapSizeMB = perfMem ? Math.round(perfMem.usedJSHeapSize / (1024 * 1024)) : undefined;

    return {
      numTensors: mem.numTensors,
      numBytes: mem.numBytes,
      numBytesInGPU: (mem as any).numBytesInGPU,
      jsHeapSizeMB,
      fps: this.currentFps,
      resolutionScale: this.resolutionScale,
      isThrottled: this.resolutionScale < 1.0,
    };
  }

  dispose(): void {
    if (this.detector) {
      this.detector.dispose();
      this.detector = null;
    }
    tf.disposeVariables();
    this.scaleCanvas = null;
    this.scaleCtx = null;
  }
}

export const tfjsPoseService = new TFJSPoseService();
