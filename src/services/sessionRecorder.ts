export interface FrameData {
  timestamp: number;
  landmarks: any[];
  angles: Record<string, number>;
  feedback: string;
  exercise: string;
}

const MAX_FRAMES = 300; // Rolling buffer — ~20s at 15 FPS

class SessionRecorder {
  public frames: FrameData[] = [];

  start() {
    this.frames = [];
    telemetryBroker.logState('SessionRecorder_Start');
  }

  recordFrame(frame: FrameData) {
    // Rolling buffer: drop oldest when full
    if (this.frames.length >= MAX_FRAMES) {
      this.frames.shift();
    }
    this.frames.push(frame);
  }

  get frameCount(): number {
    return this.frames.length;
  }

  download() {
    if (this.frames.length === 0) {
      telemetryBroker.logEvent('SessionRecorder_Download_Empty');
      return;
    }
    
    telemetryBroker.logEvent('SessionRecorder_Download_Started', { frameCount: this.frames.length });
    const exercise = this.frames[0]?.exercise || 'workout';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `spectrax_session_${exercise}_${timestamp}.json`;
    
    // Lightweight serialization — no deep copy
    try {
      const blob = new Blob([JSON.stringify(this.frames)], { type: 'application/json' });
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

// -----------------------------------------------------------------------------
// Centralized Logging and Telemetry Broker
// -----------------------------------------------------------------------------

export interface TelemetryEvent {
  timestamp: number;
  type: 'info' | 'error' | 'state_change';
  message: string;
  data?: any;
}

class TelemetryBroker {
  private logs: TelemetryEvent[] = [];
  private static MAX_LOGS = 1000;

  constructor() {
    if (typeof window !== 'undefined') {
      // Global unhandled error tracking
      window.addEventListener('error', (event) => {
        this.logError(`Uncaught Error: ${event.message}`, {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error ? event.error.stack : undefined
        });
      });

      // Global unhandled promise rejection tracking
      window.addEventListener('unhandledrejection', (event) => {
        this.logError(`Unhandled Promise Rejection: ${event.reason}`);
      });
    }
  }

  logState(stateName: string, data?: any) {
    this._addLog({
      timestamp: Date.now(),
      type: 'state_change',
      message: `State changed to ${stateName}`,
      data
    });
  }

  logEvent(message: string, data?: any) {
    this._addLog({
      timestamp: Date.now(),
      type: 'info',
      message,
      data
    });
  }

  logError(error: Error | string, context?: any) {
    const message = error instanceof Error ? error.message : error;
    const stack = error instanceof Error ? error.stack : undefined;
    
    this._addLog({
      timestamp: Date.now(),
      type: 'error',
      message,
      data: { ...context, stack }
    });
  }

  private _addLog(event: TelemetryEvent) {
    if (this.logs.length >= TelemetryBroker.MAX_LOGS) {
      this.logs.shift(); // Evict oldest telemetry data
    }
    this.logs.push(event);
  }

  getLogs() {
    return [...this.logs];
  }

  downloadLogs() {
    if (this.logs.length === 0) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `spectrax_telemetry_${timestamp}.json`;
    
    // Formatting with 2 spaces for readability in error tracking and diagnostics
    const blob = new Blob([JSON.stringify(this.logs, null, 2)], { type: 'application/json' });
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
