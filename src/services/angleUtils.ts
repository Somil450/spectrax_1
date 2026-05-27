import type { NormalizedLandmark } from '@mediapipe/pose';
import { POSE_LANDMARKS } from '../config/poseLandmarks';

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
  const leftIndices = [
    POSE_LANDMARKS.LEFT_SHOULDER,
    POSE_LANDMARKS.LEFT_ELBOW,
    POSE_LANDMARKS.LEFT_WRIST,
    POSE_LANDMARKS.LEFT_HIP,
    POSE_LANDMARKS.LEFT_KNEE,
    POSE_LANDMARKS.LEFT_ANKLE
  ];
  const rightIndices = [
    POSE_LANDMARKS.RIGHT_SHOULDER,
    POSE_LANDMARKS.RIGHT_ELBOW,
    POSE_LANDMARKS.RIGHT_WRIST,
    POSE_LANDMARKS.RIGHT_HIP,
    POSE_LANDMARKS.RIGHT_KNEE,
    POSE_LANDMARKS.RIGHT_ANKLE
  ];

  const leftVis = leftIndices.reduce((sum, i) => sum + (landmarks[i]?.visibility || 0), 0) / leftIndices.length;
  const rightVis = rightIndices.reduce((sum, i) => sum + (landmarks[i]?.visibility || 0), 0) / rightIndices.length;

  return leftVis >= rightVis ? 'left' : 'right';
}

export function getJointAngles(landmarks: any): Record<string, number> {
  if (!landmarks) return {};
  const side = getBestSide(landmarks);
  
  const ids = side === 'left' 
    ? { s: POSE_LANDMARKS.LEFT_SHOULDER, e: POSE_LANDMARKS.LEFT_ELBOW, w: POSE_LANDMARKS.LEFT_WRIST, h: POSE_LANDMARKS.LEFT_HIP, k: POSE_LANDMARKS.LEFT_KNEE, a: POSE_LANDMARKS.LEFT_ANKLE }
    : { s: POSE_LANDMARKS.RIGHT_SHOULDER, e: POSE_LANDMARKS.RIGHT_ELBOW, w: POSE_LANDMARKS.RIGHT_WRIST, h: POSE_LANDMARKS.RIGHT_HIP, k: POSE_LANDMARKS.RIGHT_KNEE, a: POSE_LANDMARKS.RIGHT_ANKLE };

  const shoulder = landmarks[ids.s];
  const hip = landmarks[ids.h];
  const ankle = landmarks[ids.a];
  const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
  const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
  const leftElbow = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
  const rightElbow = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
  const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
  const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
  const leftAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
  const rightAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];

  // 1. Vertical Depth (Squats)
  const totalVerticalHeight = Math.abs(ankle.y - shoulder.y) || 1;
  const hipDepth = (ankle.y - hip.y) / totalVerticalHeight;

  // 2. Lateral Score (Orientation)
  // Horizontal gap between shoulders. 1.0 = Sideways, 0.0 = Facing Camera
  const shoulderGap = Math.abs(landmarks[POSE_LANDMARKS.LEFT_SHOULDER].x - landmarks[POSE_LANDMARKS.RIGHT_SHOULDER].x);
  const lateralScore = Math.max(0, 1 - (shoulderGap * 5));

  // 3. Horizontal Stretch (Pushups)
  // Body length in X-space. Should be large for plank/pushup.
  const horizontalStretch = Math.abs(ankle.x - shoulder.x);

  const leftArmOpen = calculateAngle(leftElbow, leftShoulder, leftHip);
  const rightArmOpen = calculateAngle(rightElbow, rightShoulder, rightHip);
  const hipWidth = Math.abs((leftHip?.x ?? 0) - (rightHip?.x ?? 0)) || 0.1;
  const ankleGap = Math.abs((leftAnkle?.x ?? 0) - (rightAnkle?.x ?? 0));

  return {
    knee: calculateAngle(landmarks[ids.h], landmarks[ids.k], landmarks[ids.a]),
    elbow: calculateAngle(landmarks[ids.s], landmarks[ids.e], landmarks[ids.w]),
    shoulder: calculateAngle(landmarks[ids.e], landmarks[ids.s], landmarks[ids.h]),
    bodyLine: calculateAngle(landmarks[ids.s], landmarks[ids.h], landmarks[ids.a]),
    hipDepth: hipDepth * 100,
    lateralScore: lateralScore * 100,
    horizontalStretch: horizontalStretch * 100,
    jumpingJackArmOpen: (leftArmOpen + rightArmOpen) / 2,
    jumpingJackLegSpread: Math.min(300, (ankleGap / hipWidth) * 100),
  };
}

export function getJointVisibility(landmarks: any): Record<string, number> {
  if (!landmarks) return {};
  
  // Use the maximum visibility between left and right pairs to recover from partial-body occlusion
  const vis = (leftId: number, rightId: number) => 
    Math.max(landmarks[leftId]?.visibility || 0, landmarks[rightId]?.visibility || 0);

  return {
    knee: vis(POSE_LANDMARKS.LEFT_KNEE, POSE_LANDMARKS.RIGHT_KNEE),
    elbow: vis(POSE_LANDMARKS.LEFT_ELBOW, POSE_LANDMARKS.RIGHT_ELBOW),
    shoulder: vis(POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.RIGHT_SHOULDER),
    bodyLine: (vis(POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.RIGHT_SHOULDER) + vis(POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.RIGHT_HIP) + vis(POSE_LANDMARKS.LEFT_ANKLE, POSE_LANDMARKS.RIGHT_ANKLE)) / 3 || 0,
    hipDepth: (vis(POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.RIGHT_HIP) + vis(POSE_LANDMARKS.LEFT_ANKLE, POSE_LANDMARKS.RIGHT_ANKLE)) / 2 || 0
  };
}
