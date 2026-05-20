/**
 * cameraService.ts
 * Manages webcam access, permissions, and streaming.
 */

export class CameraService {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private captureHandle: number | null = null;
  private captureCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private captureCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

  /**
   * Requests camera permission and starts the stream.
   * @param videoElement The HTML video element to attach the stream to.
   */
  async startCamera(videoElement: HTMLVideoElement): Promise<MediaStream> {
    this.videoElement = videoElement;
    
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: false
      });
      
      this.videoElement.srcObject = this.stream;
      
      return new Promise((resolve) => {
        if (!this.videoElement) return;
        this.videoElement.onloadedmetadata = () => {
          this.videoElement?.play();
          resolve(this.stream!);
        };
      });
    } catch (error) {
      console.error("Camera access denied or unavailable:", error);
      throw error;
    }
  }

  /**
   * Stops the camera stream and cleans up resources.
   */
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  /**
   * Read battery status if available. Returns level [0..1] and charging flag.
   */
  private async getBatteryInfo(): Promise<{ level: number; charging: boolean }> {
    // navigator.getBattery is not available in all browsers; fallback to defaults
    try {
      // @ts-ignore - lib.dom may not include getBattery in some TS configs
      const battery: any = await (navigator as any).getBattery();
      return { level: battery.level ?? 1, charging: !!battery.charging };
    } catch (e) {
      return { level: 1, charging: true };
    }
  }

  /**
   * Start capturing frames from the attached video element, downsampling based on battery state.
   * The callback receives an ImageBitmap when available (fast transfer) or the canvas element.
   * Returns a stop function to end capture.
   */
  async startFrameCapture(
    callback: (frame: ImageBitmap | HTMLCanvasElement) => void,
    options?: {
      targetFps?: number;
      baseWidth?: number;
      baseHeight?: number;
      batteryAware?: boolean;
      minScale?: number; // 0.25
      maxScale?: number; // 1.0
    },
  ) {
    if (!this.videoElement) throw new Error('Video element not attached. Call startCamera first.');

    const opts = {
      targetFps: 15,
      baseWidth: this.videoElement.videoWidth || 1280,
      baseHeight: this.videoElement.videoHeight || 720,
      batteryAware: true,
      minScale: 0.25,
      maxScale: 1,
      ...(options || {}),
    };

    const batteryInfo = opts.batteryAware ? await this.getBatteryInfo() : { level: 1, charging: true };

    // Decide scale based on battery
    let scale = 1;
    if (opts.batteryAware && !batteryInfo.charging) {
      if (batteryInfo.level <= 0.15) scale = Math.max(opts.minScale, 0.25);
      else if (batteryInfo.level <= 0.4) scale = Math.max(opts.minScale, 0.5);
      else if (batteryInfo.level <= 0.7) scale = Math.max(opts.minScale, 0.75);
      else scale = opts.maxScale;
    } else {
      scale = opts.maxScale;
    }

    const targetW = Math.max(1, Math.round(opts.baseWidth * scale));
    const targetH = Math.max(1, Math.round(opts.baseHeight * scale));

    // Prepare canvas (offscreen if supported)
    if (typeof OffscreenCanvas !== 'undefined') {
      this.captureCanvas = new OffscreenCanvas(targetW, targetH);
      // @ts-ignore
      this.captureCtx = (this.captureCanvas as OffscreenCanvas).getContext('2d');
    } else {
      const c = document.createElement('canvas');
      c.width = targetW;
      c.height = targetH;
      this.captureCanvas = c;
      this.captureCtx = c.getContext('2d');
    }

    let lastTime = performance.now();
    const interval = 1000 / Math.max(1, opts.targetFps);

    const loop = async (t: number) => {
      this.captureHandle = requestAnimationFrame(loop);
      if (t - lastTime < interval) return;
      lastTime = t;

      try {
        if (!this.captureCtx || !this.captureCanvas) return;

        // Draw current video frame scaled-down
        // @ts-ignore
        this.captureCtx.drawImage(this.videoElement, 0, 0, (this.captureCanvas as any).width, (this.captureCanvas as any).height);

        // Prefer ImageBitmap for transferable performance
        if (typeof (this.captureCanvas as any).transferToImageBitmap === 'function') {
          // OffscreenCanvas -> ImageBitmap
          // @ts-ignore
          const bitmap: ImageBitmap = (this.captureCanvas as any).transferToImageBitmap();
          callback(bitmap);
          // bitmap.close(); // consumer may close
        } else {
          // Fallback: provide HTMLCanvasElement
          if (this.captureCanvas instanceof HTMLCanvasElement) {
            callback(this.captureCanvas as HTMLCanvasElement);
          }
        }
      } catch (err) {
        console.warn('Frame capture error', err);
      }
    };

    this.captureHandle = requestAnimationFrame(loop);

    // Return stop function
    return () => this.stopFrameCapture();
  }

  stopFrameCapture() {
    if (this.captureHandle) {
      cancelAnimationFrame(this.captureHandle);
      this.captureHandle = null;
    }
    if (this.captureCanvas) {
      // If OffscreenCanvas, no DOM cleanup required
      if (this.captureCanvas instanceof HTMLCanvasElement && this.captureCanvas.parentElement) {
        this.captureCanvas.parentElement.removeChild(this.captureCanvas);
      }
      this.captureCanvas = null;
      this.captureCtx = null;
    }
  }
}

export const cameraService = new CameraService();
