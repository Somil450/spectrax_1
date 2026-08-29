import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CameraPermissionState,
  getCameraPermissionState,
  watchCameraPermission,
} from '../services/cameraPermissionService';

interface UseCameraPermissionOptions {
  /** Callback fired when the permission state becomes 'granted'. */
  onGranted?: () => void;
  /** Callback fired when the permission state becomes 'denied'. */
  onDenied?: () => void;
  /** Initial state to use while the async query is resolving. */
  initialState?: CameraPermissionState;
}

/**
 * useCameraPermission
 * React binding around cameraPermissionService. Provides the current camera
 * permission state, a `recheck()` that re-queries the Permissions API, and
 * lifecycle callbacks so screens can proactively surface a permission-denied
 * overlay (instead of waiting for getUserMedia to throw) and auto-recover the
 * moment the user re-grants access from the browser.
 */
export function useCameraPermission({
  onGranted,
  onDenied,
  initialState = 'unknown',
}: UseCameraPermissionOptions = {}) {
  const [state, setState] = useState<CameraPermissionState>(initialState);
  const onGrantedRef = useRef(onGranted);
  const onDeniedRef = useRef(onDenied);
  onGrantedRef.current = onGranted;
  onDeniedRef.current = onDenied;

  const recheck = useCallback(async () => {
    const next = await getCameraPermissionState();
    setState((prev) => {
      if (next !== prev) {
        if (next === 'granted') onGrantedRef.current?.();
        if (next === 'denied') onDeniedRef.current?.();
      }
      return next;
    });
    return next;
  }, []);

  useEffect(() => {
    let disposed = false;
    let watcher: { stop: () => void } | null = null;

    (async () => {
      const next = await getCameraPermissionState();
      if (disposed) return;
      if (next === 'granted') onGrantedRef.current?.();
      if (next === 'denied') onDeniedRef.current?.();
      setState(next);
    })();

    watcher = watchCameraPermission((next) => {
      if (disposed) return;
      if (next === 'granted') onGrantedRef.current?.();
      if (next === 'denied') onDeniedRef.current?.();
      setState(next);
    });

    return () => {
      disposed = true;
      watcher?.stop();
    };
  }, []);

  return {
    state,
    isDenied: state === 'denied',
    isGranted: state === 'granted',
    recheck,
  };
}
