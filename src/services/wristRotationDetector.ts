/**
 * wristRotationDetector.ts
 *
 * Detects wrist pronation / supination during bicep curls by analysing
 * the 3-D orientation of the hand plane formed by the wrist, thumb, and
 * pinky landmarks from MediaPipe Pose.
 *
 * MediaPipe coordinate conventions:
 *   x → 0 (left edge) … 1 (right edge)
 *   y → 0 (top edge)  … 1 (bottom edge)   ← y increases downward
 *   z → depth from camera  (closer = more negative)
 *
 * Palm-normal strategy
 * --------------------
 * We form two vectors from the wrist landmark:
 *   A = thumb  − wrist
 *   B = pinky  − wrist
 *
 * The cross product  N = A × B  gives the palm's outward normal.
 *
 * During the "up" phase of a bicep curl the palm should face upward
 * (supinated). In MediaPipe space that means N.y < 0 (y increases downward).
 * We negate so the final score is:
 *   +1  →  fully supinated (palm facing up)
 *    0  →  neutral
 *   -1  →  fully pronated  (palm facing down)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type WristRotationState = 'supinated' | 'neutral' | 'pronated' | 'unknown';

export interface WristRotationResult {
  /** Discrete classification of current wrist orientation */
  state: WristRotationState;
  /**
   * Continuous supination score in [−1, +1].
   * +1 = fully supinated (palm up), −1 = fully pronated (palm down).
   */
  supinationScore: number;
  /** Which arm was selected for the measurement */
  side: 'left' | 'right';
}

// ─── MediaPipe landmark indices ───────────────────────────────────────────────

const LM = {
  leftShoulder:  11,
  rightShoulder: 12,
  leftElbow:     13,
  rightElbow:    14,
  leftWrist:     15,
  rightWrist:    16,
  leftPinky:     17,
  rightPinky:    18,
  leftIndex:     19,
  rightIndex:    20,
  leftThumb:     21,
  rightThumb:    22,
} as const;

// Minimum summed visibility across 5 key landmarks (shoulder + elbow + wrist
// + thumb + pinky) before we trust a side for measurement.
const MIN_TOTAL_VISIBILITY = 2.5;

// Thresholds for discrete state classification
const SUPINATION_THRESHOLD =  0.30;
const PRONATION_THRESHOLD  = -0.30;

// ─── Vector helpers ───────────────────────────────────────────────────────────

type Vec3 = { x: number; y: number; z: number };

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function magnitude(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function normalize(v: Vec3): Vec3 {
  const m = magnitude(v);
  if (m < 1e-9) return { x: 0, y: 0, z: 0 };
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

// ─── Side selection ───────────────────────────────────────────────────────────

/**
 * Chooses the arm with better overall landmark visibility.
 * Returns null if neither arm has sufficient confidence.
 */
function chooseSide(landmarks: any[]): 'left' | 'right' | null {
  const sumVis = (indices: number[]) =>
    indices.reduce((acc, i) => acc + (landmarks[i]?.visibility ?? 0), 0);

  const leftVis  = sumVis([LM.leftShoulder,  LM.leftElbow,  LM.leftWrist,  LM.leftThumb,  LM.leftPinky]);
  const rightVis = sumVis([LM.rightShoulder, LM.rightElbow, LM.rightWrist, LM.rightThumb, LM.rightPinky]);

  if (leftVis < MIN_TOTAL_VISIBILITY && rightVis < MIN_TOTAL_VISIBILITY) return null;
  return leftVis >= rightVis ? 'left' : 'right';
}

// ─── Core computation ─────────────────────────────────────────────────────────

/**
 * Computes a raw palm-normal supination score in [−1, +1] for a single side.
 *
 *   N = (thumb − wrist) × (pinky − wrist)
 *
 * Because MediaPipe's y-axis increases downward, an upward-facing palm
 * produces N.y < 0.  We negate so the score is positive when supinated.
 */
function computeRawScore(wrist: Vec3, thumb: Vec3, pinky: Vec3): number {
  const A      = sub(thumb, wrist);
  const B      = sub(pinky,  wrist);
  const normal = normalize(cross(A, B));

  // Negate y so supinated (palm up) → positive score
  return Math.max(-1, Math.min(1, -normal.y));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyses a full MediaPipe pose landmark array and returns the current
 * wrist rotation state for the dominant (most visible) arm during a bicep curl.
 *
 * @param landmarks  Array of at least 33 MediaPipe NormalizedLandmark objects,
 *                   each having { x, y, z, visibility }.
 * @returns          WristRotationResult, or null if landmarks are insufficient.
 */
export function detectWristRotation(
  landmarks: any[] | null | undefined,
): WristRotationResult | null {
  if (!landmarks || landmarks.length < 33) return null;

  const side = chooseSide(landmarks);
  if (!side) return null;

  const wristIdx = side === 'left' ? LM.leftWrist  : LM.rightWrist;
  const thumbIdx = side === 'left' ? LM.leftThumb  : LM.rightThumb;
  const pinkyIdx = side === 'left' ? LM.leftPinky  : LM.rightPinky;

  const wrist = landmarks[wristIdx];
  const thumb = landmarks[thumbIdx];
  const pinky = landmarks[pinkyIdx];

  if (!wrist || !thumb || !pinky) return null;

  let score = computeRawScore(wrist, thumb, pinky);

  // Mirror the score for the left arm because hand geometry is laterally
  // flipped relative to the right arm.
  if (side === 'left') score = -score;

  let state: WristRotationState;
  if      (score >  SUPINATION_THRESHOLD) state = 'supinated';
  else if (score <  PRONATION_THRESHOLD)  state = 'pronated';
  else                                    state = 'neutral';

  return { state, supinationScore: score, side };
}

/**
 * Convenience: returns only the supination score (or NaN if detection failed).
 * Useful for injecting a single number into the feedback context.
 */
export function getSupinationScore(landmarks: any[] | null | undefined): number {
  const result = detectWristRotation(landmarks);
  return result ? result.supinationScore : NaN;
}
