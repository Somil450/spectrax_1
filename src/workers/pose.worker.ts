import type { Pose as PoseType, Results } from '@mediapipe/pose';

// Load MediaPipe Pose from CDN (standard in classic Web Worker scope)
declare const importScripts: (...urls: string[]) => void;
importScripts("https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/pose.js");

const Pose = (self as any).Pose as typeof PoseType;

let poseInstance: PoseType | null = null;

try {
  poseInstance = new Pose({
    locateFile: (file: string) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`,
  });

  poseInstance.setOptions({
    modelComplexity: 1,
    smoothLandmarks: false,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  poseInstance.onResults((results: Results) => {
    // Send back the landmark data to the main thread
    self.postMessage({
      type: "results",
      poseLandmarks: results.poseLandmarks || null,
      poseWorldLandmarks: results.poseWorldLandmarks || null,
    });
  });

  self.postMessage({ type: "ready" });
} catch (error: any) {
  self.postMessage({ type: "error", error: error.message || String(error) });
}

self.onmessage = async (event: MessageEvent) => {
  const { type, image } = event.data;

  if (type === "process") {
    if (!poseInstance) {
      self.postMessage({ type: "error", error: "Pose model not loaded" });
      if (image && typeof image.close === "function") {
        image.close();
      }
      return;
    }

    try {
      await poseInstance.send({ image });
    } catch (error: any) {
      self.postMessage({ type: "error", error: error.message || String(error) });
    } finally {
      // Clean up the transferred ImageBitmap to free resources immediately
      if (image && typeof image.close === "function") {
        image.close();
      }
    }
  } else if (type === "close") {
    if (poseInstance) {
      try {
        await poseInstance.close();
      } catch {}
      poseInstance = null;
    }
    self.postMessage({ type: "closed" });
  }
};
