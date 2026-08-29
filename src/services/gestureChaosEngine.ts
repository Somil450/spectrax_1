/**
 * gestureChaosEngine.ts
 *
 * Chaos-injection framework for the gesture classifier (issue #961).
 *
 * Real-world camera feeds contain partial gestures, overlapping actors,
 * transition poses, occlusion and sensor noise. This module lets tests
 * systematically inject that confusion into synthetic landmark frames so
 * the classifier can be validated for robustness instead of just happy-path
 * classification.
 *
 * All injections are pure: they return a NEW landmark array and never
 * mutate the input, so tests can build complex scenarios deterministically.
 */

import type { GestureCommand } from "./gestureService";

// MediaPipe landmark indices the classifier inspects.
export const CHAOS_IDX = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
} as const;

/** Joint names the engine knows how to move. */
export type ChaosJoint =
  | "leftShoulder"
  | "rightShoulder"
  | "leftElbow"
  | "rightElbow"
  | "leftWrist"
  | "rightWrist"
  | "leftPinky"
  | "rightPinky"
  | "leftIndex"
  | "rightIndex"
  | "leftThumb"
  | "rightThumb"
  | "leftHip"
  | "rightHip";

type Landmark = { x: number; y: number; z?: number; visibility: number };
export type Landmarks = Landmark[];

/** Deterministic seeded PRNG (mulberry32) so chaos tests are reproducible. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller Gaussian noise generator driven by a seeded PRNG. */
export function gaussianNoise(rng: () => number, sigma = 1): number {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const JOINT_TO_INDEX: Record<ChaosJoint, number> = {
  leftShoulder: CHAOS_IDX.LEFT_SHOULDER,
  rightShoulder: CHAOS_IDX.RIGHT_SHOULDER,
  leftElbow: CHAOS_IDX.LEFT_ELBOW,
  rightElbow: CHAOS_IDX.RIGHT_ELBOW,
  leftWrist: CHAOS_IDX.LEFT_WRIST,
  rightWrist: CHAOS_IDX.RIGHT_WRIST,
  leftPinky: CHAOS_IDX.LEFT_PINKY,
  rightPinky: CHAOS_IDX.RIGHT_PINKY,
  leftIndex: CHAOS_IDX.LEFT_INDEX,
  rightIndex: CHAOS_IDX.RIGHT_INDEX,
  leftThumb: CHAOS_IDX.LEFT_THUMB,
  rightThumb: CHAOS_IDX.RIGHT_THUMB,
  leftHip: CHAOS_IDX.LEFT_HIP,
  rightHip: CHAOS_IDX.RIGHT_HIP,
};

/**
 * A named joint-pose configuration. Positions are normalised coordinates
 * where lower `y` is higher in frame.
 */
export interface JointPose {
  joint: ChaosJoint;
  x: number;
  y: number;
  visibility: number;
}

/** Build a full 33-landmark frame with every inspected joint visible. */
export function buildLandmarks(poses: JointPose[]): Landmarks {
  const lm: Landmarks = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0,
  }));
  for (const pose of poses) {
    const idx = JOINT_TO_INDEX[pose.joint];
    lm[idx] = { x: pose.x, y: pose.y, z: 0, visibility: pose.visibility };
  }
  return lm;
}

/** Default neutral pose — arms relaxed at the sides, all joints visible. */
export function neutralPose(): JointPose[] {
  return [
    { joint: "leftShoulder", x: 0.4, y: 0.4, visibility: 0.9 },
    { joint: "rightShoulder", x: 0.6, y: 0.4, visibility: 0.9 },
    { joint: "leftElbow", x: 0.38, y: 0.55, visibility: 0.9 },
    { joint: "rightElbow", x: 0.62, y: 0.55, visibility: 0.9 },
    { joint: "leftWrist", x: 0.4, y: 0.6, visibility: 0.9 },
    { joint: "rightWrist", x: 0.6, y: 0.6, visibility: 0.9 },
    { joint: "leftHip", x: 0.4, y: 0.75, visibility: 0.9 },
    { joint: "rightHip", x: 0.6, y: 0.75, visibility: 0.9 },
  ];
}

/** Both wrists raised above the shoulders — the START gesture. */
export function startPose(): JointPose[] {
  return [
    ...neutralPose(),
    { joint: "leftWrist", x: 0.35, y: 0.2, visibility: 0.9 },
    { joint: "rightWrist", x: 0.65, y: 0.2, visibility: 0.9 },
  ];
}

/** Exactly one wrist raised — the PAUSE gesture. */
export function pausePose(): JointPose[] {
  return [
    ...neutralPose(),
    { joint: "leftWrist", x: 0.35, y: 0.2, visibility: 0.9 },
    { joint: "rightWrist", x: 0.6, y: 0.6, visibility: 0.9 },
  ];
}

/** Wrists crossed at chest level — the STOP gesture. */
export function stopPose(): JointPose[] {
  return [
    ...neutralPose(),
    { joint: "leftWrist", x: 0.51, y: 0.55, visibility: 0.9 },
    { joint: "rightWrist", x: 0.49, y: 0.55, visibility: 0.9 },
  ];
}

