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
    } catch (error: any) {
      console.error("Camera access denied or unavailable:", error);
      if (error.name === 'NotAllowedError') {
        throw new Error("PERMISSION_DENIED");
      } else if (error.name === 'NotFoundError') {
        throw new Error("NO_CAMERA_FOUND");
      }
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
