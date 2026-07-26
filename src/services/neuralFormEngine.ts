/**
 * Neural Form Engine — 3-layer MLP (40 → 64 → 64 → 5)
 * Issue #749: On-Device Neural Form Scoring
 *
 * Transfer-learning flow:
 *   1. Create baseline architecture (or load user fine-tuned weights from IndexedDB)
 *   2. During first 10 reps per exercise: collect (features, rule-based targets)
 *   3. After 10 reps: fine-tune model with 30 epochs, save back to IndexedDB
 *   4. Post-calibration: inference replaces rule-based feedback
 */

import * as tf from '@tensorflow/tfjs';

import type { FeedbackResult } from '../engine/feedbackEngine';
import type { NeuralFormFeatures, NeuralFormPrediction } from '../types/neuralForm';
import { EXERCISE_KEYS } from '../types/neuralForm';
import { neuralFormStorage } from './neuralFormStorage';

const INPUT_DIM = 40;
const HIDDEN_UNITS = 64;
const OUTPUT_DIM = 5;
const CALIBRATION_REPS = 10;
const MAX_CALIBRATION_SAMPLES = 300;

export class NeuralFormEngine {
  private model: tf.LayersModel | null = null;
  private userId: string | null = null;
  private calibrationData: Map<string, { features: number[][]; targets: number[][] }> = new Map();
  private calibratedExercises: Set<string> = new Set();
  private initialized = false;

