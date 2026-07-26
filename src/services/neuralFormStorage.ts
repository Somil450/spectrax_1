/**
 * Neural Form Storage — IndexedDB persistence via tfjs-io handler
 * Issue #749: On-Device Neural Form Scoring
 */

import * as tf from '@tensorflow/tfjs';

const MODEL_PREFIX = 'spectrax-neural-form';
const CALIBRATION_KEY = 'spectrax-neural-calibrated';

export class NeuralFormStorage {
  async saveModel(model: tf.LayersModel, userId: string): Promise<void> {
    await model.save(`indexeddb://${MODEL_PREFIX}-${userId}`);
  }

  async loadModel(userId: string): Promise<tf.LayersModel | null> {
    try {
      return await tf.loadLayersModel(`indexeddb://${MODEL_PREFIX}-${userId}`);
    } catch {
      return null;
    }
  }

  saveCalibratedExercises(userId: string, exercises: string[]): void {
    localStorage.setItem(`${CALIBRATION_KEY}-${userId}`, JSON.stringify(exercises));
  }

  loadCalibratedExercises(userId: string): string[] {
    try {
      const data = localStorage.getItem(`${CALIBRATION_KEY}-${userId}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  clearUserData(userId: string): void {
    localStorage.removeItem(`${CALIBRATION_KEY}-${userId}`);
  }
}

export const neuralFormStorage = new NeuralFormStorage();