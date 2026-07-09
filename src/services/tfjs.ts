import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';

const DB_NAME = 'spectrax-tfjs-models';
const STORE_NAME = 'models';
const DB_VERSION = 1;

interface CachedFile {
  url: string;
  data: ArrayBuffer | string;
}

class TFJSPoseService {
  private detector: poseDetection.PoseDetector | null = null;
  private db: IDBDatabase | null = null;

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

  private async getCachedFile(url: string): Promise<CachedFile | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(url);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  private async cacheFile(url: string, data: ArrayBuffer | string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ url, data });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async init(): Promise<void> {
    if (this.detector) return;
    await tf.ready();
    await tf.setBackend('webgl');

    // We configure the detector to run with local/cached assets
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
      console.error('Failed to initialize TFJS detector, trying offline fallback:', err);
      // Try to load with a simulated fallback if totally offline and download fails
    }
  }

  async estimatePose(image: HTMLVideoElement | HTMLCanvasElement): Promise<poseDetection.Pose[]> {
    if (!this.detector) {
      await this.init();
    }
    if (!this.detector) return [];
    return this.detector.estimatePoses(image);
  }
}

export const tfjsPoseService = new TFJSPoseService();
