import { useEffect, useRef, useCallback } from 'react';
import { cameraService } from '../services/cameraService';
import { poseService } from '../services/poseService';
import { overlayRenderer } from '../services/overlayRenderer';

interface UseCameraPoseOptions {
  videoRef?: React.RefObject<HTMLVideoElement>;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
  initialFpsLimit?: number;
  minFpsLimit?: number;
  fpsDecrementStep?: number;
  onResults: (results: any) => void;
  onFrame?: (count: number) => void;
  onCameraError?: (error: any) => void;
  setupContext?: boolean;
}

export function useCameraPose({
  videoRef: customVideoRef,
  canvasRef: customCanvasRef,
  initialFpsLimit = 20,
  minFpsLimit = 10,
  fpsDecrementStep = 5,
  onResults,
  onFrame,
  onCameraError,
  setupContext = true,
}: UseCameraPoseOptions) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localCanvasRef = useRef<HTMLCanvasElement>(null);

  const videoRef = customVideoRef || localVideoRef;
  const canvasRef = customCanvasRef || localCanvasRef;
  const isMountedRef = useRef<boolean>(true);
  const frameIndexRef = useRef<number>(0);

  // Use refs for callbacks to avoid re-triggering closures and effects
  const onResultsRef = useRef(onResults);
  onResultsRef.current = onResults;

  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const onCameraErrorRef = useRef(onCameraError);
  onCameraErrorRef.current = onCameraError;

  const startSystem = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    isMountedRef.current = true;
    frameIndexRef.current = 0;

    try {
      if (setupContext) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) overlayRenderer.setContext(ctx);
      }

      await cameraService.startCamera(videoRef.current);

      poseService.onResults((results) => {
        if (!isMountedRef.current) return;
        cameraService.onFrameComplete();
        onResultsRef.current(results);
      });

      cameraService.startFrameLoop(
        (source) => {
          if (!isMountedRef.current) return;
          poseService.send(source);
          if (onFrameRef.current) {
            frameIndexRef.current++;
            onFrameRef.current(frameIndexRef.current);
          }
        },
        initialFpsLimit,
        minFpsLimit,
        fpsDecrementStep
      );
    } catch (err) {
      if (isMountedRef.current && onCameraErrorRef.current) {
        onCameraErrorRef.current(err);
      } else {
        throw err;
      }
    }
  }, [videoRef, canvasRef, setupContext, initialFpsLimit, minFpsLimit, fpsDecrementStep]);

  const stopSystem = useCallback(() => {
    isMountedRef.current = false;
    cameraService.stopCamera();
  }, []);

  useEffect(() => {
    return () => {
      stopSystem();
    };
  }, [stopSystem]);

  return {
    videoRef,
    canvasRef,
    startSystem,
    stopSystem,
    isMountedRef,
  };
}
