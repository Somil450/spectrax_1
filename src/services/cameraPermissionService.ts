/**
 * cameraPermissionService.ts
 * Proactive camera permission monitoring.
 *
 * Uses the Permissions API (navigator.permissions.query({ name: 'camera' }))
 * to detect a persistently denied camera permission BEFORE attempting
 * getUserMedia, and to auto-recover when the user re-grants access from
 * the browser's site settings.
 *
 * Browser support notes:
 *  - Chrome / Edge / Opera: name: 'camera' is supported.
 *  - Safari: the Permissions API is not implemented — every query rejects,
 *    so we fall back to "unknown" and let getUserMedia decide.
 *  - Browsers that treat camera permission as 'prompt' on every request
 *    still work: the query result is only used to short-circuit a definite
 *    denial.
 */

export type CameraPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface CameraPermissionWatcher {
  /** Unsubscribes the change handler. */
  stop: () => void;
}

/**
 * Resolves the current camera permission state without prompting the user.
 * Falls back to 'unknown' whenever the Permissions API is unavailable.
 */
export async function getCameraPermissionState(): Promise<CameraPermissionState> {
  try {
    if (!navigator.permissions || typeof navigator.permissions.query !== 'function') {
      return 'unknown';
    }
    const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
    return result.state as CameraPermissionState;
  } catch (err) {
    // The 'camera' name is not supported by this browser — let getUserMedia decide.
    return 'unknown';
  }
}

/**
 * Subscribes to camera permission changes and invokes the callback with the
 * new state whenever the browser reports a change. Returns a stop() handle.
 *
 * Safe to call on browsers without the Permissions API — it immediately
 * returns a no-op watcher.
 */
export function watchCameraPermission(onChange: (state: CameraPermissionState) => void): CameraPermissionWatcher {
  const watcher: CameraPermissionWatcher = {
    stop: () => {},
  };
  try {
    if (!navigator.permissions || typeof navigator.permissions.query !== 'function') {
      return watcher;
    }
    const queryPromise = navigator.permissions.query({ name: 'camera' as PermissionName });
    queryPromise
      .then((result) => {
        const handler = () => onChange(result.state as CameraPermissionState);
        result.addEventListener('change', handler);
        watcher.stop = () => result.removeEventListener('change', handler);
      })
      .catch(() => {
        // Unsupported — no-op.
      });
  } catch (err) {
    // Unsupported — no-op.
  }
  return watcher;
}

/**
 * Convenience wrapper for the common "react to re-grant" flow: returns a
 * stop() handle and calls onGranted exactly once when the permission
 * transitions to 'granted'.
 */
export function watchCameraGranted(onGranted: () => void): CameraPermissionWatcher {
  return watchCameraPermission((state) => {
    if (state === 'granted') {
      onGranted();
    }
  });
}
