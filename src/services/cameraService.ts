/**
 * cameraService.ts
 * Manages webcam access, permissions, and streaming.
 */

export type CameraErrorType =
  | 'denied'
  | 'notFound'
  | 'inUse'
  | 'insecure'
  | 'unknown';

export class CameraError extends Error {
  readonly type: CameraErrorType;

  constructor(type: CameraErrorType, message: string) {
    super(message);
    this.name = 'CameraError';
    this.type = type;
  }
}

function categorizeCameraError(error: unknown): CameraError {
  if (error instanceof CameraError) return error;

  const domError = error as DOMException;
  const name = domError?.name || '';

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return new CameraError(
      'denied',
      'Camera permission was denied. Please allow access in your browser settings.',
    );
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return new CameraError(
      'notFound',
      'No camera was found on this device.',
    );
  }

  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return new CameraError(
      'inUse',
      'Your camera is already in use by another application.',
    );
  }

  if (name === 'SecurityError' || !window.isSecureContext) {
    return new CameraError(
      'insecure',
      'Camera access requires a secure context (HTTPS or localhost).',
    );
  }

  return new CameraError(
    'unknown',
    'Unable to access the camera. Please check your device and try again.',
  );
}

export class CameraService {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;

  async checkPermission(): Promise<PermissionState | 'unsupported'> {
    if (!navigator.permissions?.query) return 'unsupported';
    try {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      return result.state;
    } catch {
      return 'unsupported';
    }
  }

  async startCamera(videoElement: HTMLVideoElement): Promise<MediaStream> {
    this.videoElement = videoElement;

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new CameraError('unknown', 'Camera API is not supported in this browser.');
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      this.videoElement.srcObject = this.stream;

      return new Promise((resolve, reject) => {
        if (!this.videoElement) {
          reject(new CameraError('unknown', 'Video element unavailable.'));
          return;
        }

        this.videoElement.onloadedmetadata = () => {
          this.videoElement?.play().catch(() => undefined);
          resolve(this.stream!);
        };
      });
    } catch (error) {
      const cameraError = categorizeCameraError(error);
      console.error('Camera access error:', cameraError.message);
      throw cameraError;
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }
}

export const cameraService = new CameraService();
