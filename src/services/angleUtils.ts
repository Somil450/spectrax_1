import type { NormalizedLandmark } from '@mediapipe/pose';
import { POSE_LANDMARKS } from '../config/poseLandmarks';

/**
 * angleUtils.ts — Inline Math Vector Operations Performance Tuner
 *
 * All calculations are strictly inlined with zero heap allocations:
 * - No intermediate objects or arrays created inside hot paths
 * - No destructuring inside loops
 * - Reusable module-level scratch variables for vector math
 * - All math ops inlined directly — no helper object allocation
 */

let _ax = 0, _ay = 0;
let _bx = 0, _by = 0;
let _cx = 0, _cy = 0;
let _radians = 0;
let _angle = 0;

const _angles: Record<string, number> = {
  knee: 0, elbow: 0, shoulder: 0, bodyLine: 0,
  hipDepth: 0, lateralScore: 0, horizontalStretch: 0,
};

const _visibility: Record<string, number> = {
  knee: 0, elbow: 0, shoulder: 0, bodyLine: 0, hipDepth: 0,
};

export function calculateAngle(
  a: NormalizedLandmark,
  b: NormalizedLandmark,
  c: NormalizedLandmark
): number {
  if (!a || !b || !c) return 0;
  _ax = a.x; _ay = a.y;
  _bx = b.x; _by = b.y;
  _cx = c.x; _cy = c.y;
  _radians = Math.atan2(_cy - _by, _cx - _bx) - Math.atan2(_ay - _by, _ax - _bx);
  _angle = Math.abs(_radians * 180.0 / Math.PI);
  if (_angle > 180.0) _angle = 360.0 - _angle;
  return _angle;
}

function getBestSide(landmarks: any): 'left' | 'right' {
  const leftVis =
    ((landmarks[11]?.visibility || 0) +
     (landmarks[13]?.visibility || 0) +
     (landmarks[15]?.visibility || 0) +
     (landmarks[23]?.visibility || 0) +
     (landmarks[25]?.visibility || 0) +
     (landmarks[27]?.visibility || 0)) / 6;

  const rightVis =
    ((landmarks[12]?.visibility || 0) +
     (landmarks[14]?.visibility || 0) +
     (landmarks[16]?.visibility || 0) +
     (landmarks[24]?.visibility || 0) +
     (landmarks[26]?.visibility || 0) +
     (landmarks[28]?.visibility || 0)) / 6;

  return leftVis >= rightVis ? 'left' : 'right';
}

export function getJointAngles(landmarks: any): Record<string, number> {
  if (!landmarks) return _angles;

  const side = getBestSide(landmarks);

  const si = side === 'left' ? 11 : 12;
  const ei = side === 'left' ? 13 : 14;
  const wi = side === 'left' ? 15 : 16;
  const hi = side === 'left' ? 23 : 24;
  const ki = side === 'left' ? 25 : 26;
  const ai = side === 'left' ? 27 : 28;

  const shoulder = landmarks[si];
  const hip      = landmarks[hi];
  const ankle    = landmarks[ai];

  const totalVerticalHeight = Math.abs(ankle.y - shoulder.y) || 1;
  const hipDepth = (ankle.y - hip.y) / totalVerticalHeight;
  const shoulderGap = Math.abs(landmarks[11].x - landmarks[12].x);
  const lateralScore = Math.max(0, 1 - shoulderGap * 5);
  const horizontalStretch = Math.abs(ankle.x - shoulder.x);

  _angles.knee              = calculateAngle(landmarks[hi], landmarks[ki], landmarks[ai]);
  _angles.elbow             = calculateAngle(landmarks[si], landmarks[ei], landmarks[wi]);
  _angles.shoulder          = calculateAngle(landmarks[ei], landmarks[si], landmarks[hi]);
  _angles.bodyLine          = calculateAngle(landmarks[si], landmarks[hi], landmarks[ai]);
  _angles.hipDepth          = hipDepth * 100;
  _angles.lateralScore      = lateralScore * 100;
  _angles.horizontalStretch = horizontalStretch * 100;

  return _angles;
}

export function getJointVisibility(landmarks: any): Record<string, number> {
  if (!landmarks) return _visibility;

  _visibility.knee     = Math.max(landmarks[25]?.visibility || 0, landmarks[26]?.visibility || 0);
  _visibility.elbow    = Math.max(landmarks[13]?.visibility || 0, landmarks[14]?.visibility || 0);
  _visibility.shoulder = Math.max(landmarks[11]?.visibility || 0, landmarks[12]?.visibility || 0);
  _visibility.bodyLine =
    (Math.max(landmarks[11]?.visibility || 0, landmarks[12]?.visibility || 0) +
     Math.max(landmarks[23]?.visibility || 0, landmarks[24]?.visibility || 0) +
     Math.max(landmarks[27]?.visibility || 0, landmarks[28]?.visibility || 0)) / 3;
  _visibility.hipDepth =
    (Math.max(landmarks[23]?.visibility || 0, landmarks[24]?.visibility || 0) +
     Math.max(landmarks[27]?.visibility || 0, landmarks[28]?.visibility || 0)) / 2;

  return _visibility;
}

// TODO: Consider adding more comprehensive JSDoc comments
