import { DefaultStrategy } from './DefaultStrategy';
import { getSupinationScore } from '../wristRotationDetector';

export class BicepCurlStrategy extends DefaultStrategy {
  constructor() {
    super(15); // Left Wrist
  }

  getWristSupinationScore(landmarks?: any[]): number {
    return getSupinationScore(landmarks);
  }
}
