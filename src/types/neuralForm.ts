/**
 * Neural Form Scoring — Type Definitions
 * Issue #749: On-Device Neural Form Scoring
 */

import type { BodyType } from '../services/bodyTypeEngine';

export const EXERCISE_KEYS = [
  'squat',
  'pushup',
  'bicepCurl',
  'jumpingJack',
  'plank',
  'lunge',
  'flutterKicks',
  'shoulderPress',
  'chestPressPunches',
] as const;

export type NeuralExerciseKey = typeof EXERCISE_KEYS[number];

export interface NeuralFormFeatures {
  landmarks: any[];
  angles: Record<string, number>;
  bodyType: BodyType;
  exerciseKey: string;
  stage: 'up' | 'down';
  repCount: number;
  repScores: number[];
  adaptiveFactor: number;
  downAngleReached: number;
  wristSupinationScore?: number;
}

export interface NeuralFormPrediction {
  depthScore: number;
  postureScore: number;
  romScore: number;
  stabilityScore: number;
  overallScore: number;
}

export interface CalibrationData {
  exerciseKey: string;
  features: number[][];
  targets: number[][];
}