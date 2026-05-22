import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface ReplayFrame {
  timestamp: number;
  landmarks: { x: number; y: number; z: number }[];
  angles?: Record<string, number>;
  feedback: string;
  exercise?: string;
}

export interface Replay3DModelProps {
  frames: ReplayFrame[];
  modelUrl?: string;
  // External playback control (from ReplayScreen)
  currentFrameIdx?: number;
  isPlaying?: boolean;
  onFrameChange?: (idx: number) => void;
  onPlayToggle?: () => void;
  hideControls?: boolean;
}

const BONES_CONNECTIONS = [
  // Torso
  [11, 12],
  [12, 24],
  [24, 23],
  [23, 11],
  // Left Arm
  [11, 13],
  [13, 15],
  // Right Arm
  [12, 14],
  [14, 16],
  // Left Leg
  [23, 25],
  [25, 27],
  // Right Leg
  [24, 26],
  [26, 28],
];

const COLOR_GREEN = new THREE.Color(0x00ff00);
const COLOR_YELLOW = new THREE.Color(0xffff00);
const COLOR_RED = new THREE.Color(0xff0000);

const parseFeedback = (feedback: string) => {
  if (
    typeof feedback !== "string" ||
    feedback.includes("ESTABLISHING") ||
    feedback.includes("Get into position") ||
    feedback.includes("READY 🟢")
  ) {
    return { baseColor: COLOR_YELLOW, badJoints: new Set<number>() };
  }
  if (feedback.includes("Good form ✅")) {
    return { baseColor: COLOR_GREEN, badJoints: new Set<number>() };
  }

  const badJoints = new Set<number>();
  let baseColor = COLOR_YELLOW;
  let mistakeColor = COLOR_RED;

  if (feedback.includes("Keep your back straight ❌")) {
    baseColor = COLOR_RED;
    [11, 12, 23, 24].forEach((j) => badJoints.add(j));
  }
  if (feedback.includes("Go lower for full range")) {
    [13, 14].forEach((j) => badJoints.add(j));
  }
  if (feedback.includes("over-bend knees")) {
    [25, 26].forEach((j) => badJoints.add(j));
  }
  if (
    feedback.includes("hips lower") ||
    feedback.includes("Drop your hips") ||
    feedback.includes("Hips too high")
  ) {
    [23, 24].forEach((j) => badJoints.add(j));
  }
  if (
    feedback.includes("Squeeze at the top") ||
    feedback.includes("Keep elbows at side")
  ) {
    [11, 12, 13, 14].forEach((j) => badJoints.add(j));
  }
  if (feedback.includes("Raise arms higher")) {
    [11, 12].forEach((j) => badJoints.add(j));
  }

  return { baseColor, badJoints, mistakeColor };
};

