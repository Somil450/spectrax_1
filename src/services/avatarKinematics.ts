import * as THREE from 'three';

export interface Keypoint3D {
  x: number;
  y: number;
  z?: number;
  score?: number;
  name?: string;
}

export interface SkeletonBoneTransforms {
  leftArmRotation: THREE.Euler;
  rightArmRotation: THREE.Euler;
  leftLegRotation: THREE.Euler;
  rightLegRotation: THREE.Euler;
  spineRotation: THREE.Euler;
}

/**
 * Calculates 3D joint rotations from keypoints to drive Three.js avatar bones.
 */
export class AvatarKinematicsEngine {
  calculateJointRotations(keypoints: Keypoint3D[]): SkeletonBoneTransforms {
    const defaultEuler = new THREE.Euler(0, 0, 0);

    if (!keypoints || keypoints.length < 15) {
      return {
        leftArmRotation: defaultEuler,
        rightArmRotation: defaultEuler,
        leftLegRotation: defaultEuler,
        rightLegRotation: defaultEuler,
        spineRotation: defaultEuler,
      };
    }

    // Keypoint indices for BlazePose (11: L Shoulder, 12: R Shoulder, 13: L Elbow, 14: R Elbow, 23: L Hip, 24: R Hip, 25: L Knee, 26: R Knee)
    const lShoulder = keypoints[11] || keypoints[5];
    const rShoulder = keypoints[12] || keypoints[6];
    const lElbow = keypoints[13] || keypoints[7];
    const rElbow = keypoints[14] || keypoints[8];

    const lHip = keypoints[23] || keypoints[11];
    const rHip = keypoints[24] || keypoints[12];
    const lKnee = keypoints[25] || keypoints[13];
    const rKnee = keypoints[26] || keypoints[14];

    const calculateAngle2D = (p1: Keypoint3D, p2: Keypoint3D): number => {
      if (!p1 || !p2) return 0;
      return Math.atan2(p2.y - p1.y, p2.x - p1.x);
    };

    // Calculate arm 3D angles
    const leftArmAngle = calculateAngle2D(lShoulder, lElbow);
    const rightArmAngle = calculateAngle2D(rShoulder, rElbow);

    // Calculate leg 3D angles
    const leftLegAngle = calculateAngle2D(lHip, lKnee);
    const rightLegAngle = calculateAngle2D(rHip, rKnee);

    return {
      leftArmRotation: new THREE.Euler(0, 0, leftArmAngle),
      rightArmRotation: new THREE.Euler(0, 0, rightArmAngle),
      leftLegRotation: new THREE.Euler(0, 0, leftLegAngle),
      rightLegRotation: new THREE.Euler(0, 0, rightLegAngle),
      spineRotation: new THREE.Euler(0, 0, 0),
    };
  }
}

export const avatarKinematicsEngine = new AvatarKinematicsEngine();
