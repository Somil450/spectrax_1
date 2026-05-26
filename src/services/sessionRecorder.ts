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
  static compress(frames: FrameData[]): any[] {
    if (!frames || frames.length === 0) return [];
    const compressed: any[] = [];
    let prevFrame = frames[0];
    compressed.push({ ...prevFrame, runLength: 1 });

    for (let i = 1; i < frames.length; i++) {
      const currFrame = frames[i];
      if (this.isStationary(prevFrame, currFrame)) {
        compressed[compressed.length - 1].runLength++;
      } else {
        compressed.push({
          ...currFrame,
          timestampDelta: currFrame.timestamp - prevFrame.timestamp,
          runLength: 1,
        });
        prevFrame = currFrame;
      }
    }
    return compressed;
  }

  static decompress(compressedData: any[]): FrameData[] {
    const frames: FrameData[] = [];
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
  private compressedFrames: any[] = [];
  private _frameCount = 0;
  private lastRawFrame: FrameData | null = null;

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

    if (this.compressedFrames.length === 0) {
      this.compressedFrames.push({ ...frame, runLength: 1 });
      this._frameCount++;
      this.lastRawFrame = frame;
      return;
    }

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
      telemetryBroker.logEvent('SessionRecorder_Download_Completed');
    } catch (e: any) {
      telemetryBroker.logError(e, { context: 'SessionRecorder.download' });
    }
  }
}

export const sessionRecorder = new SessionRecorder();
