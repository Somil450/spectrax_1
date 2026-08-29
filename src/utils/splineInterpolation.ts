// src/utils/splineInterpolation.ts

export interface SplineLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export type SplineFrame = SplineLandmark[];

/**
 * Standard Catmull-Rom cubic spline value at parameter t (0..1) given four
 * control points p0..p3. Tangents are derived from the neighbouring points, so
 * the resulting path is C¹-smooth across frame boundaries.
 */
export function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

export function catmullRomSmooth(p0: number, p1: number, p2: number, p3: number, t: number): number {
  // Centripetal-style easing on top of the raw Catmull-Rom curve avoids
  // cusps/overshoot when frame spacing is uneven.
  const eased = t * t * (3 - 2 * t);
  return catmullRom(p0, p1, p2, p3, eased);
}

/**
 * Interpolate landmark frames at an arbitrary fractional index.
 * - floatIdx = 2.0  → exact frame 2
 * - floatIdx = 2.5  → Catmull-Rom spline between frames 2 and 3
 * Frames are sampled per coordinate for each landmark index. Endpoints clamp
 * to the first/last frame when out of range.
 */
export function interpolateFrames(frames: SplineFrame[], floatIdx: number): SplineFrame | null {
  const n = frames.length;
  if (n === 0) return null;
  if (floatIdx <= 0) return frames[0];
  if (floatIdx >= n - 1) return frames[n - 1];

  const idx = Math.floor(floatIdx);
  const frac = floatIdx - idx;
  if (frac < 0.001) return frames[idx];

  const i0 = Math.max(0, idx - 1);
  const i1 = idx;
  const i2 = Math.min(n - 1, idx + 1);
  const i3 = Math.min(n - 1, idx + 2);
  const f0 = frames[i0];
  const f1 = frames[i1];
  const f2 = frames[i2];
  const f3 = frames[i3];
  const count = Math.min(f1.length, f2.length);

  const result: SplineLandmark[] = [];
  for (let i = 0; i < count; i++) {
    const lm1 = f1[i];
    const lm2 = f2[i];
    if (!lm1 || !lm2) {
      result.push(lm1 || lm2 || { x: 0, y: 0, z: 0 });
      continue;
    }
    const lm0 = f0[i] || lm1;
    const lm3 = f3[i] || lm2;
    result.push({
      x: catmullRomSmooth(lm0.x, lm1.x, lm2.x, lm3.x, frac),
      y: catmullRomSmooth(lm0.y, lm1.y, lm2.y, lm3.y, frac),
      z: catmullRomSmooth(lm0.z, lm1.z, lm2.z, lm3.z, frac),
      visibility: lm1.visibility ?? lm2.visibility,
    });
  }
  return result;
}
