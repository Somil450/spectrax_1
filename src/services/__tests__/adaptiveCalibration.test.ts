import { describe, it, expect, beforeEach } from 'vitest';
import { computeAdaptiveFactor, bodyTypeEngine, BodyTypeResult } from '../bodyTypeEngine';
import { calibrationLogic } from '../calibrationLogic';
import type { Results } from '@mediapipe/pose';

const lm = (x: number, y: number, z = 0, visibility = 1) => ({ x, y, z, visibility });

function makeSkeleton(opts?: {
  femurY?: number;
  ankleY?: number;
  shoulderX?: number;
  visibility?: number;
}): any[] {
  const s = { femurY: 0.35, ankleY: 0.75, shoulderX: 0.22, visibility: 1, ...opts };
  const l: any[] = Array.from({ length: 33 }, () => lm(0, 0, 0, 0));
  l[11] = lm(-s.shoulderX, -0.6, 0, s.visibility);
  l[12] = lm(s.shoulderX, -0.6, 0, s.visibility);
  l[23] = lm(-0.2, -0.05, 0, s.visibility);
  l[24] = lm(0.2, -0.05, 0, s.visibility);
  l[25] = lm(-0.22, s.femurY, 0, s.visibility);
  l[26] = lm(0.22, s.femurY, 0, s.visibility);
  l[27] = lm(-0.22, s.ankleY, 0, s.visibility);
  l[28] = lm(0.22, s.ankleY, 0, s.visibility);
  l[13] = lm(-0.6, -0.45, 0, s.visibility);
  l[14] = lm(0.6, -0.45, 0, s.visibility);
  l[15] = lm(-0.9, -0.35, 0, s.visibility);
  l[16] = lm(0.9, -0.35, 0, s.visibility);
  return l;
}

const toResults = (landmarks: any[]): Results =>
  ({
    poseLandmarks: landmarks,
    poseWorldLandmarks: [],
    segmentation: null,
    image: null,
    numPoses: 1,
  } as unknown as Results);

describe('computeAdaptiveFactor', () => {
  it('is neutral at the reference ratio', () => {
    expect(computeAdaptiveFactor(1.6)).toBe(1.0);
  });

  it('tightens thresholds for longer femurs (factor > 1)', () => {
    const f = computeAdaptiveFactor(0.6875);
    expect(f).toBeGreaterThan(1);
    expect(f).toBe(1.1);
  });

  it('relaxes thresholds for shorter femurs (factor < 1)', () => {
    const f = computeAdaptiveFactor(2.115);
    expect(f).toBeLessThan(1);
    expect(f).toBe(0.9);
  });

  it('stays within the ±10% margin', () => {
    expect(computeAdaptiveFactor(0.1)).toBe(1.1);
    expect(computeAdaptiveFactor(10)).toBe(0.9);
  });

  it('is neutral for non-finite or non-positive ratios', () => {
    expect(computeAdaptiveFactor(NaN)).toBe(1.0);
    expect(computeAdaptiveFactor(0)).toBe(1.0);
    expect(computeAdaptiveFactor(-3)).toBe(1.0);
    expect(computeAdaptiveFactor(Infinity)).toBe(1.0);
  });
});

describe('BodyTypeEngine.computeBoneRatios', () => {
  beforeEach(() => bodyTypeEngine.reset());

  it('computes torsoToFemur from a single frame', () => {
    const m = bodyTypeEngine.computeBoneRatios(makeSkeleton());
    expect(m).not.toBeNull();
    expect(m!.ratios.torsoToFemur).toBeCloseTo(0.55 / 0.4, 2);
  });

  it('returns null when a key joint is not visible', () => {
    expect(bodyTypeEngine.computeBoneRatios(makeSkeleton({ visibility: 0.2 }))).toBeNull();
  });

  it('does not push into the classify history', () => {
    for (let i = 0; i < 20; i++) bodyTypeEngine.computeBoneRatios(makeSkeleton());
    const r = bodyTypeEngine.analyze(makeSkeleton());
    expect(r.bodyType).toBe('scanning');
  });
});

describe('BodyTypeEngine.analyze adaptive factor', () => {
  beforeEach(() => bodyTypeEngine.reset());

  it('tightens thresholds for a long-limbed frame after 15 frames', () => {
    let r: BodyTypeResult | null = null;
    for (let i = 0; i < 15; i++) r = bodyTypeEngine.analyze(makeSkeleton());
    expect(r!.bodyType).toBe('ecto');
    expect(r!.adaptiveFactor).toBeCloseTo(1.1, 5);
    expect(r!.metrics!.ratios.torsoToFemur).toBeCloseTo(0.55 / 0.4, 2);
  });

  it('relaxes thresholds for a compact frame after 15 frames', () => {
    let r: BodyTypeResult | null = null;
    for (let i = 0; i < 15; i++) r = bodyTypeEngine.analyze(makeSkeleton({ femurY: 0.08 }));
    expect(r!.adaptiveFactor).toBeCloseTo(0.9, 5);
  });
});

describe('CalibrationLogic.evaluate adaptive factor', () => {
  const skeleton = makeSkeleton();

  it('derives the factor from torsoToFemur during calibration', () => {
    const res = calibrationLogic.evaluate(toResults(skeleton), 1.0, 0.6875);
    expect(res.adaptiveFactor).toBe(1.1);
    expect(res.torsoToFemur).toBe(0.6875);
  });

  it('ratio-derived factor overrides the passed factor', () => {
    const res = calibrationLogic.evaluate(toResults(skeleton), 0.95, 2.115);
    expect(res.adaptiveFactor).toBe(0.9);
  });

  it('falls back to the given factor when no ratio is supplied', () => {
    const res = calibrationLogic.evaluate(toResults(skeleton), 1.05);
    expect(res.adaptiveFactor).toBe(1.05);
  });
});
