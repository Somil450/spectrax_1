// =============================================================================
// Centralized Logging and Telemetry Broker
// Tracks application states, errors, and events — downloadable as JSON
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface FrameData {
  timestamp: number;
  landmarks: any[];
  angles: Record<string, number>;
  feedback: string;
  exercise: string;
}

export interface TelemetryEvent {
  timestamp: number;
  type: 'info' | 'error' | 'state_change';
  message: string;
  data?: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// RLD Compression Driver
// ─────────────────────────────────────────────────────────────────────────────

export class RLDCompressionDriver {
  static compress(frames: FrameData[]): CompressedFrameChunk[] {
    if (!frames || frames.length === 0) return [];
    const compressed: CompressedFrameChunk[] = [];
    let previousFrame: FrameData | null = frames[0];

    compressed.push(this.createChunk(null, frames[0]));

    for (let i = 1; i < frames.length; i++) {
      const currFrame = frames[i];
      if (previousFrame && this.isStationary(previousFrame, currFrame)) {
        compressed[compressed.length - 1].runLength++;
        compressed[compressed.length - 1].timestampDelta =
          currFrame.timestamp - previousFrame.timestamp;
      } else {
        compressed.push({
          ...currFrame,
          timestampDelta: currFrame.timestamp - prevFrame.timestamp,
          runLength: 1,
        });
        prevFrame = currFrame;
      }
      previousFrame = currFrame;
    }
    return compressed;
  }

  static decompress(compressedData: CompressedFrameChunk[]): FrameData[] {
    const frames: FrameData[] = [];
    let previousFrame: FrameData | null = null;

    for (const item of compressedData) {
      const { runLength, timestampDelta, ...frameBase } = item;
      let currentTimestamp = frameBase.timestamp;
      frames.push({ ...frameBase } as FrameData);
      for (let i = 1; i < runLength; i++) {
        currentTimestamp += timestampDelta || 33;
        frames.push({ ...frameBase, timestamp: currentTimestamp } as FrameData);
      }
    }
    return frames;
  }

  static isStationary(prev: FrameData, curr: FrameData): boolean {
    if (!prev || !curr) return false;
    if (prev.exercise !== curr.exercise || prev.feedback !== curr.feedback) return false;
    const angleThreshold = 2.0;
    for (const key in curr.angles) {
      if (Math.abs((curr.angles[key] || 0) - (prev.angles[key] || 0)) > angleThreshold) {
        return false;
      }
    }
    return true;
  }

  static createChunk(
    previousFrame: FrameData | null,
    currentFrame: FrameData,
  ): CompressedFrameChunk {
    if (!previousFrame) {
      return {
        kind: "base",
        timestamp: currentFrame.timestamp,
        timestampDelta: 0,
        runLength: 1,
        exercise: currentFrame.exercise,
        feedback: currentFrame.feedback,
        angles: this.normalizeAngles(currentFrame.angles),
        landmarks: this.normalizeLandmarks(currentFrame.landmarks),
      };
    }

    const angleDelta = this.getAngleDelta(
      previousFrame.angles,
      currentFrame.angles,
    );
    const landmarkDelta = this.getLandmarkDelta(
      previousFrame.landmarks,
      currentFrame.landmarks,
    );

    return {
      kind: "delta",
      timestamp: currentFrame.timestamp,
      timestampDelta: Math.max(
        currentFrame.timestamp - previousFrame.timestamp,
        0,
      ),
      runLength: 1,
      exercise:
        currentFrame.exercise === previousFrame.exercise
          ? undefined
          : currentFrame.exercise,
      feedback:
        currentFrame.feedback === previousFrame.feedback
          ? undefined
          : currentFrame.feedback,
      angles: Object.keys(angleDelta).length > 0 ? angleDelta : undefined,
      landmarks: landmarkDelta.length > 0 ? landmarkDelta : undefined,
    };
  }

  private static deserializeBaseChunk(chunk: CompressedFrameChunk): FrameData {
    return {
      timestamp: chunk.timestamp,
      landmarks: this.cloneLandmarks(chunk.landmarks || []),
      angles: { ...(chunk.angles || {}) },
      feedback: chunk.feedback || "",
      exercise: chunk.exercise || "workout",
    };
  }

  private static applyDelta(
    previousFrame: FrameData | null,
    chunk: CompressedFrameChunk,
  ): FrameData {
    if (!previousFrame) {
      return this.deserializeBaseChunk({
        ...chunk,
        kind: "base",
      });
    }

    const nextFrame: FrameData = {
      timestamp: chunk.timestamp,
      landmarks: this.cloneLandmarks(previousFrame.landmarks),
      angles: { ...previousFrame.angles },
      feedback: previousFrame.feedback,
      exercise: previousFrame.exercise,
    };

    if (chunk.exercise) nextFrame.exercise = chunk.exercise;
    if (chunk.feedback) nextFrame.feedback = chunk.feedback;

    if (chunk.angles) {
      for (const [key, value] of Object.entries(chunk.angles)) {
        nextFrame.angles[key] = this.roundNumber(
          (nextFrame.angles[key] || 0) + value,
        );
      }
    }

    if (chunk.landmarks) {
      for (const entry of chunk.landmarks as CompressedLandmarkDelta[]) {
        const baseLandmark = this.ensureLandmark(
          nextFrame.landmarks,
          entry.index,
        );
        for (const [coordinate, delta] of Object.entries(entry.values)) {
          baseLandmark[coordinate] = this.roundNumber(
            (baseLandmark[coordinate] || 0) + delta,
          );
        }
      }
    }

    return nextFrame;
  }

