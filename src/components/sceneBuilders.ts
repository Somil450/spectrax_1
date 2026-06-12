/**
 * sceneBuilders.ts
 *
 * Modular builder helpers for the Three.js viewport in Replay3DModel.
 * Each builder is a pure function — it creates objects, adds them to the
 * provided scene, and returns the created object(s) for the caller to store
 * in refs.  No component state or React hooks are used here.
 *
 * Sections:
 *   1. Types re-exported for callers
 *   2. buildJointMeshes     — 33 sphere meshes (one per pose landmark)
 *   3. buildSkeletonLines   — line segments connecting landmark pairs
 *   4. buildAxesHelpers     — per-joint XYZ axis debug widgets
 *   5. buildSkyboxEnvironment — scene background, lighting, floor, grid
 *   6. buildRippleGridPlane — shader-driven animated ground plane
 *   7. buildStressVectors   — muscle-group force-vector meshes
 *   8. Constants re-exported (BONES_CONNECTIONS, STRESS_VECTOR_ATTACHMENTS)
 */

import * as THREE from "three";

// ─── Re-exported constant tables ─────────────────────────────────────────────

/**
 * Index pairs that form the skeleton segments drawn between pose landmarks.
 * MediaPipe BlazePose landmark indices.
 */
export const BONES_CONNECTIONS: readonly [number, number][] = [
  [11, 12],
  [12, 24],
  [24, 23],
  [23, 11],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
] as const;

export const MUSCLE_JOINT_GROUPS = {
  arms: [11, 12, 13, 14, 15, 16],
  core: [11, 12, 23, 24],
  legs: [23, 24, 25, 26, 27, 28],
} as const;

export const STRESS_VECTOR_ATTACHMENTS: ReadonlyArray<{
  jointIdx: number;
  parentIdx: number;
  muscleGroup: keyof typeof MUSCLE_JOINT_GROUPS;
}> = [
  { jointIdx: 13, parentIdx: 11, muscleGroup: "arms" },
  { jointIdx: 14, parentIdx: 12, muscleGroup: "arms" },
  { jointIdx: 15, parentIdx: 13, muscleGroup: "arms" },
  { jointIdx: 16, parentIdx: 14, muscleGroup: "arms" },
  { jointIdx: 25, parentIdx: 23, muscleGroup: "legs" },
  { jointIdx: 26, parentIdx: 24, muscleGroup: "legs" },
  { jointIdx: 27, parentIdx: 25, muscleGroup: "legs" },
  { jointIdx: 28, parentIdx: 26, muscleGroup: "legs" },
  { jointIdx: 23, parentIdx: 11, muscleGroup: "core" },
  { jointIdx: 24, parentIdx: 12, muscleGroup: "core" },
] as const;

// ─── Shared geometry constants ────────────────────────────────────────────────

const GRID_RIPPLE_MAX = 6;

// ─── Types ────────────────────────────────────────────────────────────────────

/** One entry in the bones array — a line primitive and its landmark endpoints. */
export interface BoneEntry {
  line: THREE.Line;
  startIdx: number;
  endIdx: number;
}

/** Full stress-vector rig attached to a single joint. */
export interface StressVectorRig {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  geometry: THREE.BufferGeometry;
  jointIdx: number;
  parentIdx: number;
  muscleGroup: keyof typeof MUSCLE_JOINT_GROUPS;
}

/** Return value of buildSkyboxEnvironment. */
export interface SkyboxAssets {
  grid: THREE.GridHelper;
  floor: THREE.Mesh;
  ambientLight: THREE.AmbientLight;
  keyLight: THREE.DirectionalLight;
  fillLight: THREE.DirectionalLight;
  rimLight: THREE.PointLight;
}

/** Return value of buildRippleGridPlane. */
export interface RippleGridAssets {
  plane: THREE.Mesh;
  material: THREE.ShaderMaterial;
}

// ─── 1. buildJointMeshes ──────────────────────────────────────────────────────

/**
 * Creates 33 sphere meshes (one per MediaPipe pose landmark) and adds them to
 * the scene.  All spheres share the same geometry but each gets a cloned
 * material so individual colours can be set per-joint at runtime.
 *
 * @returns Array of 33 meshes in landmark-index order.
 */
