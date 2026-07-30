import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AVATAR_SKINS, AvatarSkinType, createBaseMaterialForSkin } from '../../utils/avatarSkins';
import { avatarKinematicsEngine, Keypoint3D } from '../../services/avatarKinematics';
import './AvatarView.css';

interface AvatarViewProps {
  keypoints?: Keypoint3D[];
  width?: number;
  height?: number;
}

export const AvatarView: React.FC<AvatarViewProps> = ({
  keypoints = [],
  width = 400,
  height = 500,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedSkin, setSelectedSkin] = useState<AvatarSkinType>(AVATAR_SKINS.CYBERPUNK_NEON);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const avatarGroupRef = useRef<THREE.Group | null>(null);
  const jointsRef = useRef<{ [key: string]: THREE.Mesh }>({});

  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Setup Three.js Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0b0f19);

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 4);

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;

    mountRef.current.appendChild(renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.5);
    dirLight.position.set(2, 4, 3);
    scene.add(dirLight);

    // 5. Construct 3D Mannequin Avatar Group
    const avatarGroup = new THREE.Group();
    avatarGroupRef.current = avatarGroup;
    scene.add(avatarGroup);

    const material = createBaseMaterialForSkin(selectedSkin);

    // Head
    const headGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const headMesh = new THREE.Mesh(headGeo, material);
    headMesh.position.set(0, 1.1, 0);
    avatarGroup.add(headMesh);

    // Torso
    const torsoGeo = new THREE.CylinderGeometry(0.22, 0.18, 0.7, 16);
    const torsoMesh = new THREE.Mesh(torsoGeo, material);
    torsoMesh.position.set(0, 0.5, 0);
    avatarGroup.add(torsoMesh);

    // Shoulders & Arms
    const jointGeo = new THREE.SphereGeometry(0.08, 12, 12);
    const limbGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.4, 12);

    // Left Arm Mesh Group
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.3, 0.7, 0);
    const leftArmMesh = new THREE.Mesh(limbGeo, material);
    leftArmMesh.position.set(0, -0.2, 0);
    leftArmGroup.add(leftArmMesh);
    avatarGroup.add(leftArmGroup);
    jointsRef.current['leftArm'] = leftArmGroup as any;

    // Right Arm Mesh Group
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.3, 0.7, 0);
    const rightArmMesh = new THREE.Mesh(limbGeo, material);
    rightArmMesh.position.set(0, -0.2, 0);
    rightArmGroup.add(rightArmMesh);
    avatarGroup.add(rightArmGroup);
    jointsRef.current['rightArm'] = rightArmGroup as any;

    // 6. Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (rendererRef.current && sceneRef.current) {
        rendererRef.current.render(sceneRef.current, camera);
      }
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (rendererRef.current && mountRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, [width, height]);

  // Update skin material when skin selection changes
  useEffect(() => {
    if (!avatarGroupRef.current) return;
    const newMat = createBaseMaterialForSkin(selectedSkin);
    avatarGroupRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = newMat;
      }
    });
  }, [selectedSkin]);

  // Update bone rotations in real-time based on incoming 3D pose keypoints
  useEffect(() => {
    if (keypoints && keypoints.length > 0 && jointsRef.current['leftArm']) {
      const rotations = avatarKinematicsEngine.calculateJointRotations(keypoints);
      jointsRef.current['leftArm'].rotation.copy(rotations.leftArmRotation);
      jointsRef.current['rightArm'].rotation.copy(rotations.rightArmRotation);
    }
  }, [keypoints]);

  return (
    <div className="avatar-view-container">
      <div className="avatar-controls">
        <label className="skin-label">🎮 3D Avatar Skin:</label>
        <select
          value={selectedSkin}
          onChange={(e) => setSelectedSkin(e.target.value as AvatarSkinType)}
        >
          {Object.values(AVATAR_SKINS).map((skin) => (
            <option key={skin} value={skin}>
              {skin}
            </option>
          ))}
        </select>
      </div>

      <div ref={mountRef} className="three-canvas-viewport" />
    </div>
  );
};