  private static getAngleDelta(
    previousAngles: Record<string, number>,
    currentAngles: Record<string, number>,
  ): Record<string, number> {
    const delta: Record<string, number> = {};
    const keys = new Set([
      ...Object.keys(previousAngles || {}),
      ...Object.keys(currentAngles || {}),
    ]);

    for (const key of keys) {
      const prevValue = previousAngles?.[key] || 0;
      const currValue = currentAngles?.[key] || 0;
      const diff = currValue - prevValue;
      if (Math.abs(diff) > ANGLE_THRESHOLD) {
        delta[key] = this.roundNumber(diff);
      }
    }

    return delta;
  }

  private static getLandmarkDelta(
    previousLandmarks: any[],
    currentLandmarks: any[],
  ): CompressedLandmarkDelta[] {
    const delta: CompressedLandmarkDelta[] = [];
    const length = Math.max(
      previousLandmarks?.length || 0,
      currentLandmarks?.length || 0,
    );

    for (let index = 0; index < length; index++) {
      const prevLandmark = previousLandmarks?.[index] || {};
      const currLandmark = currentLandmarks?.[index] || {};
      const values: Partial<Record<LandmarkCoordinate, number>> = {};

      for (const coordinate of [
        "x",
        "y",
        "z",
        "visibility",
      ] as LandmarkCoordinate[]) {
        const prevValue =
          typeof prevLandmark[coordinate] === "number"
            ? prevLandmark[coordinate]
            : 0;
        const currValue =
          typeof currLandmark[coordinate] === "number"
            ? currLandmark[coordinate]
            : 0;
        const diff = currValue - prevValue;

        if (Math.abs(diff) > LANDMARK_THRESHOLD) {
          values[coordinate] = this.roundNumber(diff);
        }
      }

      if (Object.keys(values).length > 0) {
        delta.push({ index, values });
      }
    }

    return delta;
  }

  private static normalizeAngles(
    angles: Record<string, number>,
  ): Record<string, number> {
    const normalized: Record<string, number> = {};
    for (const [key, value] of Object.entries(angles || {})) {
      normalized[key] = this.roundNumber(value);
    }
    return normalized;
  }

  private static normalizeLandmarks(landmarks: any[]): any[] {
    return (landmarks || []).map((landmark) => ({
      x: this.roundNumber(landmark?.x || 0),
      y: this.roundNumber(landmark?.y || 0),
      z: this.roundNumber(landmark?.z || 0),
      visibility: this.roundNumber(landmark?.visibility || 0),
    }));
  }

  private static ensureLandmark(landmarks: any[], index: number) {
    while (landmarks.length <= index) {
      landmarks.push({ x: 0, y: 0, z: 0, visibility: 0 });
    }
    return landmarks[index];
  }

  private static cloneLandmarks(landmarks: any[]): any[] {
    return (landmarks || []).map((landmark) => ({ ...landmark }));
  }