export function buildJointMeshes(scene: THREE.Scene): THREE.Mesh[] {
  const geometry = new THREE.SphereGeometry(0.04, 16, 16);
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x00ff00,
    emissive: 0x00ff00,
    emissiveIntensity: 0.5,
    depthTest: true,
    depthWrite: false,
  });

  const joints: THREE.Mesh[] = [];

  for (let i = 0; i < 33; i++) {
    const sphere = new THREE.Mesh(geometry, baseMaterial.clone());
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    sphere.renderOrder = 2;
    sphere.userData.isOverlay = true;
    scene.add(sphere);
    joints.push(sphere);
  }

  return joints;
}

// ─── 2. buildSkeletonLines ───────────────────────────────────────────────────

/**
 * Creates one `THREE.Line` per entry in BONES_CONNECTIONS and adds each to the
 * scene.  The position buffer for each line is intentionally left at zero — the
 * animation loop is responsible for updating vertices every frame.
 *
 * @returns Array of BoneEntry objects (line + endpoint landmark indices).
 */
export function buildSkeletonLines(scene: THREE.Scene): BoneEntry[] {
  const bones: BoneEntry[] = [];

  for (const [startIdx, endIdx] of BONES_CONNECTIONS) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(6), 3),
    );

    const material = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      linewidth: 2,
      depthTest: true,
      depthWrite: false,
    });

    const line = new THREE.Line(geometry, material);
    line.renderOrder = 2;
    line.userData.isOverlay = true;
    scene.add(line);

    bones.push({ line, startIdx, endIdx });
  }

  return bones;
}

// ─── 3. buildAxesHelpers ─────────────────────────────────────────────────────

/**
 * Creates 33 `THREE.AxesHelper` widgets — one per landmark — and adds them to
 * the scene hidden by default.  Toggle `axesHelper.visible` at runtime to debug
 * individual joint orientations (X=red, Y=green, Z=blue).
 *
 * @param size  Length of each axis arm in world units. Default: 0.08.
 * @returns Array of 33 helpers in landmark-index order.
 */
export function buildAxesHelpers(
  scene: THREE.Scene,
  size = 0.08,
): THREE.AxesHelper[] {
  const helpers: THREE.AxesHelper[] = [];

  for (let i = 0; i < 33; i++) {
    const helper = new THREE.AxesHelper(size);
    helper.visible = false; // hidden until explicitly enabled
    scene.add(helper);
    helpers.push(helper);
  }

  return helpers;
}

// ─── 4. buildSkyboxEnvironment ───────────────────────────────────────────────

/**
 * Populates the scene with the static environment that surrounds the avatar:
 *
 *  - Flat dark background colour
 *  - Three-point lighting rig (ambient + key + fill + rim)
 *  - A translucent `GridHelper` ground plane
 *  - A `MeshPhongMaterial` floor that receives shadows
 *
 * All created objects are added to `scene`.  The returned `SkyboxAssets` object
 * gives the caller handles to every created object so they can be updated or
 * disposed later.
 *
 * @param scene  Target Three.js scene.
 */
