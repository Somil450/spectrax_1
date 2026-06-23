// src/services/multiPersonTracker.ts
import type { Results, NormalizedLandmarkList } from '@mediapipe/pose';

export interface TrackedPerson {
  id: string;
  landmarks: NormalizedLandmarkList;
  bbox: { x: number; y: number; width: number; height: number };
  centroid: { x: number; y: number };
  velocity: { x: number; y: number };
  area: number;
  confidence: number;
  landmarkHistory: NormalizedLandmarkList[];
  lastSeen: number;
  occlusionFrames: number;
  color: string;
}

interface KalmanState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
}

const PERSON_COLORS = [
  '#00f0ff', // Cyan
  '#ff3b5c', // Red
  '#9d4edd', // Purple
  '#ffd600', // Yellow
];

const MAX_TRACKED = 4;
const IOU_THRESHOLD = 0.3;
const MAX_OCCLUSION_FRAMES = 30;
const KALMAN_PROCESS_NOISE = 0.01;
const KALMAN_MEASUREMENT_NOISE = 0.1;

function calculateBbox(landmarks: NormalizedLandmarkList): { x: number; y: number; width: number; height: number } {
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (const lm of landmarks) {
    if (lm.visibility && lm.visibility > 0.3) {
      minX = Math.min(minX, lm.x);
      maxX = Math.max(maxX, lm.x);
      minY = Math.min(minY, lm.y);
      maxY = Math.max(maxY, lm.y);
    }
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

function calculateCentroid(landmarks: NormalizedLandmarkList): { x: number; y: number } {
  const coreIndices = [11, 12, 23, 24];
  let sumX = 0, sumY = 0, count = 0;
  for (const i of coreIndices) {
    if (landmarks[i] && landmarks[i].visibility && landmarks[i].visibility! > 0.3) {
      sumX += landmarks[i].x;
      sumY += landmarks[i].y;
      count++;
    }
  }
  return count > 0 ? { x: sumX / count, y: sumY / count } : { x: 0.5, y: 0.5 };
}

function calculateArea(landmarks: NormalizedLandmarkList): number {
  const bbox = calculateBbox(landmarks);
  return bbox.width * bbox.height;
}

function calculateIoU(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): number {
  const xLeft = Math.max(a.x, b.x);
  const yTop = Math.max(a.y, b.y);
  const xRight = Math.min(a.x + a.width, b.x + b.width);
  const yBottom = Math.min(a.y + a.height, b.y + b.height);
  if (xRight < xLeft || yBottom < yTop) return 0;
  const intersection = (xRight - xLeft) * (yBottom - yTop);
  const union = a.width * a.height + b.width * b.height - intersection;
  return union > 0 ? intersection / union : 0;
}

function kalmanPredict(state: KalmanState): KalmanState {
  return {
    x: state.x + state.vx,
    y: state.y + state.vy,
    vx: state.vx,
    vy: state.vy,
    width: state.width,
    height: state.height,
  };
}

function kalmanUpdate(predicted: KalmanState, measurement: { x: number; y: number; width: number; height: number }): KalmanState {
  const k = KALMAN_MEASUREMENT_NOISE / (KALMAN_MEASUREMENT_NOISE + KALMAN_PROCESS_NOISE);
  return {
    x: predicted.x + k * (measurement.x - predicted.x),
    y: predicted.y + k * (measurement.y - predicted.y),
    vx: predicted.vx + k * 0.1 * (measurement.x - predicted.x),
    vy: predicted.vy + k * 0.1 * (measurement.y - predicted.y),
    width: predicted.width + k * (measurement.width - predicted.width),
    height: predicted.height + k * (measurement.height - predicted.height),
  };
}

function extractMultiLandmarks(results: Results): NormalizedLandmarkList[] {
  // MediaPipe Pose returns single poseLandmarks. For multi-person, we need to
  // detect multiple people from the segmentation mask or use alternative methods.
  // Since MediaPipe Pose is single-person, we simulate multi-person by checking
  // if poseLandmarks has enough visible landmarks to be a valid person.
  if (!results.poseLandmarks || results.poseLandmarks.length === 0) return [];
  
  // Check if this is a valid single person detection
  const visibleCount = results.poseLandmarks.filter((lm: any) => lm.visibility && lm.visibility > 0.3).length;
  if (visibleCount < 15) return [];
  
  return [results.poseLandmarks];
}

export class MultiPersonTracker {
  private tracks: Map<string, TrackedPerson> = new Map();
  private nextId = 0;
  private kalmanStates: Map<string, KalmanState> = new Map();

  track(results: Results): TrackedPerson[] {
    const detections = extractMultiLandmarks(results);
    const now = Date.now();
    const matchedTrackIds = new Set<string>();
    const newTracks: TrackedPerson[] = [];

    // Predict existing tracks
    for (const [id, track] of this.tracks) {
      const kalman = this.kalmanStates.get(id);
      if (kalman) {
        const predicted = kalmanPredict(kalman);
        this.kalmanStates.set(id, predicted);
        track.bbox = {
          x: predicted.x - predicted.width / 2,
          y: predicted.y - predicted.height / 2,
          width: predicted.width,
          height: predicted.height,
        };
        track.centroid = { x: predicted.x, y: predicted.y };
      }
      track.occlusionFrames++;
    }

    // Hungarian matching via greedy IoU
    const unmatchedDetections: NormalizedLandmarkList[] = [];
    
    for (const landmarks of detections) {
      const bbox = calculateBbox(landmarks);
      const centroid = calculateCentroid(landmarks);
      let bestId: string | null = null;
      let bestIoU = IOU_THRESHOLD;

      for (const [id, track] of this.tracks) {
        if (matchedTrackIds.has(id)) continue;
        const iou = calculateIoU(bbox, track.bbox);
        if (iou > bestIoU) {
          bestIoU = iou;
          bestId = id;
        }
      }

      if (bestId) {
        matchedTrackIds.add(bestId);
        const track = this.tracks.get(bestId)!;
        const prevCentroid = { ...track.centroid };
        
        track.landmarks = landmarks;
        track.bbox = bbox;
        track.centroid = centroid;
        track.area = calculateArea(landmarks);
        track.confidence = this.calculateConfidence(landmarks);
        track.lastSeen = now;
        track.occlusionFrames = 0;
        
        // Update velocity
        track.velocity = {
          x: centroid.x - prevCentroid.x,
          y: centroid.y - prevCentroid.y,
        };
        
        // Update landmark history
        track.landmarkHistory.push(landmarks);
        if (track.landmarkHistory.length > 30) {
          track.landmarkHistory.shift();
        }

        // Update Kalman
        const kalman = this.kalmanStates.get(bestId)!;
        this.kalmanStates.set(bestId, kalmanUpdate(kalman, {
          x: centroid.x,
          y: centroid.y,
          width: bbox.width,
          height: bbox.height,
        }));

        newTracks.push(track);
      } else {
        unmatchedDetections.push(landmarks);
      }
    }

    // Create new tracks for unmatched detections
    for (const landmarks of unmatchedDetections) {
      if (this.tracks.size >= MAX_TRACKED) break;
      
      const id = `person_${this.nextId++}`;
      const bbox = calculateBbox(landmarks);
      const centroid = calculateCentroid(landmarks);
      const color = PERSON_COLORS[this.nextId % PERSON_COLORS.length];
      
      const track: TrackedPerson = {
        id,
        landmarks,
        bbox,
        centroid,
        velocity: { x: 0, y: 0 },
        area: calculateArea(landmarks),
        confidence: this.calculateConfidence(landmarks),
        landmarkHistory: [landmarks],
        lastSeen: now,
        occlusionFrames: 0,
        color,
      };
      
      this.tracks.set(id, track);
      this.kalmanStates.set(id, {
        x: centroid.x,
        y: centroid.y,
        vx: 0,
        vy: 0,
        width: bbox.width,
        height: bbox.height,
      });
      
      newTracks.push(track);
    }

    // Remove stale tracks
    for (const [id, track] of this.tracks) {
      if (track.occlusionFrames > MAX_OCCLUSION_FRAMES) {
        this.tracks.delete(id);
        this.kalmanStates.delete(id);
      }
    }

    return newTracks;
  }

  reset(): void {
    this.tracks.clear();
    this.kalmanStates.clear();
    this.nextId = 0;
  }

  private calculateConfidence(landmarks: NormalizedLandmarkList): number {
    const coreIndices = [11, 12, 23, 24, 25, 26];
    let sum = 0, count = 0;
    for (const i of coreIndices) {
      if (landmarks[i] && landmarks[i].visibility) {
        sum += landmarks[i].visibility!;
        count++;
      }
    }
    return count > 0 ? sum / count : 0;
  }

  getTrack(id: string): TrackedPerson | undefined {
    return this.tracks.get(id);
  }

  getAllTracks(): TrackedPerson[] {
    return Array.from(this.tracks.values());
  }
}

export const multiPersonTracker = new MultiPersonTracker();