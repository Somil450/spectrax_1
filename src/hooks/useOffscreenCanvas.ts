import { useRef } from 'react';

export function useOffscreenCanvas() {
  const offscreenEnabledRef = useRef<boolean>(false);

  const initOffscreenCanvas = (canvasEl: any, worker: Worker | null) => {
    if (!canvasEl || !worker) return null;

    if (canvasEl.__offscreenTransferred) {
      offscreenEnabledRef.current = true;
      // Canvas control already transferred
      return canvasEl;
    }

    const isOffscreenSupported = !!canvasEl.transferControlToOffscreen;
    offscreenEnabledRef.current = false;

    if (isOffscreenSupported) {
      try {
        const offscreen = canvasEl.transferControlToOffscreen();
        worker.postMessage({ type: "initCanvas", canvas: offscreen }, [
          offscreen,
        ]);
        offscreenEnabledRef.current = true;
        canvasEl.__offscreenTransferred = true;
        // OffscreenCanvas enabled
      } catch (e) {
        console.warn(
          "[useOffscreenCanvas] Failed to transfer canvas control:",
          e,
        );
      }
    }
    
    return canvasEl;
  };

  return { offscreenEnabledRef, initOffscreenCanvas };
}
