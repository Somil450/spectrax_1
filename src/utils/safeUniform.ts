/**
 * Sanitizes a numeric value before it is uploaded to a GLSL shader uniform.
 *
 * Pose-landmark-derived values can be NaN/Infinity when tracking is lost or
 * occluded. Uploading those to a WebGL uniform is driver-dependent undefined
 * behaviour (corrupt geometry, GPU warnings, hard context loss). This helper
 * replaces non-finite input with `fallback` and clamps to `[min, max]`.
 */
export function safeUniform(
  value: number,
  min = 0,
  max = 1,
  fallback = 0,
): number {
  if (!Number.isFinite(value)) return fallback;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