/** Thumbs-up with the left hand — a START alias. */
export function thumbsUpPose(): JointPose[] {
  return [
    ...neutralPose(),
    { joint: "leftWrist", x: 0.4, y: 0.55, visibility: 0.9 },
    { joint: "leftIndex", x: 0.4, y: 0.48, visibility: 0.9 },
    { joint: "leftPinky", x: 0.4, y: 0.5, visibility: 0.9 },
    { joint: "leftThumb", x: 0.4, y: 0.38, visibility: 0.9 },
  ];
}

export const CHAOS_POSES: Record<GestureCommand | "NEUTRAL", JointPose[]> = {
  START: startPose(),
  PAUSE: pausePose(),
  STOP: stopPose(),
  NEUTRAL: neutralPose(),
};

/** Linear interpolation between two landmark frames (per-inspected-joint). */
export function lerpLandmarks(a: Landmarks, b: Landmarks, t: number): Landmarks {
  const out: Landmarks = [];
  for (let i = 0; i < 33; i++) {
    const pa = a[i];
    const pb = b[i];
    if (!pa || !pb) {
      out.push(pa ?? pb ?? { x: 0.5, y: 0.5, z: 0, visibility: 0 });
      continue;
    }
    out.push({
      x: pa.x + (pb.x - pa.x) * t,
      y: pa.y + (pb.y - pa.y) * t,
      z: (pa.z ?? 0) + ((pb.z ?? 0) - (pa.z ?? 0)) * t,
      visibility: pa.visibility + (pb.visibility - pa.visibility) * t,
    });
  }
  return out;
}

/**
 * Partial gesture: interpolate `completeness` (0.0–1.0) of the way from
 * neutral to the full gesture. Mimics a gesture that is only partially
 * formed (one hand still moving, gesture started mid-frame, etc.).
 */
export function injectPartialGesture(
  gestureType: GestureCommand,
  completeness: number,
): Landmarks {
  const target = CHAOS_POSES[gestureType];
  const from = CHAOS_POSES.NEUTRAL;
  const neutral = buildLandmarks(from);
  const full = buildLandmarks(target);
  return lerpLandmarks(neutral, full, Math.min(Math.max(completeness, 0), 1));
}

/**
 * Multi-gesture overlap: blend two complete gesture poses with a given
 * overlap ratio. Simulates two actors in frame or a single confused pose
 * (e.g. left hand completing STOP while right hand still raises for START).
 */
export function injectMultiGesture(
  gestureA: GestureCommand,
  gestureB: GestureCommand,
  overlapRatio: number,
): Landmarks {
  const a = buildLandmarks(CHAOS_POSES[gestureA]);
  const b = buildLandmarks(CHAOS_POSES[gestureB]);
  return lerpLandmarks(a, b, Math.min(Math.max(overlapRatio, 0), 1));
}

/**
 * Transition gesture: interpolate from one gesture pose to another across
 * `progress` (0.0–1.0). Mimics a hand moving between poses frame by frame.
 */
export function injectTransitionGesture(
  fromGesture: GestureCommand,
  toGesture: GestureCommand,
  progress: number,
): Landmarks {
  const from = buildLandmarks(CHAOS_POSES[fromGesture]);
  const to = buildLandmarks(CHAOS_POSES[toGesture]);
  return lerpLandmarks(from, to, Math.min(Math.max(progress, 0), 1));
}

/**
 * Occlusion: zero-out visibility for every landmark flagged in the mask.
 * `occlusionMask` is an array of 33 booleans indexed by landmark index.
 * Returns a copy; the input mask is treated as read-only.
 */
export function injectOcclusion(
  landmarks: Landmarks,
  occlusionMask: boolean[],
): Landmarks {
  return landmarks.map((lm, i) =>
    occlusionMask[i] ? { ...lm, visibility: 0 } : { ...lm },
  );
}

/** Random occlusion mask where `fraction` of the inspected joints are hidden. */
export function randomOcclusionMask(
  rng: () => number,
  fraction: number,
): boolean[] {
  const mask = Array.from({ length: 33 }, () => false);
  for (const idx of Object.values(CHAOS_IDX)) {
    mask[idx] = rng() < fraction;
  }
  return mask;
}

/** Occlusion mask hiding a random `fraction` of the hand landmarks (15–22). */
export function randomHandOcclusionMask(
  rng: () => number,
  fraction: number,
): boolean[] {
  const mask = Array.from({ length: 33 }, () => false);
  const handJoints = [15, 16, 17, 18, 19, 20, 21, 22];
  for (const idx of handJoints) mask[idx] = rng() < fraction;
  return mask;
}

/** Occlusion mask hiding every hand landmark (both hands). */
export function fullHandOcclusionMask(): boolean[] {
  const mask = Array.from({ length: 33 }, () => false);
  for (let i = 15; i <= 22; i++) mask[i] = true;
  return mask;
}

/**
 * Sensor noise: add Gaussian noise to the x/y of every inspected joint.
 * Returns a copy; `sigma` is in normalised-coordinate units.
 */
export function injectNoise(
  landmarks: Landmarks,
  sigma: number,
  rng: () => number = seededRandom(42),
): Landmarks {
  return landmarks.map((lm, i) => {
    if (!CHAOS_IDX_TO_LIST.includes(i)) return { ...lm };
    return {
      ...lm,
      x: lm.x + gaussianNoise(rng, sigma),
      y: lm.y + gaussianNoise(rng, sigma),
    };
  });
}

const CHAOS_IDX_TO_LIST: number[] = Object.values(CHAOS_IDX);
