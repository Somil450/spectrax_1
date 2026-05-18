import type { NormalizedLandmark } from '@mediapipe/pose';

export type PoseLandmarks = NormalizedLandmark[];

export interface JointAngles {
  knee?: number;
  elbow?: number;
  shoulder?: number;
  bodyLine?: number;
  hipDepth?: number;
  lateralScore?: number;
  horizontalStretch?: number;
  [key: string]: number | undefined;
}

export interface JointVisibility {
  knee?: number;
  elbow?: number;
  shoulder?: number;
  bodyLine?: number;
  hipDepth?: number;
  [key: string]: number | undefined;
}