export const Replay3DModel: React.FC<Replay3DModelProps> = ({
  frames,
  modelUrl = "/model.glb",
  currentFrameIdx: externalFrameIdx,
  isPlaying: externalIsPlaying,
  onFrameChange,
  onPlayToggle,
  hideControls = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [_isPlaying, _setIsPlaying] = useState(false);
  const [_currentFrameIdx, _setCurrentFrameIdx] = useState(0);
  const [modelLoaded, setModelLoaded] = useState(false);

  // Use external control if provided, else internal
  const isPlaying =
    externalIsPlaying !== undefined ? externalIsPlaying : _isPlaying;
  const currentFrameIdx =
    externalFrameIdx !== undefined ? externalFrameIdx : _currentFrameIdx;
  const setIsPlaying = onPlayToggle ? () => onPlayToggle() : _setIsPlaying;
  const setCurrentFrameIdx = onFrameChange
    ? onFrameChange
    : _setCurrentFrameIdx;

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  // Fallback refs
  const jointsRef = useRef<THREE.Mesh[]>([]);
  const bonesRef = useRef<
    { line: THREE.Line; startIdx: number; endIdx: number }[]
  >([]);

  // GLTF refs
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const boneMapRef = useRef<Record<string, THREE.Bone>>({});
  const skinnedMeshesRef = useRef<THREE.SkinnedMesh[]>([]);
  const restDataRef = useRef<
    Record<
      string,
      {
        worldQuat: THREE.Quaternion;
        localQuat: THREE.Quaternion;
        dir: THREE.Vector3;
      }
    >
  >({});
  const rootOffsetRef = useRef<THREE.Vector3>(new THREE.Vector3());

  const [hudLabels, setHudLabels] = useState<any[]>([]);
  const reqIdRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    console.log("Replay frames:", frames?.length || 0);
  }, [frames]);

  useEffect(() => {
    if (!frames || frames.length === 0) return;
    if (!mountRef.current) return;

    // --- Setup Three.js Scene ---
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 0, 3.2); // Closer camera to make the 3D model fill the view
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    // ✨ Enable shadow mapping for dynamic lighting
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap; // Better quality shadows
    renderer.shadowMap.autoUpdate = true;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.1; // allow looking slightly from below
    controls.minDistance = 1.0;
    controls.maxDistance = 10.0;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // Cinematic Three-Point Lighting
    const keyLight = new THREE.DirectionalLight(0x00ffff, 1.2); // Neon Cyan
    keyLight.position.set(2, 4, 3);
    // ✨ Enable shadows on key light
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024; // Optimized for performance
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.left = -5;
    keyLight.shadow.camera.right = 5;
    keyLight.shadow.camera.top = 5;
    keyLight.shadow.camera.bottom = -5;
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 50;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x9d4edd, 0.7); // Neon Purple
    fillLight.position.set(-2, 2, 2);
    // ✨ Enable shadows on fill light (softer)
    fillLight.castShadow = true;
    fillLight.shadow.mapSize.width = 512; // Lower res for softer fill shadows
    fillLight.shadow.mapSize.height = 512;
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0xffffff, 1);
    rimLight.position.set(0, 3, -4);
    // ✨ Enable shadows on rim light for accent
    rimLight.castShadow = true;
    scene.add(rimLight);

    // --- Environment: The Grid ---
    const grid = new THREE.GridHelper(10, 20, 0x00ffff, 0x222222);
    grid.position.y = -1.01;
    (grid.material as THREE.LineBasicMaterial).transparent = true;
    (grid.material as THREE.LineBasicMaterial).opacity = 0.2;
    scene.add(grid);

    // Floor Glow & Shadow Receiver
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
    // ✨ Enable floor to receive shadows
    floor.receiveShadow = true;
    scene.add(floor);

    // --- Create Fallback Skeleton ---
    const jointGeometry = new THREE.SphereGeometry(0.04, 16, 16);
    const jointMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      emissive: 0x00ff00,
      emissiveIntensity: 0.5,
    });

    const createdJoints: THREE.Mesh[] = [];
    for (let i = 0; i < 33; i++) {
      const sphere = new THREE.Mesh(jointGeometry, jointMaterial.clone());
      // ✨ Enable shadows on joint spheres
      sphere.castShadow = true;
      sphere.receiveShadow = true;
      scene.add(sphere);
      createdJoints.push(sphere);
    }
    jointsRef.current = createdJoints;

    const createdBones: {
      line: THREE.Line;
      startIdx: number;
      endIdx: number;
    }[] = [];
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      linewidth: 2,
    });

    BONES_CONNECTIONS.forEach(([startIdx, endIdx]) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(6), 3),
      );
      const line = new THREE.Line(geometry, lineMaterial.clone());
      scene.add(line);
      createdBones.push({ line, startIdx, endIdx });
    });
    bonesRef.current = createdBones;

    // --- Load GLTF Model ---
    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        const model = gltf.scene;
        model.position.y = -1; // Center model at hips roughly
        scene.add(model);
        modelGroupRef.current = model;

        const bones: Record<string, THREE.Bone> = {};
        model.traverse((o) => {
          if (o.type === "Bone") {
            const name = o.name.toLowerCase();
            if (name.includes("leftarm") && !name.includes("fore"))
              bones.leftShoulder = o as THREE.Bone;
            if (name.includes("leftforearm")) bones.leftElbow = o as THREE.Bone;
            if (name.includes("lefthand") || name.includes("leftwrist"))
              bones.leftWrist = o as THREE.Bone;

            if (name.includes("rightarm") && !name.includes("fore"))
              bones.rightShoulder = o as THREE.Bone;
            if (name.includes("rightforearm"))
              bones.rightElbow = o as THREE.Bone;
            if (name.includes("righthand") || name.includes("rightwrist"))
              bones.rightWrist = o as THREE.Bone;

            if (name.includes("leftupleg") || name.includes("lefthip"))
              bones.leftHip = o as THREE.Bone;
            if (name.includes("leftleg") || name.includes("leftknee"))
              bones.leftKnee = o as THREE.Bone;
            if (name.includes("leftfoot") || name.includes("leftankle"))
              bones.leftAnkle = o as THREE.Bone;

            if (name.includes("rightupleg") || name.includes("righthip"))
              bones.rightHip = o as THREE.Bone;
            if (name.includes("rightleg") || name.includes("rightknee"))
              bones.rightKnee = o as THREE.Bone;
            if (name.includes("rightfoot") || name.includes("rightankle"))
              bones.rightAnkle = o as THREE.Bone;

            if (name.includes("spine")) {
              if (name.includes("1")) bones.spine1 = o as THREE.Bone;
              else if (name.includes("2")) bones.spine2 = o as THREE.Bone;
              else bones.spine = o as THREE.Bone;
            }
            if (
              name.includes("hips") &&
              !name.includes("left") &&
              !name.includes("right")
            )
              bones.hips = o as THREE.Bone;
            if (name.includes("neck")) bones.neck = o as THREE.Bone;
            if (name.includes("head")) bones.head = o as THREE.Bone;
          }
          if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
            const mesh = o as THREE.SkinnedMesh;
            skinnedMeshesRef.current.push(mesh);
            // Fix: Avoid array material cloning crash by creating a fresh green holographic material
            mesh.material = new THREE.MeshStandardMaterial({
              color: 0x00ff00,
              roughness: 0.2,
              metalness: 0.8,
              emissive: 0x00ff00,
              emissiveIntensity: 0.1,
            });
            // ✨ Enable shadows on skinned mesh for dynamic lighting
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });
        boneMapRef.current = bones;

        // --- Record Resting Data for FK ---
        model.updateMatrixWorld(true);

        const hipPos = new THREE.Vector3();
        if (bones.hips) {
          bones.hips.getWorldPosition(hipPos);
          rootOffsetRef.current = model.position.clone().sub(hipPos);
        }

        const recordRest = (boneKey: string, childKey: string) => {
          const bone = bones[boneKey];
          const childBone = bones[childKey];
          if (!bone || !childBone) return;

          const pPos = new THREE.Vector3();
          bone.getWorldPosition(pPos);
          const cPos = new THREE.Vector3();
          childBone.getWorldPosition(cPos);

          const dir = new THREE.Vector3().subVectors(cPos, pPos).normalize();
          if (dir.lengthSq() < 0.001) return;

          const worldQ = new THREE.Quaternion();
          bone.getWorldQuaternion(worldQ);

          restDataRef.current[boneKey] = {
            worldQuat: worldQ.clone(),
            localQuat: bone.quaternion.clone(),
            dir: dir.clone(),
          };
        };

        // --- Map Standard Joints for FK Tracking ---
        recordRest("leftShoulder", "leftElbow");
        recordRest("leftElbow", "leftWrist");
        recordRest("rightShoulder", "rightElbow");
        recordRest("rightElbow", "rightWrist");
        recordRest("leftHip", "leftKnee");
        recordRest("leftKnee", "leftAnkle");
        recordRest("rightHip", "rightKnee");
        recordRest("rightKnee", "rightAnkle");

        if (bones.spine && bones.spine1) recordRest("spine", "spine1");
        if (bones.neck && bones.head) recordRest("neck", "head");

        setModelLoaded(true);

        // Hide fallback
        jointsRef.current.forEach((j) => (j.visible = false));
        bonesRef.current.forEach((b) => (b.line.visible = false));
      },
      undefined,
      (err) => {
        console.warn(
          "Replay3DModel: Failed to load GLTF model, falling back to joint skeleton.",
          err,
        );
        setModelLoaded(false);
      },
    );

    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current)
        return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (mountRef.current && rendererRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      controlsRef.current?.dispose();
      rendererRef.current?.dispose();
    };
  }, [frames, modelUrl]);

  // --- Animation Engine ---
  useEffect(() => {
    if (!frames || frames.length === 0) return;

    const renderLoop = (time: number) => {
      reqIdRef.current = requestAnimationFrame(renderLoop);

      // Slowed playback from 15 FPS to 8 FPS for detailed form analysis
      if (isPlaying && time - lastTimeRef.current > 1000 / 8) {
        const nextIdx = (currentFrameIdx + 1) % frames.length;
        setCurrentFrameIdx(nextIdx);
        lastTimeRef.current = time;
      }

      const frame = frames[currentFrameIdx];
      if (!frame || !frame.landmarks) {
        rendererRef.current?.render(sceneRef.current!, cameraRef.current!);
        return;
      }

      const { baseColor, badJoints, mistakeColor } = parseFeedback(
        frame.feedback,
      );

      if (modelLoaded) {
        if (!modelGroupRef.current) return;
        // --- Output to GLTF Skinned Mesh ---
        // --- Dynamic Z-axis Depth Estimation ---
        let depthScale = 2.0;
        const rawLShoulder = frame.landmarks[11];
        const rawRShoulder = frame.landmarks[12];
        const rawLHip = frame.landmarks[23];
        const rawRHip = frame.landmarks[24];
        
        if (rawLShoulder && rawRShoulder && rawLHip && rawRHip) {
            // Compute torso diagonal as a reference for anatomical depth scaling
            const dx = rawLShoulder.x - rawRHip.x;
            const dy = rawLShoulder.y - rawRHip.y;
            const torsoSize = Math.sqrt(dx * dx + dy * dy);
            if (torsoSize > 0.1) {
                // Base Z multiplier scaled inversely by apparent torso size for perspective depth correction
                depthScale = (0.5 / torsoSize) * 3.0;
            }
        }

        const getLm = (idx: number) => {
            const lm = frame.landmarks[idx];
            if (!lm) return null;
            // Invert X axis so user's physical right arm maps to screen right side = physical right of avatar
            // Apply estimated depth scale to Z for more accurate 3D replay representation
            return new THREE.Vector3(-(lm.x - 0.5) * 2, -(lm.y - 0.5) * 2, -lm.z * depthScale);
        };

        // Torso Alignment & Root Motion
        const lShoulder = getLm(11);
        const rShoulder = getLm(12);
        const lHip = getLm(23);
        const rHip = getLm(24);
        const lAnkle = getLm(27);
        const rAnkle = getLm(28);

        if (lShoulder && rShoulder && lHip && rHip) {
            const shoulderCenter = new THREE.Vector3().addVectors(lShoulder, rShoulder).multiplyScalar(0.5);
            const hipCenter = new THREE.Vector3().addVectors(lHip, rHip).multiplyScalar(0.5);

            // Up vector (hips pointing UP to shoulders)
            const up = new THREE.Vector3().subVectors(shoulderCenter, hipCenter).normalize();
            
            // Right vector (User Left Shoulder 11 to User Right Shoulder 12 mapping physical right)
            const right = new THREE.Vector3().subVectors(lShoulder, rShoulder).normalize();
            
            // Back vector (cross product produces orthogonal depth Z)
            const forward = new THREE.Vector3().crossVectors(right, up).normalize();
            
            // Perfect orthogonal matrix
            right.crossVectors(up, forward).normalize();
            const mat = new THREE.Matrix4();
            mat.makeBasis(right, up, forward);
            const torsoQuat = new THREE.Quaternion().setFromRotationMatrix(mat);

            // Apply heavily smoothed physical turning and squat dropping (0.2 -> 0.05)
            modelGroupRef.current.quaternion.slerp(torsoQuat, 0.05);
            
            const rotatedOffset = rootOffsetRef.current.clone().applyQuaternion(modelGroupRef.current.quaternion);
            const targetPos = hipCenter.clone().add(rotatedOffset);
            
            // --- Grounding: Lock the lowest foot firmly to the ground plane (-1.0) ---
            const minAnkleY = Math.min(lAnkle?.y || 0, rAnkle?.y || 0);
            targetPos.y = -1.0 - minAnkleY;

            modelGroupRef.current.position.lerp(targetPos, 0.05);

            // Update model matrix since we moved it, so FK calculation has the correct parent offsets!
            modelGroupRef.current.updateMatrixWorld(true);

            // --- Dynamic Camera Tracking & Orbit Target Sync ---
            const lookTarget = new THREE.Vector3().lerpVectors(hipCenter, shoulderCenter, 0.5);
            if (controlsRef.current) {
                controlsRef.current.target.lerp(lookTarget, 0.05);
            } else if (cameraRef.current) {
                cameraRef.current.lookAt(lookTarget);
            }
        }

        const applyPose = (
          boneKey: string,
          startIdx: number,
          endIdx: number,
        ) => {
          if (!boneMapRef.current || !restDataRef.current) return;
          const bone = boneMapRef.current[boneKey];
          const rest = restDataRef.current[boneKey];
          if (!bone || !rest) return;

          const startV = getLm(startIdx);
          const endV = getLm(endIdx);
          if (!startV || !endV) return;

          // Target direction from MediaPipe
          const targetDir = new THREE.Vector3()
            .subVectors(endV, startV)
            .normalize();
          if (targetDir.lengthSq() < 0.0001) return;

          // Quaternion to rotate rest direction to target direction in world space
          const deltaQ = new THREE.Quaternion().setFromUnitVectors(
            rest.dir,
            targetDir,
          );

          // Multiply resting world rotation by delta to get the new target world rotation
          const targetWorldQ = rest.worldQuat.clone().premultiply(deltaQ);

          // Convert to Local Rotation: LocalQ = ParentWorldQ_inverse * TargetWorldQ
          const parentWorldQ = new THREE.Quaternion();
          if (bone.parent) {
            bone.parent.getWorldQuaternion(parentWorldQ);
          }

          const targetLocalQ = targetWorldQ
            .clone()
            .premultiply(parentWorldQ.invert());

          // Slerp for heavily smoothed, natural transition without jitter
          bone.quaternion.slerp(targetLocalQ, 0.05);
        };

        // --- Anatomical Accuracy: Spine & Neck ---
        const bMap = boneMapRef.current;
        if (bMap && bMap.spine) {
          const hC =
            lHip && rHip
              ? new THREE.Vector3().addVectors(lHip, rHip).multiplyScalar(0.5)
              : null;
          const sC =
            lShoulder && rShoulder
              ? new THREE.Vector3()
                  .addVectors(lShoulder, rShoulder)
                  .multiplyScalar(0.5)
              : null;

          if (hC && sC) {
            const spineDir = new THREE.Vector3().subVectors(sC, hC).normalize();
            const rest = restDataRef.current["spine"];
            if (rest) {
              const deltaQ = new THREE.Quaternion().setFromUnitVectors(
                rest.dir,
                spineDir,
              );
              const targetWorldQ = rest.worldQuat.clone().premultiply(deltaQ);
              const parentWorldQ = new THREE.Quaternion();
              if (bMap.spine.parent)
                bMap.spine.parent.getWorldQuaternion(parentWorldQ);
              bMap.spine.quaternion.slerp(
                targetWorldQ.premultiply(parentWorldQ.invert()),
                0.05,
              );
            }
          }
        }

        // MediaPipe indices to bone targets
        applyPose("leftShoulder", 11, 13);
        applyPose("leftElbow", 13, 15);
        applyPose("rightShoulder", 12, 14);
        applyPose("rightElbow", 14, 16);
        applyPose("leftHip", 23, 25);
        applyPose("leftKnee", 25, 27);
        applyPose("leftAnkle", 27, 29);
        applyPose("rightHip", 24, 26);
        applyPose("rightKnee", 26, 28);
        applyPose("rightAnkle", 28, 30);

        // --- 3D to 2D HUD Projection ---
        const newLabels: any[] = [];
        const projectJoint = (
          idx: number,
          boneKey: string,
          label: string,
          p1: number,
          p2: number,
          p3: number,
        ) => {
          if (!cameraRef.current || !rendererRef.current) return;

          // Calculate 3D Angle using pure landmarks
          const a = getLm(p1),
            b = getLm(p2),
            c = getLm(p3);
          let angle = 0;
          if (a && b && c) {
            const v1 = new THREE.Vector3().subVectors(a, b);
            const v2 = new THREE.Vector3().subVectors(c, b);
            angle = Math.round(v1.angleTo(v2) * (180 / Math.PI));
          }

          // Get actual position from 3D bone to anchor HUD tags
          const bone = boneMapRef.current[boneKey];
          if (!bone) return;
          const pos = new THREE.Vector3();
          bone.getWorldPosition(pos);

          const vector = pos.project(cameraRef.current);
          const x = (vector.x * 0.5 + 0.5) * mountRef.current!.clientWidth;
          const y = -(vector.y * 0.5 - 0.5) * mountRef.current!.clientHeight;

          newLabels.push({ x, y, angle, label, id: idx });
        };

        projectJoint(13, "leftElbow", "L ELBOW", 11, 13, 15);
        projectJoint(14, "rightElbow", "R ELBOW", 12, 14, 16);
        projectJoint(25, "leftKnee", "L KNEE", 23, 25, 27);
        projectJoint(26, "rightKnee", "R KNEE", 24, 26, 28);
        projectJoint(23, "leftHip", "L HIP", 11, 23, 25);
        projectJoint(24, "rightHip", "R HIP", 12, 24, 26);

        setHudLabels(newLabels);

        // Error Highlight logic for GLTF model
        skinnedMeshesRef.current.forEach((mesh) => {
          if (!mesh.material) return;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          const hasError = badJoints.size > 0;
          const targetColor = hasError ? mistakeColor || COLOR_RED : baseColor;

          // Lerp model tint to highlight issues
          if (mat && mat.color) mat.color.lerp(targetColor, 0.2);
          if (mat && mat.emissive) mat.emissive.lerp(targetColor, 0.2);
        });
      } else {
        // --- Output to Fallback Skeleton ---
        const jointTargetColors = new Array(33).fill(baseColor);
        badJoints.forEach((j) => {
          jointTargetColors[j] = mistakeColor || COLOR_RED;
        });

        for (let i = 0; i < 33; i++) {
          const landmark = frame.landmarks[i];
          if (!landmark || !jointsRef.current[i]) continue;

          const mesh = jointsRef.current[i];
          if (!mesh) continue;
          // Invert X for mirroring anatomical alignment
          const targetX = -(landmark.x - 0.5) * 2;
          const targetY = -(landmark.y - 0.5) * 2;
          const targetZ = -landmark.z * 2;

          mesh.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.1);
          const jMat = mesh.material as THREE.MeshStandardMaterial;
          if (jMat && jMat.color) {
            jMat.color.lerp(jointTargetColors[i], 0.2);
            jMat.emissive.lerp(jointTargetColors[i], 0.2);
            jMat.emissiveIntensity = badJoints.has(i) ? 1.5 : 0.5;
          }
        }

        bonesRef.current.forEach((bone) => {
          const startMesh = jointsRef.current[bone.startIdx];
          const endMesh = jointsRef.current[bone.endIdx];
          if (!startMesh || !endMesh) return;

          const positions = bone.line.geometry.attributes.position
            .array as Float32Array;
          positions[0] = startMesh.position.x;
          positions[1] = startMesh.position.y;
          positions[2] = startMesh.position.z;
          positions[3] = endMesh.position.x;
          positions[4] = endMesh.position.y;
          positions[5] = endMesh.position.z;
          bone.line.geometry.attributes.position.needsUpdate = true;

          const isBadBone =
            badJoints.has(bone.startIdx) || badJoints.has(bone.endIdx);
          const targetBoneColor = isBadBone
            ? mistakeColor || COLOR_RED
            : baseColor;
          (bone.line.material as THREE.LineBasicMaterial).color.lerp(
            targetBoneColor,
            0.2,
          );
        });
      }

      if (controlsRef.current) {
        controlsRef.current.update();
      }

      if (sceneRef.current && cameraRef.current && rendererRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    reqIdRef.current = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(reqIdRef.current);
  }, [frames, currentFrameIdx, isPlaying, modelLoaded]);

  if (!frames || frames.length === 0) {
    return (
      <div
        style={{
          padding: 20,
          textAlign: "center",
          color: "#fff",
          background: "#111",
          borderRadius: 8,
        }}
      >
        No session data available
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        position: "relative",
      }}
    >
      <div
        ref={mountRef}
        style={{
          flex: 1,
          minHeight: "400px",
          width: "100%",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      />

      {/* 3D HUD Layer */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        {hudLabels.map((node) => (
          <div
            key={node.id}
            style={{
              position: "absolute",
              left: node.x,
              top: node.y,
              transform: "translate(-50%, -50%)",
              padding: "4px 8px",
              background: "rgba(0, 0, 0, 0.6)",
              border: `1px solid ${node.angle < 140 ? "var(--neon-cyan)" : "var(--neon-purple)"}`,
              borderRadius: "4px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              backdropFilter: "blur(4px)",
              boxShadow: "0 0 10px rgba(0,0,0,0.5)",
              transition: "all 0.1s linear",
            }}
          >
            <span
              style={{
                fontSize: "0.6rem",
                color: "#aaa",
                letterSpacing: "1px",
              }}
            >
              {node.label}
            </span>
            <span
              style={{ fontSize: "0.85rem", color: "#fff", fontWeight: 800 }}
            >
              {node.angle}°
            </span>
          </div>
        ))}
      </div>
      {!hideControls && (
        <div
          style={{
            padding: "15px",
            background: "#222",
            display: "flex",
            alignItems: "center",
            gap: "15px",
            borderRadius: "8px",
            marginTop: "10px",
          }}
        >
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            style={{
              padding: "8px 16px",
              background: "var(--neon-purple, #9D4EDD)",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {isPlaying ? "PAUSE" : "PLAY"}
          </button>
          <input
            type="range"
            min="0"
            max={frames.length - 1}
            value={currentFrameIdx}
            onChange={(e) => {
              setIsPlaying(false);
              setCurrentFrameIdx(Number(e.target.value));
            }}
            style={{ flex: 1, cursor: "pointer" }}
          />
          <span
            style={{
              color: "#aaa",
              fontSize: "0.85rem",
              minWidth: "80px",
              textAlign: "right",
            }}
          >
            {currentFrameIdx} / {frames.length - 1}
          </span>
        </div>
      )}
    </div>
  );
};
