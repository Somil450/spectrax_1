import type { NormalizedLandmark } from '@mediapipe/pose';

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

let _a3x = 0, _a3y = 0, _a3z = 0;
let _b3x = 0, _b3y = 0, _b3z = 0;


export function calculateAngle3D(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  c: { x: number; y: number; z: number }
): number {
  if (!a || !b || !c) return 0;

  _a3x = a.x - b.x;
  _a3y = a.y - b.y;
  _a3z = a.z - b.z;

  _b3x = c.x - b.x;
  _b3y = c.y - b.y;
  _b3z = c.z - b.z;

  const magA = Math.sqrt(_a3x * _a3x + _a3y * _a3y + _a3z * _a3z);
  const magB = Math.sqrt(_b3x * _b3x + _b3y * _b3y + _b3z * _b3z);

  if (magA < 1e-8 || magB < 1e-8) return 0;

  const dot = _a3x * _b3x + _a3y * _b3y + _a3z * _b3z;
  const cosAngle = dot / (magA * magB);
  const clamped = Math.max(-1, Math.min(1, cosAngle));
  return Math.acos(clamped) * (180 / Math.PI);
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
  if (!landmarks) {
    return {
      knee: 0, elbow: 0, shoulder: 0, bodyLine: 0,
      hipDepth: 0, lateralScore: 0, horizontalStretch: 0,
      lungeKnee: 180, backKnee: 180, kneePastToes: 0,
    };
  }

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

  const angles: Record<string, number> = {
    knee:              calculateAngle(landmarks[hi], landmarks[ki], landmarks[ai]),
    elbow:             calculateAngle(landmarks[si], landmarks[ei], landmarks[wi]),
    shoulder:          calculateAngle(landmarks[ei], landmarks[si], landmarks[hi]),
    bodyLine:          calculateAngle(landmarks[si], landmarks[hi], landmarks[ai]),
    hipDepth:          hipDepth * 100,
    lateralScore:      lateralScore * 100,
    horizontalStretch: horizontalStretch * 100,
    lungeKnee: 180,
    backKnee: 180,
    kneePastToes: 0,
  };

  // Lunge fields. Mirrors poseWorker's compute so the main-thread fallback
  // (used until the worker warms up) produces the same shape. Active leg is
  // the more-bent knee; the other leg's angle is reported as backKnee. If
  // any required landmark is missing we keep the safe defaults (lungeKnee
  // and backKnee = 180 so the engine reads "fully extended", not NaN).
  const lH = landmarks[23];
  const lK = landmarks[25];
  const lA = landmarks[27];
  const rH = landmarks[24];
  const rK = landmarks[26];
  const rA = landmarks[28];
  if (lH && lK && lA && rH && rK && rA) {
    const lkAngle = calculateAngle(lH, lK, lA);
    const rkAngle = calculateAngle(rH, rK, rA);
    const leftActive = lkAngle < rkAngle;
    angles.lungeKnee = leftActive ? lkAngle : rkAngle;
    angles.backKnee  = leftActive ? rkAngle : lkAngle;
    const aHip = leftActive ? lH : rH;
    const aKnee = leftActive ? lK : rK;
    const aToe = landmarks[leftActive ? 31 : 32];
    if (aToe) {
      const forwardDir = Math.sign(aToe.x - aHip.x);
      angles.kneePastToes = forwardDir * (aKnee.x - aToe.x) > 0.02 ? 1 : 0;
    }
  }

  return angles;
}

export function getJointVisibility(landmarks: any): Record<string, number> {
  if (!landmarks) {
    return {
      knee: 0, elbow: 0, shoulder: 0, bodyLine: 0, hipDepth: 0,
      lungeKnee: 0, backKnee: 0,
    };
  }

  const visibility: Record<string, number> = {
    knee:     Math.max(landmarks[25]?.visibility || 0, landmarks[26]?.visibility || 0),
    elbow:    Math.max(landmarks[13]?.visibility || 0, landmarks[14]?.visibility || 0),
    shoulder: Math.max(landmarks[11]?.visibility || 0, landmarks[12]?.visibility || 0),
    bodyLine:
      (Math.max(landmarks[11]?.visibility || 0, landmarks[12]?.visibility || 0) +
       Math.max(landmarks[23]?.visibility || 0, landmarks[24]?.visibility || 0) +
       Math.max(landmarks[27]?.visibility || 0, landmarks[28]?.visibility || 0)) / 3,
    hipDepth:
      (Math.max(landmarks[23]?.visibility || 0, landmarks[24]?.visibility || 0) +
       Math.max(landmarks[27]?.visibility || 0, landmarks[28]?.visibility || 0)) / 2,
    lungeKnee: 0,
    backKnee: 0,
  };

  const lH = landmarks[23];
  const lK = landmarks[25];
  const lA = landmarks[27];
  const rH = landmarks[24];
  const rK = landmarks[26];
  const rA = landmarks[28];
  if (lH && lK && lA && rH && rK && rA) {
    const lkAngle = calculateAngle(lH, lK, lA);
    const rkAngle = calculateAngle(rH, rK, rA);
    const leftActive = lkAngle < rkAngle;
    visibility.lungeKnee = leftActive ? (lK.visibility || 0) : (rK.visibility || 0);
    visibility.backKnee  = leftActive ? (rK.visibility || 0) : (lK.visibility || 0);
  }

  return visibility;
}

