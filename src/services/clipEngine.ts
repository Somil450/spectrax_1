/**
 * clipEngine.ts
 * A lightweight Vision-Language Model (CLIP) module for intelligent fitness analysis.
 * Features: Auto-classification, Confidence Scoring, and Session Tagging.
 *
 * Audio alerts are generated dynamically via the Web Audio API (see audioAlertService.ts).
 * No external MP3 assets are loaded, keeping the bundle lean.
 */

import { playAlert, isAudioSupported, AudioAlertOptions } from './audioAlertService';

export interface ClipResult {
  label: string;
  confidence: number;
}

class ClipEngine {
  private isLoading = false;
  private isAnalyzing = false;
  private mode = 'local' as const;
  private progress = 0; // 0 to 100

  // Labels for zero-shot image classification
  private readonly labels = [
    "person doing pushup",
    "person doing squat",
    "person doing plank",
    "person doing jumping jack",
    "person doing bicep curl",
    "person standing"
  ];

  private helperCanvas: HTMLCanvasElement | null = null;

  // ---------------------------------------------------------------------------
  // Audio alert options (can be updated at runtime, e.g. from SettingsContext)
  // ---------------------------------------------------------------------------

  /** Global audio options forwarded to every playAlert() call. */
  private audioOptions: AudioAlertOptions = { muted: false, volume: 1 };

  /**
   * Returns true when the Web Audio API is available in the current browser.
   * Components may call this to decide whether to show a mute toggle.
   */
  public hasAudioSupport(): boolean {
    return isAudioSupported();
  }

  /**
   * Updates audio-alert options (volume, mute state).
   * @example clipEngine.setAudioOptions({ muted: true });
   * @example clipEngine.setAudioOptions({ volume: 0.5 });
   */
  public setAudioOptions(opts: Partial<AudioAlertOptions>): void {
    this.audioOptions = { ...this.audioOptions, ...opts };
  }

  // ---------------------------------------------------------------------------
  // Convenience wrappers that components can call directly
  // ---------------------------------------------------------------------------

  /** Plays a rep-complete beep. Call after each successful repetition. */
  public alertRepComplete(): void {
    playAlert('rep_complete', this.audioOptions);
  }

  /** Plays a form-warning double-pulse. Call when posture feedback is 'red'. */
  public alertFormWarning(): void {
    playAlert('form_warning', this.audioOptions);
  }

  /** Plays a milestone ascending chord. Call on badge / streak achievements. */
  public alertMilestone(): void {
    playAlert('milestone', this.audioOptions);
  }

  /** Plays a session-end descending sweep. Call when the workout finishes. */
  public alertSessionEnd(): void {
    playAlert('session_end', this.audioOptions);
  }

  /** Plays a countdown tick. Call on each countdown timer decrement. */
  public alertCountdown(): void {
    playAlert('countdown', this.audioOptions);
  }

  // ---------------------------------------------------------------------------
  // Existing ClipEngine API (unchanged)
  // ---------------------------------------------------------------------------

  public isReady() {
    return this.workerReady;
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
   * Analyzes a video frame using the local CLIP worker.
   */
  public async analyzeFrame(image: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement): Promise<ClipResult | null> {
    if (this.isAnalyzing || !this.workerReady) return null;

    let targetImage: HTMLCanvasElement | HTMLImageElement = image as any;

    if (image instanceof HTMLVideoElement) {
      if (!this.helperCanvas) {
        this.helperCanvas = document.createElement('canvas');
      }
      this.helperCanvas.width = image.videoWidth || 640;
      this.helperCanvas.height = image.videoHeight || 480;
      const ctx = this.helperCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(image, 0, 0, this.helperCanvas.width, this.helperCanvas.height);
      }
      targetImage = this.helperCanvas;
    }

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

      if (targetImage instanceof HTMLCanvasElement) {
        const imageData = targetImage.getContext('2d')?.getImageData(0, 0, targetImage.width, targetImage.height);
        this.worker?.postMessage({
          type: 'analyze',
          image: imageData,
          labels: this.labels
        });
      }
    });
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
