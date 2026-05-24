import type { Results } from '@mediapipe/pose';

type PoseResultsPayload = {
  frameId: number | null;
  poseLandmarks?: Results['poseLandmarks'];
  poseWorldLandmarks?: Results['poseWorldLandmarks'];
};

// In a Worker context, `self` is the DedicatedWorkerGlobalScope.
// We dynamically import MediaPipe Pose and initialize it here.

let pose: any = null;
let isInitialized = false;

async function initPose() {
  if (isInitialized) return;
  try {
    // Import the module (bundlers with module workers will handle this)
    const mod = await import('@mediapipe/pose');
    const Pose = (mod as any).Pose || (self as any).Pose;

    pose = new Pose({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    pose.onResults((results: Results) => {
      const payload: PoseResultsPayload = {
        frameId: (pose as any)._lastFrameId || null,
        poseLandmarks: results.poseLandmarks,
        poseWorldLandmarks: results.poseWorldLandmarks,
      };

      // Post only the structured-clone-safe fields the app actually consumes.
      (self as any).postMessage(payload);
    });

    isInitialized = true;
    console.log('[poseLandmarkWorker] MediaPipe Pose initialized');
  } catch (err) {
    console.error('[poseLandmarkWorker] Failed to initialize Pose', err);
    (self as any).postMessage({ error: err?.message || String(err) });
  }
}

// Helper: convert ImageBitmap to an OffscreenCanvas and pass to pose
function imageBitmapToCanvas(bitmap: ImageBitmap) {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.drawImage(bitmap, 0, 0);
  return canvas;
}

self.onmessage = async (evt: MessageEvent) => {
  const data = evt.data || {};
  const { type } = data;

  if (type === 'init') {
    await initPose();
    return;
  }

  if (type === 'processFrame') {
    let imageBitmap: ImageBitmap | null = null;

    try {
      if (!isInitialized) await initPose();

      const { frameId } = data;
      imageBitmap = data.imageBitmap as ImageBitmap | null;

      if (!imageBitmap) {
        (self as any).postMessage({ frameId, error: 'no imageBitmap provided' });
        return;
      }

      // Convert to canvas-like object expected by MediaPipe
      const canvas = imageBitmapToCanvas(imageBitmap as ImageBitmap);

      // Some MediaPipe builds expect {image: HTMLImageElement|HTMLVideoElement|HTMLCanvasElement}
      // OffscreenCanvas works in many cases when running in worker; otherwise we pass ImageBitmap directly
      // We'll try to call pose.send with the OffscreenCanvas
      try {
        // Attach frameId so onResults can forward it
        (pose as any)._lastFrameId = frameId;
        await pose.send({ image: canvas as any });
      } catch (sendErr) {
        // Fallback: try passing ImageBitmap directly
        try {
          (pose as any)._lastFrameId = frameId;
          await pose.send({ image: imageBitmap as any });
        } catch (innerErr) {
          (self as any).postMessage({ frameId, error: innerErr?.message || String(innerErr) });
        }
      }
    } catch (err) {
      (self as any).postMessage({ frameId: data.frameId, error: err?.message || String(err) });
    } finally {
      if (imageBitmap) {
        imageBitmap.close();
      }
    }

    return;
  }

  // Unknown message
  console.warn('[poseLandmarkWorker] Unknown message type', type);
};
