import { describe, it, expect } from 'vitest';
import { avatarKinematicsEngine, Keypoint3D } from '../avatarKinematics';

describe('AvatarKinematicsEngine', () => {
  it('handles empty keypoint array gracefully without throwing', () => {
    const rotations = avatarKinematicsEngine.calculateJointRotations([]);
    expect(rotations).toHaveProperty('leftArmRotation');
    expect(rotations).toHaveProperty('rightArmRotation');
    expect(rotations).toHaveProperty('leftLegRotation');
    expect(rotations).toHaveProperty('rightLegRotation');
  });

  it('computes 3D Euler angles for valid keypoint inputs', () => {
    const keypoints: Keypoint3D[] = new Array(33).fill(null).map((_, i) => ({
      x: i * 10,
      y: i * 15,
      z: 0,
    }));

    const rotations = avatarKinematicsEngine.calculateJointRotations(keypoints);
    expect(typeof rotations.leftArmRotation.z).toBe('number');
    expect(typeof rotations.rightArmRotation.z).toBe('number');
    expect(Number.isNaN(rotations.leftArmRotation.z)).toBe(false);
  });
});