/**
 * Normalization options that compensate for camera recording conditions so
 * that skeletal angle computations stay consistent regardless of how far the
 * user stands from the webcam, the focal length, the camera height, or the
 * frame's aspect ratio.
 */
export interface NormalizationOptions {
  /** Frame width / height. Corrects the x axis so 1 unit of x equals 1 unit of y. */
  aspectRatio?: number;
  /** Perspective proxy (focal length). Compresses z relative to x/y. Default 1.0. */
  focalScale?: number;
  /** Camera height bias (0..1 in normalized frame units). Removes a fixed y offset. */
  cameraHeight?: number;
}

/**
 * Unified normalization matrix for 2D/3D landmark coordinates:
 *   - anchor: stable body reference (mid-hip / pelvis center)
 *   - scale:  body-reference length (torso length preferred, shoulder width fallback)
 *   - aspectRatio: applied x multiplier so x/y share physical units
 */
export interface NormalizationMatrix {
  anchor: { x: number; y: number; z: number };
  scale: number;
  aspectRatio: number;
}

export function getBodyAnchor(landmarks: any): { x: number; y: number; z: number } | null {
  if (!landmarks || landmarks.length < 29) return null;
  const lh = landmarks[23];
  const rh = landmarks[24];
  if (!lh || !rh) return null;
  return {
    x: (lh.x + rh.x) / 2,
    y: (lh.y + rh.y) / 2,
    z: (lh.z + rh.z) / 2,
  };
}

export function getBodyScale(landmarks: any): number | null {
  if (!landmarks || landmarks.length < 29) return null;
  const ls = landmarks[11];
  const rs = landmarks[12];
  const lh = landmarks[23];
  const rh = landmarks[24];
  if (!ls || !rs || !lh || !rh) return null;

  // Torso length (shoulder-mid → hip-mid) — robust to limb extension/pose.
  const sm = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2, z: (ls.z + rs.z) / 2 };
  const hm = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2, z: (lh.z + rh.z) / 2 };
  const dx = sm.x - hm.x;
  const dy = sm.y - hm.y;
  const dz = sm.z - hm.z;
  const torso = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (torso > 1e-6) return torso;

  // Fallback: shoulder width when torso is degenerate (e.g. lying flat).
  const sx = ls.x - rs.x;
  const sy = ls.y - rs.y;
  const sz = ls.z - rs.z;
  const shoulder = Math.sqrt(sx * sx + sy * sy + sz * sz);
  return shoulder > 1e-6 ? shoulder : null;
}

/**
 * Builds the unified normalization matrix for a frame of pose landmarks.
 * Returns null when the pose has no usable body reference.
 */
export function getNormalizationMatrix(
  landmarks: any,
  options?: NormalizationOptions
): NormalizationMatrix | null {
  const anchor = getBodyAnchor(landmarks);
  const scale = getBodyScale(landmarks);
  if (!anchor || !scale) return null;

  const aspectRatio =
    options && typeof options.aspectRatio === 'number' && options.aspectRatio > 0
      ? options.aspectRatio
      : 1;

  if (options && typeof options.cameraHeight === 'number') {
    anchor.y -= options.cameraHeight;
  }

  return { anchor, scale, aspectRatio };
}

/**
 * Normalizes pose landmarks into a body-relative, scale-invariant coordinate
 * space. Each landmark is translated around the mid-hip anchor and scaled by
 * the torso reference length so poses at any camera distance produce the same
 * normalized skeleton. z is scaled by the same reference (optionally divided
 * by focalScale) so 2D and 3D paths stay consistent. Visibility is preserved.
 */
export function normalizeLandmarks(
  landmarks: any,
  options?: NormalizationOptions
): NormalizedLandmark[] | null {
  if (!landmarks || landmarks.length === 0) return null;
  const matrix = getNormalizationMatrix(landmarks, options);
  if (!matrix) return null;

  const focalScale =
    options && typeof options.focalScale === 'number' && options.focalScale > 0
      ? options.focalScale
      : 1;

  const { anchor, scale, aspectRatio } = matrix;
  const out: NormalizedLandmark[] = new Array(landmarks.length);

  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    if (!lm) {
      out[i] = lm;
      continue;
    }
    const nx = ((lm.x - anchor.x) / scale) * aspectRatio;
    const ny = (lm.y - anchor.y) / scale;
    const nz = typeof lm.z === 'number' ? (lm.z - anchor.z) / (scale / focalScale) : 0;
    out[i] = { x: nx, y: ny, z: nz, visibility: lm.visibility || 0 } as NormalizedLandmark;
  }

  return out;
}

/**
 * Distance/AR-invariant variant of getJointAngles. Runs the full angle +
 * derived-metric pipeline against body-relative normalized landmarks so
 * outputs (hipDepth, lateralScore, horizontalStretch, joint angles) no longer
 * depend on how close the user is to the camera. Falls back to raw landmarks
 * when the pose cannot be normalized.
 */
export function getJointAnglesNormalized(
  landmarks: any,
  options?: NormalizationOptions
): Record<string, number> {
  if (!landmarks) return getJointAngles(landmarks);
  const normalized = normalizeLandmarks(landmarks, options);
  return getJointAngles(normalized || landmarks);
}

// TODO: Consider adding more comprehensive JSDoc comments