export function buildSkyboxEnvironment(scene: THREE.Scene): SkyboxAssets {
  // ── Background colour ────────────────────────────────────────────────────
  scene.background = new THREE.Color(0x111111);

  // ── Lighting rig ─────────────────────────────────────────────────────────
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0x00ffff, 1.2);
  keyLight.position.set(2, 4, 3);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.camera.left = -5;
  keyLight.shadow.camera.right = 5;
  keyLight.shadow.camera.top = 5;
  keyLight.shadow.camera.bottom = -5;
  keyLight.shadow.camera.near = 0.1;
  keyLight.shadow.camera.far = 50;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x9d4edd, 0.7);
  fillLight.position.set(-2, 2, 2);
  fillLight.castShadow = true;
  fillLight.shadow.mapSize.width = 512;
  fillLight.shadow.mapSize.height = 512;
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(0xffffff, 1);
  rimLight.position.set(0, 3, -4);
  rimLight.castShadow = true;
  scene.add(rimLight);

  // ── Grid ─────────────────────────────────────────────────────────────────
  const grid = new THREE.GridHelper(10, 20, 0x00ffff, 0x222222);
  grid.position.y = -1.01;
  (grid.material as THREE.LineBasicMaterial).transparent = true;
  (grid.material as THREE.LineBasicMaterial).opacity = 0.2;
  scene.add(grid);

  // ── Floor plane ───────────────────────────────────────────────────────────
  const floorGeo = new THREE.PlaneGeometry(10, 10);
  const floorMat = new THREE.MeshPhongMaterial({
    color: 0x000000,
    emissive: 0x00ffff,
    emissiveIntensity: 0.05,
    transparent: true,
    opacity: 0.8,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.02;
  floor.receiveShadow = true;
  scene.add(floor);

  return { grid, floor, ambientLight, keyLight, fillLight, rimLight };
}

// ─── 5. buildRippleGridPlane ─────────────────────────────────────────────────

/**
 * Creates the animated shader-driven ground plane that renders concentric
 * ripple rings triggered by rep completions.
 *
 * The returned `RippleGridAssets` contains both the plane `Mesh` and its
 * `ShaderMaterial` so the animation loop can update uniforms (`uTime`,
 * `uRippleOrigins`, etc.) without needing to re-traverse the scene.
 *
 * @param scene  Target Three.js scene.
 */
export function buildRippleGridPlane(scene: THREE.Scene): RippleGridAssets {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uGridColor: { value: new THREE.Color(0x00ffff) },
      uRippleColor: { value: new THREE.Color(0x85fff4) },
      uGridScale: { value: 7.5 },
      uLineWidth: { value: 0.06 },
      uRippleCount: { value: 0 },
      uRippleOrigins: {
        value: Array.from(
          { length: GRID_RIPPLE_MAX },
          () => new THREE.Vector2(-10, -10),
        ),
      },
      uRippleStarts: {
        value: Array.from({ length: GRID_RIPPLE_MAX }, () => 0),
      },
      uRippleSpeeds: {
        value: Array.from({ length: GRID_RIPPLE_MAX }, () => 0),
      },
      uRippleStrengths: {
        value: Array.from({ length: GRID_RIPPLE_MAX }, () => 0),
      },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      #define MAX_RIPPLES ${GRID_RIPPLE_MAX}

      uniform float uTime;
      uniform vec3 uGridColor;
      uniform vec3 uRippleColor;
      uniform float uGridScale;
      uniform float uLineWidth;
      uniform int uRippleCount;
      uniform vec2 uRippleOrigins[MAX_RIPPLES];
      uniform float uRippleStarts[MAX_RIPPLES];
      uniform float uRippleSpeeds[MAX_RIPPLES];
      uniform float uRippleStrengths[MAX_RIPPLES];
      varying vec2 vUv;

      float gridMask(vec2 uv) {
        vec2 cell = abs(fract(uv * uGridScale) - 0.5);
        float lineX = smoothstep(0.5, 0.5 - uLineWidth, cell.x);
        float lineY = smoothstep(0.5, 0.5 - uLineWidth, cell.y);
        return max(lineX, lineY);
      }

      void main() {
        vec3 base = vec3(0.01, 0.03, 0.05);
        float grid = gridMask(vUv);
        float rippleGlow = 0.0;
        float rippleCore = 0.0;

        for (int i = 0; i < MAX_RIPPLES; i++) {
          if (i >= uRippleCount) break;
          float age = max(uTime - uRippleStarts[i], 0.0);
          float radius = age * uRippleSpeeds[i];
          float dist = distance(vUv, uRippleOrigins[i]);
          float ring = 1.0 - smoothstep(0.0, 0.035, abs(dist - radius));
          float pulse = 0.5 + 0.5 * sin((dist - radius) * 65.0);
          float fade = exp(-age * 1.25) * exp(-dist * 0.8);
          float strength = uRippleStrengths[i] * ring * pulse * fade;
          rippleGlow += strength;
          rippleCore = max(rippleCore, strength);
        }

        vec3 gridColor = mix(base, uGridColor, grid * 0.55);
        vec3 rippleColor = mix(gridColor, uRippleColor, clamp(rippleGlow, 0.0, 1.0));
        rippleColor += uRippleColor * rippleCore * 0.75;

        float alpha = clamp(0.08 + grid * 0.6 + rippleGlow * 0.85, 0.0, 0.95);
        gl_FragColor = vec4(rippleColor, alpha);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const geometry = new THREE.PlaneGeometry(10, 10, 1, 1);
  const plane = new THREE.Mesh(geometry, material);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -1.0;
  plane.renderOrder = 1;
  scene.add(plane);

  return { plane, material };
}

// ─── 6. buildStressVectors ───────────────────────────────────────────────────

/**
 * Creates one tapered cylinder mesh per entry in STRESS_VECTOR_ATTACHMENTS and
 * adds each to the scene.  Each mesh uses a `ShaderMaterial` with stress/length/
 * thickness uniforms driven by the animation loop.
 *
 * Returns the full array of `StressVectorRig` objects so callers can update
 * shader uniforms and `mesh.visible` per-frame.
 */
export function buildStressVectors(scene: THREE.Scene): StressVectorRig[] {
  const rigs: StressVectorRig[] = [];

  for (const { jointIdx, parentIdx, muscleGroup } of STRESS_VECTOR_ATTACHMENTS) {
    const geometry = new THREE.CylinderGeometry(0.05, 0.015, 1, 10, 1, false);
    geometry.translate(0, 0.5, 0);

    const material = createStressVectorMaterial();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    mesh.userData.isOverlay = true;
    scene.add(mesh);

    rigs.push({ mesh, material, geometry, jointIdx, parentIdx, muscleGroup });
  }

  return rigs;
}

// ─── 7. buildCyberpunkGymScenery ──────────────────────────────────────────────

/**
 * Return value of buildCyberpunkGymScenery.
 * Provides references to all created objects for disposal or updates.
 */
export interface GymSceneryAssets {
  gymGroup: THREE.Group;
  neonLights: THREE.Mesh[];
  equipment: THREE.Group;
  wallPanels: THREE.Mesh[];
}

/**
 * Populates the scene with a low-poly cyberpunk gym environment:
 *
 *  - Atmospheric fog
 *  - Neon tube lights on both sides
 *  - Procedural gym equipment (barbell, dumbbell, bench)
 *  - Wall panels with grid texture
 *
 * All objects are added to a single group so they can be hidden/disposed
 * as a unit.  Returns references to sub-groups for finer control.
 */
export function buildCyberpunkGymScenery(scene: THREE.Scene): GymSceneryAssets {
  const gymGroup = new THREE.Group();
  scene.add(gymGroup);

  // ── Fog ───────────────────────────────────────────────────────────────────
  scene.fog = new THREE.FogExp2(0x0a0a1a, 0.035);

  // ── Neon tube lights ──────────────────────────────────────────────────────
  const neonLights: THREE.Mesh[] = [];
  const tubeMat = new THREE.MeshStandardMaterial({
    color: 0x00ffff,
    emissive: 0x00ffff,
    emissiveIntensity: 1.5,
    transparent: true,
    opacity: 0.9,
  });

  for (let i = 0; i < 4; i++) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.0, 8), tubeMat);
    const xPos = i < 2 ? -3.5 : 3.5;
    const zPos = i % 2 === 0 ? -1.5 : 1.5;
    tube.position.set(xPos, 1.2, zPos);
    tube.rotation.z = Math.PI / 2;
    gymGroup.add(tube);
    neonLights.push(tube);

    const glow = new THREE.PointLight(0x00ffff, 0.3, 4);
    glow.position.copy(tube.position);
    gymGroup.add(glow);
  }

  // ── Wall panels ────────────────────────────────────────────────────────────
  const wallPanels: THREE.Mesh[] = [];
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    emissive: 0x0a0a1a,
    metalness: 0.6,
    roughness: 0.4,
    side: THREE.DoubleSide,
  });

  const panelPositions = [
    { x: -4.5, y: 0.5, z: 0, rx: 0 },
    { x: 4.5, y: 0.5, z: 0, rx: 0 },
    { x: 0, y: 0.5, z: -3, rx: Math.PI / 2 },
  ];

  for (const pos of panelPositions) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), panelMat);
    panel.position.set(pos.x, pos.y, pos.z);
    panel.rotation.y = pos.rx;
    gymGroup.add(panel);
    wallPanels.push(panel);

    const gridLines = new THREE.Mesh(
      new THREE.PlaneGeometry(5.6, 2.6),
      new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        wireframe: true,
        transparent: true,
        opacity: 0.15,
      }),
    );
    gridLines.position.copy(panel.position);
    gridLines.rotation.copy(panel.rotation);
    gridLines.position.z += 0.01;
    gymGroup.add(gridLines);
  }

  // ── Gym equipment group ────────────────────────────────────────────────────
  const equipment = new THREE.Group();
  gymGroup.add(equipment);

  // Barbell
  const barMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.8, roughness: 0.3 });
  const weightMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5, roughness: 0.6 });

  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8), barMat);
  bar.position.set(-0.8, 0.2, -1.8);
  bar.rotation.x = Math.PI / 2;
  equipment.add(bar);

  for (const side of [-1, 1]) {
    const weight = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.1, 12), weightMat);
    weight.position.set(bar.position.x + side * 0.7, 0.2, -1.8);
    weight.rotation.x = Math.PI / 2;
    equipment.add(weight);
  }

  // Dumbbell
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7, roughness: 0.3 });
  const dbHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8), handleMat);
  dbHandle.position.set(1.2, 0.15, -1.5);
  dbHandle.rotation.z = Math.PI / 2;
  equipment.add(dbHandle);

  for (const side of [-1, 1]) {
    const dbWeight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.08), weightMat);
    dbWeight.position.set(1.2 + side * 0.18, 0.15, -1.5);
    equipment.add(dbWeight);
  }

  // Workout bench
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x2a2a3e, roughness: 0.7 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.3), benchMat);
  seat.position.set(-0.5, 0.25, 1.2);
  equipment.add(seat);

  const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.08), benchMat);
  backrest.position.set(-0.5, 0.45, 1.35);
  equipment.add(backrest);

  for (const legX of [-0.55, -0.45]) {
    for (const legZ of [1.1, 1.3]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.2, 6), handleMat);
      leg.position.set(legX, 0.1, legZ);
      equipment.add(leg);
    }
  }

  return { gymGroup, neonLights, equipment, wallPanels };
}