  private static roundNumber(value: number) {
    return Number((value || 0).toFixed(FLOAT_PRECISION));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Telemetry Broker — defined FIRST so SessionRecorder can reference it
// ─────────────────────────────────────────────────────────────────────────────

class TelemetryBroker {
  private logs: TelemetryEvent[] = [];
  private static MAX_LOGS = 1000;

  constructor() {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (event) => {
      this.logError(`Uncaught Error: ${event.message}`, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.logError(`Unhandled Promise Rejection: ${String(event.reason)}`);
    });
  }

  logState(stateName: string, data?: any) {
    this._addLog({
      timestamp: Date.now(),
      type: 'state_change',
      message: `State changed to ${stateName}`,
      data,
    });
  }

  logEvent(message: string, data?: any) {
    this._addLog({
      timestamp: Date.now(),
      type: 'info',
      message,
      data,
    });
  }

  logError(error: Error | string, context?: any) {
    const message = error instanceof Error ? error.message : error;
    const stack = error instanceof Error ? error.stack : undefined;
    this._addLog({
      timestamp: Date.now(),
      type: 'error',
      message,
      data: { ...context, stack },
    });
  }

  private _addLog(event: TelemetryEvent) {
    if (this.logs.length >= TelemetryBroker.MAX_LOGS) {
      this.logs.shift();
    }
    this.logs.push(event);
  }

  getLogs(): TelemetryEvent[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }

  downloadLogs() {
    if (this.logs.length === 0) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `spectrax_telemetry_${timestamp}.json`;
    const blob = new Blob([JSON.stringify(this.logs, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const telemetryBroker = new TelemetryBroker();

// ─────────────────────────────────────────────────────────────────────────────
// Session Recorder — uses telemetryBroker (safe: defined above)
// ─────────────────────────────────────────────────────────────────────────────

const MAX_FRAMES = 300;

class SessionRecorder {
  private compressedFrames: CompressedFrameChunk[] = [];
  private _frameCount = 0;
  private lastRawFrame: FrameData | null = null;

  private lastCentroid: { x: number; y: number } | null = null;
  private displacements: number[] = [];

  start() {
    this.compressedFrames = [];
    this._frameCount = 0;
    this.lastRawFrame = null;
    telemetryBroker.logState('SessionRecorder_Start');
  }

  recordFrame(frame: FrameData) {
    if (this._frameCount >= MAX_FRAMES) {
      const first = this.compressedFrames[0];
      if (first && first.runLength > 1) {
        first.runLength--;
        first.timestamp += first.timestampDelta || 33;
      } else {
        this.compressedFrames.shift();
      }
      this._frameCount--;
    }
    this._frameCount--;

    if (this.displacements.length >= MAX_FRAMES - 1) {
      this.displacements.shift();
    }
  }

  const centroid = this.getCentroid(frame.landmarks);
  if (centroid && this.lastCentroid) {
    const dx = centroid.x - this.lastCentroid.x;
    const dy = centroid.y - this.lastCentroid.y;
    const distance = Math.hypot(dx, dy);
    this.displacements.push(distance);
  }
  this.lastCentroid = centroid;

  const lastCompressed =
      this.compressedFrames[this.compressedFrames.length - 1];

    const last = this.compressedFrames[this.compressedFrames.length - 1];
    if (this.lastRawFrame && RLDCompressionDriver.isStationary(this.lastRawFrame, frame)) {
      last.runLength++;
    } else {
      this.compressedFrames.push({
        ...frame,
        timestampDelta: this.lastRawFrame ? frame.timestamp - this.lastRawFrame.timestamp : 33,
        runLength: 1,
      });
    }

    this.lastRawFrame = frame;
    this._frameCount++;
  }

  get frames(): FrameData[] {
    return RLDCompressionDriver.decompress(this.compressedFrames);
  }

  get frameCount(): number {
    return this._frameCount;
  }

  getArchive(): SessionArchive {
    return {
      codec: "rld-delta-v1",
      frameCount: this._frameCount,
      generatedAt: Date.now(),
      frames: [...this.compressedFrames],
    };
  }

  loadArchive(archive: SessionArchive) {
    this.start();
    if (
      !archive ||
      archive.codec !== "rld-delta-v1" ||
      !Array.isArray(archive.frames)
    ) {
      return;
    }

    this.compressedFrames = [...archive.frames];
    this._frameCount =
      typeof archive.frameCount === "number"
        ? archive.frameCount
        : RLDCompressionDriver.decompress(this.compressedFrames).length;
    this.lastRawFrame = this.frames[this.frames.length - 1] || null;
  }

  private getCentroid(landmarks: any[]) {
    if (!landmarks || landmarks.length === 0) return null;

    let x = 0;
    let y = 0;

    for (const p of landmarks) {
      x += p.x;
      y += p.y;
    }

    return {
      x: x / landmarks.length,
      y: y / landmarks.length,
    };
  }

  getStabilityReport() {
    if (this.displacements.length === 0) {
      return {
        stabilityScore: 100,
        avgDrift: 0,
        maxDrift: 0,
        status: "Stable",
        hasMovementData: false,
      };
    }
    const sum = this.displacements.reduce((a, b) => a + b, 0);
    const avg = sum / this.displacements.length;
    const max = Math.max(...this.displacements);

    // Simple scoring model (you can improve later)
    const stabilityScore = Math.max(0, 100 - avg * 10);

    let status = "Stable";
    if (avg > 5) status = "Unstable";
    else if (avg > 2) status = "Moderate";

    return {
      stabilityScore: Math.round(stabilityScore),
      avgDrift: Number(avg.toFixed(3)),
      maxDrift: Number(max.toFixed(3)),
      status,
      hasMovementData: true,
    };
  }

  download() {
    const frames = this.frames;
    if (frames.length === 0) {
      telemetryBroker.logEvent('SessionRecorder_Download_Empty');
      return;
    }

    telemetryBroker.logEvent('SessionRecorder_Download_Started', {
      frameCount: frames.length,
    });

    const exercise = frames[0]?.exercise || 'workout';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `spectrax_session_${exercise}_${timestamp}.json`;

    try {
      const blob = new Blob([JSON.stringify(frames)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      telemetryBroker.logEvent("SessionRecorder_Download_Completed");
    } catch (e: any) {
      telemetryBroker.logError(e, { context: "SessionRecorder.download" });
    }
  }
}

export const sessionRecorder = new SessionRecorder();
