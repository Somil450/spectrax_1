import { useEffect, useRef, useCallback } from 'react';
import { cameraService } from '../services/cameraService';
import { poseService } from '../services/poseService';
import { overlayRenderer } from '../services/overlayRenderer';
import { depthEstimationEngine } from '../services/depthEstimationEngine';
import { throttleMonitor } from '../services/performanceThrottleService';

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
  enableFrameInterpolation?: boolean;
  initTimeoutMs?: number;
}

/**
 * Maximum time (ms) allowed for the whole camera pipeline to start up
 * (model loading + camera + frame loop). When this is exceeded the
 * system aborts and reports CAMERA_TIMEOUT so the UI can show timeout
 * feedback with a retry option instead of loading forever.
 */
export const CAMERA_INIT_TIMEOUT_MS = 20000;

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
  enableFrameInterpolation = true,
  initTimeoutMs = CAMERA_INIT_TIMEOUT_MS,
}: UseCameraPoseOptions) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localCanvasRef = useRef<HTMLCanvasElement>(null);

  const videoRef = customVideoRef || localVideoRef;
  const canvasRef = customCanvasRef || localCanvasRef;
  const isMountedRef = useRef<boolean>(true);
  const frameIndexRef = useRef<number>(0);

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

    // Guard against a slow/never-completing initialization: if the whole
    // pipeline (model download + camera start) exceeds initTimeoutMs we
    // abort and report CAMERA_TIMEOUT so callers can show timeout feedback
    // with a retry option instead of leaving a loading spinner forever.
    let aborted = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    try {
      const initPromise = (async () => {
        if (setupContext) {
          const ctx = canvasRef.current!.getContext('2d');
          if (ctx) overlayRenderer.setContext(ctx);
        }

        poseService.setInterpolationEnabled(enableFrameInterpolation);

        await depthEstimationEngine.init();
        if (aborted) return;

        await cameraService.startCamera(videoRef.current!);
        if (aborted) {
          cameraService.stopCamera();
          return;
        }

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
      })();

      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          aborted = true;
          const err = new Error("CAMERA_TIMEOUT");
          err.name = "TimeoutError";
          reject(err);
        }, initTimeoutMs);
      });

      await Promise.race([initPromise, timeoutPromise]);
    } catch (err) {
      if (timer) clearTimeout(timer);
      // Clean up any partially-started camera so a retry can start fresh.
      cameraService.stopCamera();
      if (isMountedRef.current && onCameraErrorRef.current) {
        onCameraErrorRef.current(err);
      } else {
        throw err;
      }
    }
  }, [videoRef, canvasRef, setupContext, initialFpsLimit, minFpsLimit, fpsDecrementStep, enableFrameInterpolation, initTimeoutMs]);

  const stopSystem = useCallback(() => {
    isMountedRef.current = false;
    cameraService.stopCamera();
    poseService.setInterpolationEnabled(false);
    depthEstimationEngine.destroy();
  }, []);

  useEffect(() => {
    throttleMonitor.start();
    const unsubscribe = throttleMonitor.onLevelChange((level) => {
      if (level === 2) {
        console.warn("[Performance] Severe lag detected. Auto-downgrading MediaPipe model complexity to 0.");
        poseService.setOptions({ modelComplexity: 0 });
      }
    });
    return () => {
      unsubscribe();
    };
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

// TODO: Consider adding more comprehensive JSDoc comments