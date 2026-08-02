import { describe, it, expect } from 'vitest';
import {
  getBodyAnchor,
  getBodyScale,
  getNormalizationMatrix,
  normalizeLandmarks,
  getJointAngles,
  getJointAnglesNormalized,
} from '../angleUtils';

const lm = (x: number, y: number, z: number, visibility = 1) => ({ x, y, z, visibility });

/**
 * Symmetric standing pose. torso length = 0.55, shoulder width = 0.44,
 * hip width = 0.4. Feet at the bottom, shoulders at the top.
 */
function makePose(k = 1, dx = 0, dy = 0): any[] {
  const l: any[] = Array.from({ length: 33 }, () => lm(0, 0, 0, 0));
  l[11] = lm(-0.22 * k + dx, -0.6 * k + dy, 0, 1);
  l[12] = lm(0.22 * k + dx, -0.6 * k + dy, 0, 1);
  l[23] = lm(-0.2 * k + dx, -0.05 * k + dy, 0, 1);
  l[24] = lm(0.2 * k + dx, -0.05 * k + dy, 0, 1);
  l[25] = lm(-0.22 * k + dx, 0.35 * k + dy, 0, 1);
  l[26] = lm(0.22 * k + dx, 0.35 * k + dy, 0, 1);
  l[27] = lm(-0.22 * k + dx, 0.75 * k + dy, 0, 1);
  l[28] = lm(0.22 * k + dx, 0.75 * k + dy, 0, 1);
  l[13] = lm(-0.6 * k + dx, -0.45 * k + dy, 0, 1);
  l[14] = lm(0.6 * k + dx, -0.45 * k + dy, 0, 1);
  l[15] = lm(-0.9 * k + dx, -0.35 * k + dy, 0, 1);
  l[16] = lm(0.9 * k + dx, -0.35 * k + dy, 0, 1);
  return l;
}

describe('getBodyAnchor', () => {
  it('returns the mid-hip anchor', () => {
    const a = getBodyAnchor(makePose());
    expect(a).not.toBeNull();
    expect(a!.x).toBeCloseTo(0, 5);
    expect(a!.y).toBeCloseTo(-0.05, 5);
  });

  it('returns null when hips are missing', () => {
    expect(getBodyAnchor([])).toBeNull();
    expect(getBodyAnchor(null)).toBeNull();
  });
});

describe('getBodyScale', () => {
  it('uses torso length (shoulder-mid → hip-mid)', () => {
    const s = getBodyScale(makePose());
    expect(s).not.toBeNull();
    expect(s!).toBeCloseTo(0.55, 5);
  });

  it('scales linearly with camera distance', () => {
    const near = getBodyScale(makePose(1));
    const far = getBodyScale(makePose(0.5));
    expect(near! / far!).toBeCloseTo(2, 5);
  });
});

describe('getNormalizationMatrix', () => {
  it('applies aspect ratio and camera height to the matrix', () => {
    const m = getNormalizationMatrix(makePose(), { aspectRatio: 1.33, cameraHeight: 0.1 });
    expect(m!.aspectRatio).toBe(1.33);
    expect(m!.anchor.y).toBeCloseTo(-0.15, 5);
  });

  it('defaults aspect ratio to 1 and keeps anchor when no options given', () => {
    const m = getNormalizationMatrix(makePose());
    expect(m!.aspectRatio).toBe(1);
    expect(m!.anchor.y).toBeCloseTo(-0.05, 5);
  });

  it('returns null for a degenerate pose', () => {
    expect(getNormalizationMatrix([])).toBeNull();
  });
});

describe('normalizeLandmarks', () => {
  it('is invariant to camera distance (scale) and pan (offset)', () => {
    const near = normalizeLandmarks(makePose(1))!;
    const far = normalizeLandmarks(makePose(0.5, 0.1, 0.2))!;
    for (const i of [11, 12, 23, 24, 25, 26, 27, 28]) {
      expect(near[i].x).toBeCloseTo(far[i].x, 5);
      expect(near[i].y).toBeCloseTo(far[i].y, 5);
    }
  });

  it('anchors the pelvis at the origin', () => {
    const n = normalizeLandmarks(makePose())!;
    expect(n[23].x).toBeCloseTo(-0.2 / 0.55, 5);
    expect(n[24].x).toBeCloseTo(0.2 / 0.55, 5);
    expect((n[23].y + n[24].y) / 2).toBeCloseTo(0, 5);
  });

  it('applies aspect-ratio correction to x only', () => {
    const base = normalizeLandmarks(makePose())!;
    const ar = normalizeLandmarks(makePose(), { aspectRatio: 1.6 })!;
    const knee = 25;
    expect(ar[knee].x).toBeCloseTo(base[knee].x * 1.6, 5);
    expect(ar[knee].y).toBeCloseTo(base[knee].y, 5);
  });

  it('preserves landmark visibility', () => {
    const pose = makePose();
    pose[27].visibility = 0.4;
    const n = normalizeLandmarks(pose)!;
    expect(n[27].visibility).toBe(0.4);
  });

  it('returns null when normalization is impossible', () => {
    expect(normalizeLandmarks(null)).toBeNull();
    expect(normalizeLandmarks(Array.from({ length: 33 }, () => null))).toBeNull();
  });
});

describe('getJointAnglesNormalized', () => {
  it('produces identical joint angles for near vs far poses', () => {
    const near = getJointAnglesNormalized(makePose(1));
    const far = getJointAnglesNormalized(makePose(0.5));
    for (const key of ['knee', 'elbow', 'shoulder', 'bodyLine']) {
      expect(near[key]).toBeCloseTo(far[key], 5);
    }
  });

  it('keeps derived metrics distance-invariant after normalization', () => {
    const near = getJointAnglesNormalized(makePose(1));
    const far = getJointAnglesNormalized(makePose(0.5));
    expect(near.horizontalStretch).toBeCloseTo(far.horizontalStretch, 5);
    expect(near.hipDepth).toBeCloseTo(far.hipDepth, 5);
  });

  it('matches the raw pipeline when no normalization options are needed', () => {
    const raw = getJointAngles(makePose());
    const norm = getJointAnglesNormalized(makePose());
    expect(norm.knee).toBeCloseTo(raw.knee, 5);
  });

  it('falls back to raw angles for degenerate input', () => {
    expect(getJointAnglesNormalized(null)).toEqual(getJointAngles(null));
  });
});
