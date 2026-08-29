import * as THREE from "three";
import {
  buildMotionTrails,
  disposeMotionTrails,
  updateMotionTrails,
  MOTION_TRAIL_JOINTS,
  MOTION_TRAIL_MAX_POINTS,
  MOTION_TRAIL_DURATION_SECONDS,
  TRAIL_JOINT_BONE_KEYS,
} from "./motionTrails";

describe("motionTrails", () => {
  const makeScene = () => new THREE.Scene();

  const makeRigs = (scene: THREE.Scene = makeScene()) => {
    const rigs = buildMotionTrails(scene);
    return { scene, rigs };
  };

  const fakeGetPosition =
    (points: Record<number, [number, number, number]> | null) =>
    (idx: number): THREE.Vector3 | null => {
      if (!points) return null;
      const p = points[idx];
      return p ? new THREE.Vector3(...p) : null;
    };

  it("builds one trail rig per primary joint", () => {
    const { rigs } = makeRigs();
    expect(rigs).toHaveLength(MOTION_TRAIL_JOINTS.length);
    rigs.forEach((rig, i) => {
      expect(rig.jointIdx).toBe(MOTION_TRAIL_JOINTS[i].idx);
      expect(rig.maxPoints).toBe(MOTION_TRAIL_MAX_POINTS);
      expect(rig.duration).toBe(MOTION_TRAIL_DURATION_SECONDS);
      expect(rig.line.visible).toBe(false);
      expect(rig.positions).toHaveLength(MOTION_TRAIL_MAX_POINTS * 3);
    });
  });

  it("adds every trail line to the provided scene", () => {
    const { scene, rigs } = makeRigs();
    rigs.forEach((rig) => expect(rig.line.parent).toBe(scene));
  });

  it("records a point when a joint position is available", () => {
    const { rigs } = makeRigs();
    const getPosition = fakeGetPosition({ 15: [0.2, 0.4, 0] });
    updateMotionTrails(rigs, getPosition, 0);
    const rig = rigs.find((r) => r.jointIdx === 15)!;
    expect(rig.count).toBe(1);
    const posAttr = rig.geometry.getAttribute("position") as THREE.BufferAttribute;
    expect(posAttr.array[0]).toBeCloseTo(0.2);
    expect(posAttr.array[1]).toBeCloseTo(0.4);
  });

  it("appends distinct points over time", () => {
    const { rigs } = makeRigs();
    const rig = rigs.find((r) => r.jointIdx === 16)!;
    const points: Record<number, [number, number, number]> = { 16: [0, 0, 0] };
    const getPosition = fakeGetPosition(points);
    for (let t = 0; t < 2; t += 0.1) {
      points[16] = [t, t * 2, t * 3];
      updateMotionTrails(rigs, getPosition, t);
    }
    expect(rig.count).toBe(20);
  });

  it("caps the buffer at MOTION_TRAIL_MAX_POINTS", () => {
    const { rigs } = makeRigs();
    const rig = rigs.find((r) => r.jointIdx === 15)!;
    const points: Record<number, [number, number, number]> = { 15: [0, 0, 0] };
    const getPosition = fakeGetPosition(points);
    for (let t = 0; t < 100; t += 0.01) {
      points[15] = [Math.sin(t), Math.cos(t), t];
      updateMotionTrails(rigs, getPosition, t);
    }
    expect(rig.count).toBe(MOTION_TRAIL_MAX_POINTS);
  });

  it("fades the newest vertex toward alpha 1 and the oldest toward 0", () => {
    const { rigs } = makeRigs();
    const rig = rigs.find((r) => r.jointIdx === 15)!;
    const points: Record<number, [number, number, number]> = { 15: [0, 0, 0] };
    const getPosition = fakeGetPosition(points);
    for (let t = 0; t <= 2.5; t += 0.5) {
      points[15] = [t, 0, 0];
      updateMotionTrails(rigs, getPosition, t);
    }
    const alphaAttr = rig.geometry.getAttribute("aAlpha") as THREE.BufferAttribute;
    const alphas = alphaAttr.array as Float32Array;
    expect(alphas[rig.count - 1]).toBeGreaterThan(0.9);
    expect(alphas[0]).toBeLessThan(0.1);
  });

  it("skips recording when no joint position is available", () => {
    const { rigs } = makeRigs();
    updateMotionTrails(rigs, fakeGetPosition(null), 0);
    rigs.forEach((rig) => expect(rig.count).toBe(0));
  });

  it("hides lines when trails are disabled", () => {
    const { rigs } = makeRigs();
    const getPosition = fakeGetPosition({ 25: [0, 0, 0] });
    updateMotionTrails(rigs, getPosition, 0, false);
    rigs.forEach((rig) => expect(rig.line.visible).toBe(false));
  });

  it("dispose removes trail lines from the scene", () => {
    const { rigs } = makeRigs();
    disposeMotionTrails(rigs);
    rigs.forEach((rig) => expect(rig.line.parent).toBeNull());
  });

  it("maps every tracked joint to a bone key", () => {
    MOTION_TRAIL_JOINTS.forEach(({ idx }) => {
      expect(TRAIL_JOINT_BONE_KEYS[idx]).toBeTruthy();
    });
  });
});
