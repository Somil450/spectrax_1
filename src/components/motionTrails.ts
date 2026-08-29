/**
 * motionTrails.ts
 *
 * Neon motion trails for the 3D replay viewport.  For each primary joint
 * (wrists and knees) a `THREE.Line` is drawn through the joint's recent world
 * positions.  Each vertex carries an `aAlpha` attribute that fades with age so
 * the trail dissolves over ~2 seconds.
 *
 * The rigs are pure Three.js objects — this module owns no React state.  The
 * render loop in Replay3DModel calls `updateMotionTrails` once per frame with a
 * position callback so trails stay in sync with whichever skeleton is visible
 * (skinned model bones or the fallback landmark skeleton).
 */

import * as THREE from "three";

// ─── Constants ────────────────────────────────────────────────────────────────

/** How long a trail point stays visible before fading out completely (s). */
export const MOTION_TRAIL_DURATION_SECONDS = 2;

/** Maximum number of recent positions kept per joint. */
export const MOTION_TRAIL_MAX_POINTS = 128;

/** Minimum wall-clock gap between trail samples (seconds). */
const MOTION_TRAIL_SAMPLE_INTERVAL_SECONDS = 1 / 30;

/**
 * Primary joints tracked by the trail system.  Wrists and knees are the most
 * dynamic joints during exercise and produce the clearest motion paths.
 * Left-side joints render in neon cyan, right-side in neon purple.
 */
export const MOTION_TRAIL_JOINTS: ReadonlyArray<{
  idx: number;
  boneKey: string;
  color: THREE.ColorRepresentation;
}> = [
  { idx: 15, boneKey: "leftWrist",  color: 0x00ffff },
  { idx: 16, boneKey: "rightWrist", color: 0x9d4edd },
  { idx: 25, boneKey: "leftKnee",   color: 0x00ffff },
  { idx: 26, boneKey: "rightKnee",  color: 0x9d4edd },
] as const;

/** Maps landmark index → GLTF bone key for skinned-model mode. */
export const TRAIL_JOINT_BONE_KEYS: Record<number, string> = {
  15: "leftWrist",
  16: "rightWrist",
  25: "leftKnee",
  26: "rightKnee",
};

// ─── Types ────────────────────────────────────────────────────────────────────

/** One animated trail line attached to a primary joint. */
export interface MotionTrailRig {
  line: THREE.Line;
  material: THREE.ShaderMaterial;
  geometry: THREE.BufferGeometry;
  jointIdx: number;
  boneKey: string;
  color: THREE.ColorRepresentation;
  /** Ring-free shift buffer of recent world positions (maxPoints * 3 floats). */
  positions: Float32Array;
  /** When each buffered position was recorded (seconds, monotonic). */
  ages: Float32Array;
  /** Number of live points currently buffered. */
  count: number;
  maxPoints: number;
  duration: number;
  lastPushTime: number;
}

// ─── Internal: trail shader ───────────────────────────────────────────────────

function createTrailMaterial(color: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
    },
    vertexShader: /* glsl */ `
      attribute float aAlpha;
      varying float vAlpha;
      void main() {
        vAlpha = aAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        gl_FragColor = vec4(uColor, vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// ─── Builders ─────────────────────────────────────────────────────────────────

/**
 * Creates the trail rigs (line + geometry + material) for every primary joint
 * and adds them to the scene.  Lines start hidden so a disabled feature or a
 * fresh replay does not flash stray geometry.
 *
 * @returns One `MotionTrailRig` per entry in MOTION_TRAIL_JOINTS.
 */
export function buildMotionTrails(scene: THREE.Scene): MotionTrailRig[] {
  return MOTION_TRAIL_JOINTS.map(({ idx, boneKey, color }) => {
    const maxPoints = MOTION_TRAIL_MAX_POINTS;
    const positions = new Float32Array(maxPoints * 3);
    const ages      = new Float32Array(maxPoints);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aAlpha",   new THREE.BufferAttribute(new Float32Array(maxPoints), 1));
    geometry.setDrawRange(0, 0);

    const material = createTrailMaterial(color);
    const line     = new THREE.Line(geometry, material);
    line.visible   = false;
    line.frustumCulled = false;
    line.renderOrder   = 6;
    line.userData.isOverlay = true;
    scene.add(line);

    return { line, material, geometry, jointIdx: idx, color, boneKey, positions, ages, count: 0, maxPoints, duration: MOTION_TRAIL_DURATION_SECONDS, lastPushTime: -Infinity };
  });
}

/**
 * Disposes every trail rig and removes its line from the scene.  Safe to call
 * multiple times or with an empty array.
 */
export function disposeMotionTrails(rigs: MotionTrailRig[]): void {
  for (const rig of rigs) {
    rig.geometry.dispose();
    rig.material.dispose();
    rig.line.parent?.remove(rig.line);
  }
}

// ─── Update logic ─────────────────────────────────────────────────────────────

/**
 * Advances every trail by one rendered frame.
 *
 * - Pushes the joint's current world position (sampled at most 30×/s) onto the
 *   front of the shift buffer, dropping the oldest point when full.
 * - Recomputes each vertex's alpha from its age so the trail fades out over
 *   `duration` seconds even while the skeleton is idle.
 * - Toggles line visibility based on `enabled`.
 *
 * @param getPosition Returns the joint's current world position, or null when
 *   the landmark/bone is not available this frame (the point is then skipped).
 */
export function updateMotionTrails(
  rigs: MotionTrailRig[],
  getPosition: (jointIdx: number) => THREE.Vector3 | null,
  timeSeconds: number,
  enabled: boolean = true,
): void {
  for (const rig of rigs) {
    rig.line.visible = enabled;

    const pos = getPosition(rig.jointIdx);
    if (pos && enabled && timeSeconds - rig.lastPushTime >= MOTION_TRAIL_SAMPLE_INTERVAL_SECONDS) {
      rig.lastPushTime = timeSeconds;

      if (rig.count < rig.maxPoints) {
        // Buffer not yet full: append at the end.
        const i = rig.count;
        rig.positions[i * 3]     = pos.x;
        rig.positions[i * 3 + 1] = pos.y;
        rig.positions[i * 3 + 2] = pos.z;
        rig.ages[i]              = timeSeconds;
        rig.count += 1;
      } else {
        // Buffer full: drop the oldest point, then write the newest.
        rig.positions.copyWithin(0, 3);
        rig.ages.copyWithin(0, 1);
        const i = rig.maxPoints - 1;
        rig.positions[i * 3]     = pos.x;
        rig.positions[i * 3 + 1] = pos.y;
        rig.positions[i * 3 + 2] = pos.z;
        rig.ages[i]              = timeSeconds;
      }
    }

    // Per-vertex alpha from age: newest = 1, oldest (> duration) = 0.
    const alphaAttr = rig.geometry.getAttribute("aAlpha") as THREE.BufferAttribute;
    const alphaData = alphaAttr.array as Float32Array;
    for (let i = 0; i < rig.count; i++) {
      const age = timeSeconds - rig.ages[i];
      const t = THREE.MathUtils.clamp(age / rig.duration, 0, 1);
      // Ease the tail out so the trail dissolves instead of snapping.
      alphaData[i] = (1 - t) * (1 - t);
    }
    alphaAttr.needsUpdate = true;
    (rig.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    rig.geometry.setDrawRange(0, rig.count);
  }
}
