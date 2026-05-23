/**
 * cameraService.ts
 * Manages webcam access, permissions, and streaming.
 */

export class CameraService {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;

  /**
   * Requests camera permission and starts the stream.
   * @param videoElement The HTML video element to attach the stream to.
   * @param timeoutMs The maximum time to wait for camera start before timing out.
   */
  async startCamera(videoElement: HTMLVideoElement, timeoutMs: number = 15000): Promise<MediaStream> {
    this.videoElement = videoElement;
    
    let timeoutId: any;
    let handleLoadedMetadata: (() => void) | null = null;
    let handleError: ((err: any) => void) | null = null;

    const cleanupListeners = () => {
      if (this.videoElement) {
        if (handleLoadedMetadata) {
          this.videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
        }
        if (handleError) {
          this.videoElement.removeEventListener('error', handleError);
        }
      }
    };

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        cleanupListeners();
        reject(new Error("Webcam initialization timed out"));
      }, timeoutMs);
    });

    const cameraPromise = (async () => {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: false
      });
      
      this.videoElement.srcObject = this.stream;
      
      return new Promise<MediaStream>((resolve, reject) => {
        if (!this.videoElement) {
          reject(new Error("Video element is not available"));
          return;
        }

        handleLoadedMetadata = () => {
          cleanupListeners();
          this.videoElement?.play()
            .then(() => resolve(this.stream!))
            .catch(err => reject(err));
        };

        handleError = (err: any) => {
          cleanupListeners();
          reject(err);
        };

        this.videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
        this.videoElement.addEventListener('error', handleError);

        // If metadata is already loaded
        if (this.videoElement.readyState >= 1) {
          handleLoadedMetadata();
        }
      });
    })();

    try {
      const result = await Promise.race([cameraPromise, timeoutPromise]);
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      cleanupListeners();
      this.stopCamera();
      console.error("Camera access denied, timed out, or unavailable:", error);
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
}

export const cameraService = new CameraService();