/**
 * Creates the ShaderMaterial used by each stress-vector mesh.
 * Kept internal to this module — callers receive the material via
 * `StressVectorRig.material` and only need to update its uniforms.
 */
function createStressVectorMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0x00ffff) },
      uStress: { value: 0 },
      uLength: { value: 1 },
      uThickness: { value: 0.05 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform float uStress;
      uniform float uLength;
      uniform float uThickness;
      uniform float uTime;
      varying float vProgress;
      varying float vStress;

      void main() {
        vProgress = clamp(position.y, 0.0, 1.0);
        vStress = clamp(uStress, 0.0, 1.0);

        vec3 transformed = position;
        float pulse = 1.0 + sin(uTime * 4.5 + vProgress * 8.0) * 0.06 * vStress;
        float taper = mix(1.0, 0.22, vProgress);

        transformed.x *= uThickness * taper * pulse;
        transformed.z *= uThickness * taper * pulse;
        transformed.y *= mix(0.45, uLength, vStress);

        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uStress;
      varying float vProgress;
      varying float vStress;

      void main() {
        vec3 hot = vec3(1.0, 0.35, 0.12);
        vec3 cool = uColor;
        vec3 color = mix(cool, hot, clamp(uStress, 0.0, 1.0));
        float shaft = smoothstep(0.0, 0.18, vProgress)
                    * (1.0 - smoothstep(0.82, 1.0, vProgress));
        float glow = mix(0.35, 0.95, vStress);
        float alpha = mix(0.24, 0.92, shaft) * glow;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
