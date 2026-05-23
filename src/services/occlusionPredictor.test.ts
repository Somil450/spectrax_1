import { OcclusionPredictor, Landmark } from "./occlusionPredictor";

function makeLandmark(x: number, y: number, z: number, visibility: number): Landmark {
  return { x, y, z, visibility };
}

function fullBody(overrides?: Partial<Record<number, Partial<Landmark>>>): Landmark[] {
  const defaultLm = (i: number): Landmark => {
    const isLeft = [11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31].includes(i);
    const side = isLeft ? -0.1 : 0.1;
    return makeLandmark(
      0.5 + side,
      0.5 - i * 0.02,
      0,
      0.95,
    );
  };
  const lms: Landmark[] = [];
  for (let i = 0; i < 33; i++) {
    const override = overrides?.[i];
    lms.push(override ? { ...defaultLm(i), ...override } : defaultLm(i));
  }
  return lms;
}

describe("OcclusionPredictor", () => {
  let predictor: OcclusionPredictor;

  beforeEach(() => {
    predictor = new OcclusionPredictor();
  });

  it("returns unchanged landmarks when all visible", () => {
    const lms = fullBody();
    const result = predictor.predict(lms);

    for (let i = 0; i < 33; i++) {
      expect(result.wasOccluded[i]).toBe(false);
      expect(result.landmarks[i].x).toBe(lms[i].x);
      expect(result.landmarks[i].y).toBe(lms[i].y);
    }
  });

  it("mirror-predicts left elbow when occluded", () => {
    const lms = fullBody();

    // Occlude left elbow (index 13)
    lms[13] = makeLandmark(0.4, 0.45, 0, 0.1);

    const result = predictor.predict(lms);

    // Left elbow should be predicted via mirror from right elbow (index 14)
    expect(result.wasOccluded[13]).toBe(true);
    expect(result.landmarks[13].visibility).toBeGreaterThanOrEqual(0.5);
    // Mirror: midline ~0.5, right elbow x ~0.52 → predicted left elbow should be ~0.48
    const midlineX = 0.5;
    const mirrorX = 2 * midlineX - lms[14].x;
    expect(result.landmarks[13].x).toBeCloseTo(mirrorX, 1);
  });

  it("mirror-predicts right knee when occluded", () => {
    const lms = fullBody();

    // Occlude right knee (index 26)
    lms[26] = makeLandmark(0.6, 0.5, 0, 0.05);

    const result = predictor.predict(lms);

    expect(result.wasOccluded[26]).toBe(true);
    expect(result.landmarks[26].visibility).toBeGreaterThanOrEqual(0.5);

    const midlineX = 0.5;
    const mirrorX = 2 * midlineX - lms[25].x;
    expect(result.landmarks[26].x).toBeCloseTo(mirrorX, 1);
  });

  it("uses temporal prediction after history builds up", () => {
    const lms = fullBody();
    const movingLm = { ...lms[13] };

    // Feed frames where left elbow is moving rightward
    for (let frame = 0; frame < 5; frame++) {
      movingLm.x = 0.35 + frame * 0.02;
      lms[13] = { ...movingLm, visibility: 0.95 };
      predictor.predict(lms);
    }

    // Now occlude it
    lms[13] = makeLandmark(0.4, 0.45, 0, 0.05);
    const result = predictor.predict(lms);

    expect(result.wasOccluded[13]).toBe(true);

    // x should be closer to temporal extrapolation (0.35 + 5*0.02 + 0.02 = 0.47) than raw (0.4)
    const temporalX = 0.47;
    expect(Math.abs(result.landmarks[13].x - temporalX)).toBeLessThanOrEqual(
      Math.abs(0.4 - temporalX),
    );
  });

  it("calibrates bone lengths over multiple frames", () => {
    const lms = fullBody();

    // Feed 30+ frames of high-visibility data
    for (let frame = 0; frame < 35; frame++) {
      predictor.predict(lms);
    }

    // Occlude left elbow
    lms[13] = makeLandmark(0.4, 0.45, 0, 0.05);
    const before = { ...lms[13] };
    const result = predictor.predict(lms);

    // Predicted position should differ from raw occluded position
    const dx = Math.abs(result.landmarks[13].x - before.x);
    const dy = Math.abs(result.landmarks[13].y - before.y);
    expect(dx + dy).toBeGreaterThan(0.001);
  });

  it("returns confidence 1 for visible joints", () => {
    const lms = fullBody();
    const result = predictor.predict(lms);

    for (let i = 0; i < 33; i++) {
      expect(result.confidence[i]).toBe(1);
    }
  });

  it("returns lower confidence for occluded joints", () => {
    const lms = fullBody();
    lms[15] = makeLandmark(0.3, 0.5, 0, 0.05); // left wrist occluded
    lms[16] = makeLandmark(0.7, 0.5, 0, 0.95); // right wrist visible → mirror possible

    const result = predictor.predict(lms);
    expect(result.wasOccluded[15]).toBe(true);
    expect(result.confidence[15]).toBeLessThan(1);
  });

  it("resets state correctly", () => {
    const lms = fullBody();
    lms[13] = makeLandmark(0.4, 0.45, 0, 0.05);

    predictor.predict(lms);
    predictor.reset();

    // After reset, prediction still works (doesn't crash)
    const result = predictor.predict(lms);
    expect(result.wasOccluded[13]).toBe(true);
  });

  it("handles all joints occluded gracefully (no crash)", () => {
    const lms = fullBody();
    for (let i = 0; i < 33; i++) {
      lms[i] = makeLandmark(0.5, 0.5, 0, 0.01);
    }

    const result = predictor.predict(lms);
    // Should not crash — all were occluded, some may still get temporal if history
    expect(result.landmarks.length).toBe(33);
  });

  it("bone lengths remain consistent after calibration", () => {
    const lms = fullBody();
    const dist = (a: Landmark, b: Landmark) =>
      Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

    // Record initial bone lengths
    const initialLeftUpperArm = dist(lms[11], lms[13]);
    const initialRightUpperArm = dist(lms[12], lms[14]);

    // Feed 30+ calibration frames
    for (let frame = 0; frame < 35; frame++) {
      predictor.predict(lms);
    }

    // Occlude left shoulder and elbow
    lms[11] = makeLandmark(0.4, 0.3, 0, 0.05);
    lms[13] = makeLandmark(0.4, 0.45, 0, 0.05);

    const result = predictor.predict(lms);

    const postLeftUpperArm = dist(result.landmarks[11], result.landmarks[13]);
    const postRightUpperArm = dist(result.landmarks[12], result.landmarks[14]);

    // Mirrored left side should roughly match right side bone length
    const ratio = postLeftUpperArm / postRightUpperArm;
    expect(ratio).toBeGreaterThan(0.5);
    expect(ratio).toBeLessThan(2);
  });
});
