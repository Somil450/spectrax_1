import type { NormalizedLandmark } from '@mediapipe/pose';

/**
 * angleUtils.ts (Lateral Optimization version)
 * Geometric utilities for pose landmark analysis.
 * Automatically selects the most visible side and calculates orientation/stretch metrics.
 */

export function calculateAngle(
  a: NormalizedLandmark,
  b: NormalizedLandmark,
  c: NormalizedLandmark
): number {
  if (!a || !b || !c) return 0;
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);

  if (angle > 180.0) {
    angle = 360.0 - angle;
  }
  return angle;
}

function getBestSide(landmarks: any): 'left' | 'right' {
  const leftIndices = [11, 13, 15, 23, 25, 27];
  const rightIndices = [12, 14, 16, 24, 26, 28];

  const leftVis = leftIndices.reduce((sum, i) => sum + (landmarks[i]?.visibility || 0), 0) / leftIndices.length;
  const rightVis = rightIndices.reduce((sum, i) => sum + (landmarks[i]?.visibility || 0), 0) / rightIndices.length;

  return leftVis >= rightVis ? 'left' : 'right';
}

export function getJointAngles(landmarks: any): Record<string, number> {
  if (!landmarks) return {};
  const side = getBestSide(landmarks);
  
  const ids = side === 'left' 
    ? { s: 11, e: 13, w: 15, h: 23, k: 25, a: 27 }
    : { s: 12, e: 14, w: 16, h: 24, k: 26, a: 28 };

  const shoulder = landmarks[ids.s];
  const hip = landmarks[ids.h];
  const ankle = landmarks[ids.a];

  // 1. Vertical Depth (Squats)
  const totalVerticalHeight = Math.abs(ankle.y - shoulder.y) || 1;
  const hipDepth = (ankle.y - hip.y) / totalVerticalHeight;

  // 2. Lateral Score (Orientation)
  // Horizontal gap between shoulders. 1.0 = Sideways, 0.0 = Facing Camera
  const shoulderGap = Math.abs(landmarks[11].x - landmarks[12].x);
  const lateralScore = Math.max(0, 1 - (shoulderGap * 5));

  // 3. Horizontal Stretch (Pushups)
  // Body length in X-space. Should be large for plank/pushup.
  const horizontalStretch = Math.abs(ankle.x - shoulder.x);

  return {
    knee: calculateAngle(landmarks[ids.h], landmarks[ids.k], landmarks[ids.a]),
    elbow: calculateAngle(landmarks[ids.s], landmarks[ids.e], landmarks[ids.w]),
    shoulder: calculateAngle(landmarks[ids.e], landmarks[ids.s], landmarks[ids.h]),
    bodyLine: calculateAngle(landmarks[ids.s], landmarks[ids.h], landmarks[ids.a]),
    hipDepth: hipDepth * 100,
    lateralScore: lateralScore * 100,
    horizontalStretch: horizontalStretch * 100
  };
}

export function getJointVisibility(landmarks: any): Record<string, number> {
  if (!landmarks) return {};
  const side = getBestSide(landmarks);
  
  const ids = side === 'left' 
    ? { s: 11, e: 13, w: 15, h: 23, k: 25, a: 27 }
    : { s: 12, e: 14, w: 16, h: 24, k: 26, a: 28 };

  return {
    knee: landmarks[ids.k]?.visibility || 0,
    elbow: landmarks[ids.e]?.visibility || 0,
    shoulder: landmarks[ids.s]?.visibility || 0,
    bodyLine: ((landmarks[ids.s]?.visibility || 0) + (landmarks[ids.h]?.visibility || 0) + (landmarks[ids.a]?.visibility || 0)) / 3 || 0,
    hipDepth: (landmarks[ids.h]?.visibility + landmarks[ids.a]?.visibility) / 2 || 0
  };
}
