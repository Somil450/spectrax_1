/**
 * Joint Stress Color Transition Engine.
 *
 * Pure, GPU-mirrorable helpers that drive the smooth color ramp used by the
 * 3D stress-vector overlay.  All easing is `smoothstep`-based so the ramp is
 * C1-continuous — no hard edges, no flicker.  The same curves are computed on
 * the CPU here (for tests / HUD) and expressed in GLSL inside the stress-vector
 * ShaderMaterial (see `sceneBuilders.ts`).
 */

export interface AngleRamp {
  /** Degrees at which stress reaches 0 (relaxed / neutral). */
  high: number;
  /** Degrees at which stress reaches 1 (max strain). */
  low: number;
  /** When true, smaller angles map to *higher* stress (e.g. elbow / knee bend). */
  decreasing: boolean;
}

export type StressColorStops = {
  good: readonly [number, number, number];
  mid: readonly [number, number, number];
  bad: readonly [number, number, number];
};

/** Cyan-green → amber → hot red.  Mirrored by the GLSL stops in sceneBuilders. */
export const STRESS_COLOR_STOPS: StressColorStops = {
  good: [0.05, 1.0, 0.9],
  mid: [1.0, 0.6, 0.1],
  bad: [1.0, 0.15, 0.05],
};

const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v);

/** Hermite / smoothstep easing — the same shape GLSL `smoothstep` produces. */
export function smoothstep(x: number): number {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Maps a joint angle (degrees) onto a 0..1 stress value through a smoothstep
 * window defined by `ramp`.  Because both edges use smoothstep the transition
 * is seamless; threshold crossings never produce a visible step.
 */
export function stressFromAngle(angleDeg: number, ramp: AngleRamp): number {
  const spread = Math.max(ramp.high - ramp.low, 1);
  const t = ramp.decreasing
    ? (ramp.high - angleDeg) / spread
    : (angleDeg - ramp.low) / spread;
  return smoothstep(t);
}

/**
 * Compresses a base angle ramp as motion intensity rises: the window narrows
 * around its midpoint, so a joint under load reaches higher stress colors at
 * less extreme angles.  Returns a new ramp (input is untouched).
 */
export function dynamicThresholds(base: AngleRamp, motionStress: number): AngleRamp {
  const s = clamp(motionStress, 0, 1);
  const spread = Math.max(base.high - base.low, 1);
  const shift = spread * 0.25 * s;
  return {
    high: base.high - shift,
    low: base.low + shift,
    decreasing: base.decreasing,
  };
}

function lerpTuple(a: readonly [number, number, number], b: readonly [number, number, number], t: number): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/**
 * Samples the triple-stop stress ramp (good → mid → bad) with smoothstep easing
 * on each segment, so color changes are continuous with no banding.
 */
export function sampleStressColor(
  stress: number,
  stops: StressColorStops = STRESS_COLOR_STOPS,
): [number, number, number] {
  const t = clamp(stress, 0, 1);
  if (t < 0.5) {
    return lerpTuple(stops.good, stops.mid, smoothstep(t / 0.5));
  }
  return lerpTuple(stops.mid, stops.bad, smoothstep((t - 0.5) / 0.5));
}

/**
 * Exponential (one-pole) smoothing used to filter raw per-frame stress / angle
 * readings.  Returns `target` on the first call (no history) and otherwise
 * eases toward it — the anti-flicker filter for the GPU ramp.
 */
export function exponentialSmooth(prev: number | undefined, target: number, k: number): number {
  if (prev === undefined) return target;
  return prev + (target - prev) * clamp(k, 0, 1);
}

/** Angle between two vectors in degrees (0..180). */
export function angleDegreesBetween(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  const len = Math.sqrt(
    (a.x * a.x + a.y * a.y + a.z * a.z) *
    (b.x * b.x + b.y * b.y + b.z * b.z),
  );
  if (len < 1e-6) return 180;
  const dot = (a.x * b.x + a.y * b.y + a.z * b.z) / len;
  return (Math.acos(clamp(dot, -1, 1)) * 180) / Math.PI;
}
