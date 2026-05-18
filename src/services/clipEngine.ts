// import { pipeline, env } from '@xenova/transformers';

// // Configure environment for robust remote model loading
// env.allowRemoteModels = true;
// env.useBrowserCache = true;
// env.remoteHost = 'https://huggingface.co/';
// env.remotePathTemplate = '{model}/resolve/{revision}/';

/**
 * clipEngine.ts
 * A lightweight Vision-Language Model (CLIP) module for intelligent fitness analysis.
 * Features: Auto-classification, Confidence Scoring, and Session Tagging.
 */

export interface ClipResult {
  label: string;
  confidence: number;
}

export interface ManualHighlightClip {
  id: string;
  timestamp: number;
  label: string;
  blob: Blob;
  previewUrl: string;
}

class ClipEngine {
  private classifier: unknown = null;
  private isLoading = false;
  private isAnalyzing = false;
  private mode: 'local' | 'cloud' = 'cloud';
  private progress = 0; // 0 to 100
  private manualClips: ManualHighlightClip[] = [];
  private frameBuffer: { blob: Blob; timestamp: number }[] = [];
  private readonly CLIP_WINDOW_MS = 5000;
  private readonly MAX_BUFFER = 90;
  // Note: For production, this should be in an .env file
  private readonly hfToken: string = ""; // Removed for security

  // Labels for zero-shot image classification
  private readonly labels = [
    "person doing pushup",
    "person doing squat",
    "person doing plank",
    "person doing jumping jack",
    "person doing bicep curl",
    "person standing"
  ];

  public isReady() {
    return !!this.classifier;
  }

  public isBusy() {
    return this.isLoading;
  }

  public getMode() {
    return this.mode;
  }

  public getProgress() {
    return this.progress;
  }

  private worker: Worker | null = null;
  private workerReady = false;

  /**
   * Initializes the CLIP model. 
   * Uses quantized INT8 weights for ~150MB download size.
   */
  public async init() {
    this.mode = 'local';
    this.isLoading = true;
    this.progress = 0;

    if (!this.worker) {
      this.worker = new Worker(
        new URL('../workers/activityWorker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (event) => {
        const { type, progress, error } = event.data;
        if (type === 'progress') {
          this.progress = progress;
        } else if (type === 'ready') {
          this.workerReady = true;
          this.isLoading = false;
          this.progress = 100;
        } else if (type === 'error') {
          console.error("CLIP Worker Error:", error);
          this.isLoading = false;
        }
      };

      this.worker.postMessage({ type: 'init' });
    }
  }

  /**
   * Analyzes a video frame using either local CLIP or Hugging Face Cloud Inference.
   */
  public async analyzeFrame(image: HTMLCanvasElement | HTMLImageElement): Promise<ClipResult | null> {
    if (this.isAnalyzing) return null;

    if (this.mode === 'local') {
      if (!this.workerReady) return null;

      return new Promise((resolve) => {
        const handleMessage = (event: MessageEvent) => {
          const { type, results } = event.data;
          if (type === 'prediction') {
            this.worker?.removeEventListener('message', handleMessage);
            this.isAnalyzing = false;
            resolve({
              label: results[0]?.label || "unknown",
              confidence: results[0]?.score || 0
            });
          }
        };

        this.isAnalyzing = true;
        this.worker?.addEventListener('message', handleMessage);

        // Send image data to worker
        if (image instanceof HTMLCanvasElement) {
          const imageData = image.getContext('2d')?.getImageData(0, 0, image.width, image.height);
          this.worker?.postMessage({
            type: 'analyze',
            image: imageData,
            labels: this.labels
          });
        }
      });
    } else if (this.mode === 'cloud') {
      return this.analyzeFrameCloud(image);
    }

    return null;
  }

  private async analyzeFrameCloud(image: HTMLCanvasElement | HTMLImageElement): Promise<ClipResult | null> {
    if (this.isAnalyzing) return null;

    try {
      this.isAnalyzing = true;

      // 1. Convert image to JPEG Blob
      const blob = await new Promise<Blob | null>((resolve) => {
        if (image instanceof HTMLCanvasElement) {
          image.toBlob((b) => resolve(b), 'image/jpeg', 0.6);
        } else {
          resolve(null);
        }
      });

      if (!blob) return null;

      // 2. Query Hugging Face Inference API
      const response = await fetch(
        "https://api-inference.huggingface.co/models/openai/clip-vit-base-patch32",
        {
          headers: {
            Authorization: `Bearer ${this.hfToken}`,
            "Content-Type": "application/json",
            "x-wait-for-model": "true"
          },
          method: "POST",
          body: JSON.stringify({
            inputs: await this.blobToBase64(blob),
            parameters: { candidate_labels: this.labels }
          }),
        }
      );

      if (!response.ok) {
        return null;
      }

      const results = await response.json();
      if (Array.isArray(results) && results.length > 0) {
        const top = results[0];
        return { label: top.label, confidence: top.score };
      }

      return null;
    } catch (error) {
      return null;
    } finally {
      this.isAnalyzing = false;
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64 || "");
      };
      reader.readAsDataURL(blob);
    });
  }

  bufferFrame(canvas: HTMLCanvasElement) {
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const timestamp = Date.now();
        this.frameBuffer.push({ blob, timestamp });
        this.frameBuffer = this.frameBuffer.filter(
          (f) => timestamp - f.timestamp <= this.CLIP_WINDOW_MS,
        );
        if (this.frameBuffer.length > this.MAX_BUFFER) {
          this.frameBuffer = this.frameBuffer.slice(-this.MAX_BUFFER);
        }
      },
      'image/jpeg',
      0.7,
    );
  }

  saveManualClip(timestamp = Date.now(), label = 'Workout Snapshot'): ManualHighlightClip | null {
    const windowStart = timestamp - this.CLIP_WINDOW_MS / 2;
    const windowEnd = timestamp + this.CLIP_WINDOW_MS / 2;
    const frames = this.frameBuffer.filter(
      (f) => f.timestamp >= windowStart && f.timestamp <= windowEnd,
    );

    if (!frames.length) return null;

    const clip: ManualHighlightClip = {
      id: `clip-${timestamp}`,
      timestamp,
      label,
      blob: frames[Math.floor(frames.length / 2)].blob,
      previewUrl: URL.createObjectURL(frames[Math.floor(frames.length / 2)].blob),
    };

    this.manualClips.push(clip);
    return clip;
  }

  getManualClips(): ManualHighlightClip[] {
    return [...this.manualClips];
  }

  removeManualClip(id: string) {
    const clip = this.manualClips.find((c) => c.id === id);
    if (clip) URL.revokeObjectURL(clip.previewUrl);
    this.manualClips = this.manualClips.filter((c) => c.id !== id);
  }

  clearManualClips() {
    this.manualClips.forEach((c) => URL.revokeObjectURL(c.previewUrl));
    this.manualClips = [];
    this.frameBuffer = [];
  }

  generateSessionTags(stats: {
    accuracy: number;
    avgConfidence: number;
    mistakes: string[];
    duration: number;
  }): string[] {
    const tags: string[] = [];
    if (stats.accuracy > 90) tags.push("Elite Precision");
    else if (stats.accuracy > 70) tags.push("Strong Consistency");
    if (stats.avgConfidence > 0.8) tags.push("Posture Master");
    if (stats.duration > 300) tags.push("High Endurance");
    if (stats.mistakes.length === 0) tags.push("Perfect Form Streak");
    return tags.length > 0 ? tags : ["Completed Session"];
  }
}

export const clipEngine = new ClipEngine();
