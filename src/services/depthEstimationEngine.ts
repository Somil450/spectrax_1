/**
 * depthEstimationEngine.ts
 * Orchestrates monocular depth inference via a dedicated Web Worker.
 * Runs every Nth frame (default 3) to keep main thread free for 30fps pose.
 */

import type { DepthMapResult, DepthEstimationConfig } from "../types/pose";
import { DEFAULT_DEPTH_CONFIG } from "../config/depthConfig";

type DepthCallback = (result: DepthMapResult | null) => void;

export class DepthEstimationEngine {
  private worker: Worker | null = null;
  private config: DepthEstimationConfig;
  private frameCounter = 0;
  private pending = false;
  private lastResult: DepthMapResult | null = null;
  private callback: DepthCallback | null = null;
  private initialized = false;

  constructor(config: Partial<DepthEstimationConfig> = {}) {
    this.config = { ...DEFAULT_DEPTH_CONFIG, ...config };
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    this.worker = new Worker(
      new URL("../workers/depthWorker.ts", import.meta.url),
      { type: "module" }
    );

    this.worker.onmessage = (e: MessageEvent) => {
      this.pending = false;
      if (e.data?.type === "depthResult") {
        this.lastResult = e.data.result as DepthMapResult;
        this.callback?.(this.lastResult);
      } else if (e.data?.type === "error") {
        console.error("[DepthEngine] worker error:", e.data.error);
        this.callback?.(null);
      }
    };

    this.worker.postMessage({
      type: "init",
      config: this.config,
    });

    this.initialized = true;
  }

  processFrame(
    source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
    onResult: DepthCallback
  ): boolean {
    this.callback = onResult;
    this.frameCounter++;

    if (this.frameCounter % this.config.frameSkip !== 0) {
      if (this.lastResult) {
        onResult(this.lastResult);
      }
      return false;
    }

    if (!this.worker || this.pending) {
      if (this.lastResult) {
        onResult(this.lastResult);
      }
      return false;
    }

    this.pending = true;

    const canvas = document.createElement("canvas");
    canvas.width = source instanceof HTMLVideoElement ? source.videoWidth : (source as HTMLCanvasElement).width;
    canvas.height = source instanceof HTMLVideoElement ? source.videoHeight : (source as HTMLCanvasElement).height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      this.pending = false;
      return false;
    }
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

    createImageBitmap(canvas).then((bitmap) => {
      this.worker?.postMessage(
        {
          type: "infer",
          bitmap,
          frameId: this.frameCounter,
        },
        [bitmap]
      );
    }).catch((err) => {
      console.error("[DepthEngine] bitmap creation failed:", err);
      this.pending = false;
    });

    return true;
  }

  getLastResult(): DepthMapResult | null {
    return this.lastResult;
  }

  destroy(): void {
    this.worker?.terminate();
    this.worker = null;
    this.initialized = false;
    this.pending = false;
    this.lastResult = null;
    this.callback = null;
  }
}

export const depthEstimationEngine = new DepthEstimationEngine();