  async init(userId?: string): Promise<void> {
    if (this.initialized) return;
    this.userId = userId || 'anonymous';

    await tf.ready();

    const loadedModel = await neuralFormStorage.loadModel(this.userId);
    if (loadedModel) {
      this.model = loadedModel;
      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError',
        metrics: ['mse'],
      });
    } else {
      await this.createBaselineModel();
    }

    const calibrated = neuralFormStorage.loadCalibratedExercises(this.userId);
    this.calibratedExercises = new Set(calibrated);
    this.initialized = true;
  }

  private async createBaselineModel(): Promise<void> {
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [INPUT_DIM],
          units: HIDDEN_UNITS,
          activation: 'relu',
          kernelInitializer: 'glorotUniform',
          name: 'hidden_1',
        }),
        tf.layers.dense({
          units: HIDDEN_UNITS,
          activation: 'relu',
          kernelInitializer: 'glorotUniform',
          name: 'hidden_2',
        }),
        tf.layers.dense({
          units: OUTPUT_DIM,
          activation: 'sigmoid',
          kernelInitializer: 'glorotUniform',
          name: 'output',
        }),
      ],
    });

    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mse'],
    });
  }

  isCalibrated(exerciseKey: string): boolean {
    return this.calibratedExercises.has(exerciseKey);
  }

  getCalibrationProgress(exerciseKey: string): number {
    const data = this.calibrationData.get(exerciseKey);
    if (!data) return 0;
    return Math.min(Math.floor(data.features.length / 30), CALIBRATION_REPS);
  }

  extractFeatures(params: NeuralFormFeatures): Float32Array {
    const features = new Float32Array(INPUT_DIM);
    let idx = 0;

    const {
      landmarks,
      angles,
      bodyType,
      exerciseKey,
      stage,
      repCount,
      repScores,
      adaptiveFactor,
      downAngleReached,
    } = params;

    const torsoLength = this.computeTorsoLength(landmarks);
    const hipMid = this.computeHipMidpoint(landmarks);

    const keyIndices = [0, 11, 12, 23, 24, 25, 26];
    for (const i of keyIndices) {
      if (landmarks[i] && landmarks[i].visibility > 0.5) {
        features[idx++] = (landmarks[i].x - hipMid.x) / torsoLength;
        features[idx++] = (landmarks[i].y - hipMid.y) / torsoLength;
      } else {
        features[idx++] = 0;
        features[idx++] = 0;
      }
    }

    const angleKeys = ['knee', 'hip', 'elbow', 'shoulder', 'bodyLine', 'lateralScore', 'horizontalStretch', 'downAngleReached'];
    for (const key of angleKeys) {
      const val = key === 'downAngleReached' ? downAngleReached : (angles[key] || 0);
      features[idx++] = Math.min(Math.max(val / 180, 0), 1);
    }

    features[idx++] = bodyType === 'ecto' ? 1 : 0;
    features[idx++] = bodyType === 'meso' ? 1 : 0;
    features[idx++] = bodyType === 'endo' ? 1 : 0;

    for (const key of EXERCISE_KEYS) {
      features[idx++] = key === exerciseKey ? 1 : 0;
    }

    const lastScores = repScores.slice(-3);
    for (let i = 0; i < 3; i++) {
      features[idx++] = i < lastScores.length ? lastScores[i] / 100 : 0;
    }

    features[idx++] = stage === 'down' ? 1 : 0;
    features[idx++] = Math.min(repCount / 100, 1);
    features[idx++] = adaptiveFactor;

    while (idx < INPUT_DIM) {
      features[idx++] = 0;
    }

    return features;
  }

  private computeTorsoLength(landmarks: any[]): number {
    if (!landmarks[11] || !landmarks[12] || !landmarks[23] || !landmarks[24]) return 1;
    const shoulderMid = {
      x: (landmarks[11].x + landmarks[12].x) / 2,
      y: (landmarks[11].y + landmarks[12].y) / 2,
    };
    const hipMid = {
      x: (landmarks[23].x + landmarks[24].x) / 2,
      y: (landmarks[23].y + landmarks[24].y) / 2,
    };
    const dx = shoulderMid.x - hipMid.x;
    const dy = shoulderMid.y - hipMid.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    return len > 0.001 ? len : 1;
  }

  private computeHipMidpoint(landmarks: any[]): { x: number; y: number } {
    if (!landmarks[23] || !landmarks[24]) return { x: 0.5, y: 0.5 };
    return {
      x: (landmarks[23].x + landmarks[24].x) / 2,
      y: (landmarks[23].y + landmarks[24].y) / 2,
    };
  }

  addTrainingSample(exerciseKey: string, features: Float32Array, feedbackResult: FeedbackResult): void {
    if (this.calibratedExercises.has(exerciseKey)) return;

    if (!this.calibrationData.has(exerciseKey)) {
      this.calibrationData.set(exerciseKey, { features: [], targets: [] });
    }

    const data = this.calibrationData.get(exerciseKey)!;
    if (data.features.length >= MAX_CALIBRATION_SAMPLES) return;

    const targets = this.deriveTargets(feedbackResult);
    data.features.push(Array.from(features));
    data.targets.push(targets);
  }

  private deriveTargets(feedback: FeedbackResult): number[] {
    const overall = feedback.score / 100;
    let depthPenalty = 0;
    let posturePenalty = 0;
    let romPenalty = 0;
    let stabilityPenalty = 0;

    for (const issue of feedback.issues) {
      const penalty = issue.penalty / 100;
      const type = issue.type.toLowerCase();

      if (type.includes('depth') || type.includes('squeeze') || type.includes('back_knee')) {
        depthPenalty += penalty;
      } else if (
        type.includes('posture') ||
        type.includes('orientation') ||
        type.includes('hips') ||
        type.includes('hip') ||
        type.includes('elbow') ||
        type.includes('knee_alignment') ||
        type.includes('knees')
      ) {
        posturePenalty += penalty;
      } else if (type.includes('stretch') || type.includes('range') || type.includes('knee_bend')) {
        romPenalty += penalty;
      } else if (type.includes('wrist') || type.includes('stability')) {
        stabilityPenalty += penalty;
      } else {
        posturePenalty += penalty;
      }
    }

    return [
      Math.max(0, 1 - depthPenalty),
      Math.max(0, 1 - posturePenalty),
      Math.max(0, 1 - romPenalty),
      Math.max(0, 1 - stabilityPenalty),
      overall,
    ];
  }

  async calibrate(exerciseKey: string): Promise<void> {
    const data = this.calibrationData.get(exerciseKey);
    if (!data || data.features.length < 10) return;
    if (!this.model) return;

    const xs = tf.tensor2d(data.features);
    const ys = tf.tensor2d(data.targets);

    await this.model.fit(xs, ys, {
      epochs: 30,
      batchSize: Math.min(8, data.features.length),
      verbose: 0,
      shuffle: true,
    });

    xs.dispose();
    ys.dispose();

    this.calibratedExercises.add(exerciseKey);

    if (this.userId) {
      await neuralFormStorage.saveModel(this.model, this.userId);
      neuralFormStorage.saveCalibratedExercises(this.userId, Array.from(this.calibratedExercises));
    }

    this.calibrationData.delete(exerciseKey);
  }

  predict(features: Float32Array): NeuralFormPrediction {
    if (!this.model) {
      return {
        depthScore: 1,
        postureScore: 1,
        romScore: 1,
        stabilityScore: 1,
        overallScore: 1,
      };
    }

    const input = tf.tensor2d([Array.from(features)]);
    const output = this.model.predict(input) as tf.Tensor;
    const scores = output.dataSync() as Float32Array;

    input.dispose();
    output.dispose();

    return {
      depthScore: scores[0],
      postureScore: scores[1],
      romScore: scores[2],
      stabilityScore: scores[3],
      overallScore: scores[4],
    };
  }

  reset(): void {
    this.calibrationData.clear();
    this.calibratedExercises.clear();
    this.initialized = false;
    this.model = null;
    this.userId = null;
  }
}

export const neuralFormEngine = new NeuralFormEngine();