import { Results, NormalizedLandmarkList } from '@mediapipe/pose';

/**
 * poseLockService.ts
 * Ensures the system stays focused on a single user by tracking spatial continuity.
 * Prevents erratic tracking when multiple people are in the frame.
 */

export class PoseLockService {
  
  private lastCentroid: { x: number, y: number } | null = null;
  private lastArea: number | null = null;
  private isLocked = false;
  private readonly MOVEMENT_THRESHOLD = 0.25;
  private readonly MOVEMENT_RELEASE_THRESHOLD = 0.35;
  private readonly SCALE_THRESHOLD = 0.40;
  private readonly SCALE_RELEASE_THRESHOLD = 0.55;
  private readonly LOCK_THRESHOLD = 0.7;
  private readonly UNLOCK_THRESHOLD = 0.4;
  private readonly UNLOCK_TIME_THRESHOLD = 2000;
  private lastSeenTime = 0;
  private confidenceHistory: number[] = [];
  private readonly CONFIDENCE_WINDOW = 5;

  /**
   * Evaluates if the current pose results belong to the "locked" user.
   * If not locked, it will lock onto the first high-confidence pose detected.
   */
  filter(results: Results): Results | null {
    if (!results.poseLandmarks) {
      if (Date.now() - this.lastSeenTime > this.UNLOCK_TIME_THRESHOLD) {
        this.reset();
      }
      return results;
    }

    const currentCentroid = this.calculateCentroid(results.poseLandmarks);
    const currentArea = this.calculateArea(results.poseLandmarks);
    const now = Date.now();

    const rawConfidence = this.calculateAvgConfidence(results.poseLandmarks);
    const smoothedConfidence = this.smoothedConfidence(rawConfidence);

    // 1. Initial Locking — requires high confidence to acquire
    if (!this.isLocked) {
      if (smoothedConfidence > this.LOCK_THRESHOLD) {
        this.lastCentroid = currentCentroid;
        this.lastArea = currentArea;
        this.isLocked = true;
        this.lastSeenTime = now;
        return results;
      }
      return null;
    }

    // 2. Confidence release check — requires very low confidence to release
    if (smoothedConfidence < this.UNLOCK_THRESHOLD) {
      this.reset();
      return null;
    }

    // 3. Continuity check — use more forgiving thresholds while locked
    if (this.lastCentroid && this.lastArea !== null) {
      const distance = Math.sqrt(
        Math.pow(currentCentroid.x - this.lastCentroid.x, 2) +
        Math.pow(currentCentroid.y - this.lastCentroid.y, 2)
      );

      const areaChange = Math.abs(currentArea - this.lastArea) / (this.lastArea || 1);

      if (distance > this.MOVEMENT_RELEASE_THRESHOLD || areaChange > this.SCALE_RELEASE_THRESHOLD) {
        this.reset();
        return null;
      }
    }

    // 4. Update state
    this.lastCentroid = currentCentroid;
    this.lastArea = currentArea;
    this.lastSeenTime = now;
    return results;
  }

  reset() {
    this.isLocked = false;
    this.lastCentroid = null;
    this.lastArea = null;
    this.lastSeenTime = 0;
    this.confidenceHistory = [];
  }

  private smoothedConfidence(raw: number): number {
    this.confidenceHistory.push(raw);
    if (this.confidenceHistory.length > this.CONFIDENCE_WINDOW) {
      this.confidenceHistory.shift();
    }
    const sorted = [...this.confidenceHistory].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private calculateCentroid(landmarks: NormalizedLandmarkList) {
    // We use shoulders and hips to calculate a stable center of gravity
    // Indices: 11, 12 (shoulders), 23, 24 (hips)
    const points = [11, 12, 23, 24];
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (const i of points) {
      if (landmarks[i]) {
        sumX += landmarks[i].x;
        sumY += landmarks[i].y;
        count++;
      }
    }

    return count > 0 
      ? { x: sumX / count, y: sumY / count } 
      : { x: 0.5, y: 0.5 };
  }

  private calculateAvgConfidence(landmarks: NormalizedLandmarkList) {
    const points = [11, 12, 23, 24, 25, 26]; // Core joints
    let sum = 0;
    let count = 0;

    for (const i of points) {
      if (landmarks[i]) {
        sum += (landmarks[i] as any).visibility || 0;
        count++;
      }
    }

    return count > 0 ? sum / count : 0;
  }

  private calculateArea(landmarks: NormalizedLandmarkList) {
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    const points = [11, 12, 23, 24, 25, 26, 27, 28, 0]; // Head, shoulders, hips, knees, ankles

    for (const i of points) {
      if (landmarks[i]) {
        minX = Math.min(minX, landmarks[i].x);
        maxX = Math.max(maxX, landmarks[i].x);
        minY = Math.min(minY, landmarks[i].y);
        maxY = Math.max(maxY, landmarks[i].y);
      }
    }
    
    return Math.max(0, (maxX - minX) * (maxY - minY));
  }
}

export const poseLockService = new PoseLockService();
