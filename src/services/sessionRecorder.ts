export interface FrameData {
  timestamp: number;
  landmarks: any[];
  angles: Record<string, number>;
  feedback: string;
  exercise: string;
  reps?: number;
}

const MAX_FRAMES = 300; // Rolling buffer — ~20s at 15 FPS

class SessionRecorder {
  public frames: FrameData[] = [];

  start() {
    this.frames = [];
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
    if (this.frames.length === 0) return;
    
    const exercise = this.frames[0]?.exercise || 'workout';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `spectrax_session_${exercise}_${timestamp}.json`;
    
    // Lightweight serialization — no deep copy
    const blob = new Blob([JSON.stringify(this.frames)], { type: 'application/json' });
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

export const sessionRecorder = new SessionRecorder();
