/**
 * mesh3DEngine.ts
 * Unprojects 2D MediaPipe landmarks to 3D camera space using depth map.
 * Estimates camera intrinsics from video frame dimensions.
 */

import type {
  DepthLandmark,
  Mesh3DVertex,
  DepthMapResult,
} from "../types/pose";

const LM_COUNT = 33;

const _depthLandmarks: DepthLandmark[] = Array.from({ length: LM_COUNT }, () => ({
  x: 0, y: 0, z: 0, visibility: 0, depthConfidence: 0,
}));
const _meshVertices: Mesh3DVertex[] = Array.from({ length: LM_COUNT }, () => ({
  x: 0, y: 0, z: 0, visibility: 0,
}));

function estimateFocalLengthPx(frameWidth: number): number {
  return frameWidth / (2 * Math.tan((60 * Math.PI) / 360));
}

function sampleDepth(
  depthMap: DepthMapResult,
  u: number,
  v: number
): { depth: number; confidence: number } {
  const w = depthMap.width;
  const h = depthMap.height;

  const x = u * (w - 1);
  const y = v * (h - 1);

  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);

  const fx = x - x0;
  const fy = y - y0;

  const i00 = y0 * w + x0;
  const i01 = y0 * w + x1;
  const i10 = y1 * w + x0;
  const i11 = y1 * w + x1;

  const d00 = depthMap.data[i00];
  const d01 = depthMap.data[i01];
  const d10 = depthMap.data[i10];
  const d11 = depthMap.data[i11];

  const depth =
    d00 * (1 - fx) * (1 - fy) +
    d01 * fx * (1 - fy) +
    d10 * (1 - fx) * fy +
    d11 * fx * fy;

  const confidence =
    depth >= 0.5 && depth <= 5.0 ? 1.0 : depth > 5.0 ? 0.5 : 0.3;

  return { depth, confidence };
}

export function reconstruct3DMesh(
  landmarks: Array<{ x: number; y: number; z: number; visibility: number }>,
  depthMap: DepthMapResult | null,
  frameWidth: number,
  frameHeight: number
): { depthLandmarks: DepthLandmark[]; meshVertices: Mesh3DVertex[] } {
  const fx = estimateFocalLengthPx(frameWidth);
  const fy = fx;
  const cx = frameWidth / 2;
  const cy = frameHeight / 2;

  const limit = Math.min(landmarks.length, LM_COUNT);

  for (let i = 0; i < limit; i++) {
    const lm = landmarks[i];
    const dl = _depthLandmarks[i];
    const mv = _meshVertices[i];

    dl.x = lm.x;
    dl.y = lm.y;
    dl.visibility = lm.visibility ?? 1;

    if (depthMap) {
      const { depth, confidence } = sampleDepth(depthMap, lm.x, lm.y);
      dl.z = depth;
      dl.depthConfidence = confidence * (lm.visibility ?? 1);

      const px = lm.x * frameWidth;
      const py = lm.y * frameHeight;

      mv.x = (px - cx) * depth / fx;
      mv.y = (py - cy) * depth / fy;
      mv.z = depth;
      mv.visibility = dl.visibility;
    } else {
      dl.z = lm.z;
      dl.depthConfidence = lm.visibility ?? 1;

      mv.x = lm.x;
      mv.y = lm.y;
      mv.z = lm.z;
      mv.visibility = dl.visibility;
    }
  }

  return {
    depthLandmarks: _depthLandmarks.slice(0, limit).map((d) => ({ ...d })),
    meshVertices: _meshVertices.slice(0, limit).map((m) => ({ ...m })),
  };
}

export function getLandmarkDepths(
  landmarks: Array<{ x: number; y: number; z: number; visibility: number }>,
  depthMap: DepthMapResult | null,
  frameWidth: number,
  frameHeight: number
): DepthLandmark[] {
  return reconstruct3DMesh(landmarks, depthMap, frameWidth, frameHeight).depthLandmarks;
}

export { LM_COUNT };