export interface FrameData {
  timestamp: number;
  landmarks: any[];
  angles: Record<string, number>;
  feedback: string;
  exercise: string;
}

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
          runLength: 1
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
        currentTimestamp += (timestampDelta || 33);
        frames.push({
          ...frameBase,
          timestamp: currentTimestamp
        } as FrameData);
      }
    }
    return frames;
  }

  static isStationary(prev: FrameData, curr: FrameData): boolean {
    if (!prev || !curr) return false;
    if (prev.exercise !== curr.exercise || prev.feedback !== curr.feedback) {
      return false;
    }
    const angleThreshold = 2.0; // degrees
    for (const key in curr.angles) {
      const prevAngle = prev.angles[key] || 0;
      const currAngle = curr.angles[key] || 0;
      if (Math.abs(currAngle - prevAngle) > angleThreshold) {
        return false;
      }
    }
    return true;
  }
}

const MAX_FRAMES = 300; // Rolling buffer — ~20s at 15 FPS

class SessionRecorder {
  private compressedFrames: any[] = [];
  private _frameCount = 0;
  private lastRawFrame: FrameData | null = null;

  start() {
    this.compressedFrames = [];
    this._frameCount = 0;
    this.lastRawFrame = null;
  }

  recordFrame(frame: FrameData) {
    if (this._frameCount >= MAX_FRAMES) {
      const first = this.compressedFrames[0];
      if (first && first.runLength > 1) {
        first.runLength--;
        first.timestamp += (first.timestampDelta || 33);
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

    const lastCompressed = this.compressedFrames[this.compressedFrames.length - 1];
    if (this.lastRawFrame && RLDCompressionDriver.isStationary(this.lastRawFrame, frame)) {
      lastCompressed.runLength++;
    } else {
      this.compressedFrames.push({
        ...frame,
        timestampDelta: this.lastRawFrame ? frame.timestamp - this.lastRawFrame.timestamp : 33,
        runLength: 1
      });
    }
    this.lastRawFrame = frame;
    this._frameCount++;
  }

  get frames(): FrameData[] {
    return RLDCompressionDriver.decompress(this.compressedFrames);
  }

  set frames(newFrames: FrameData[]) {
    this.start();
    for (const f of newFrames) {
      this.recordFrame(f);
    }
  }

  get frameCount(): number {
    return this._frameCount;
  }

  download() {
    if (this._frameCount === 0) return;
    
    const firstFrame = this.compressedFrames[0];
    const exercise = firstFrame?.exercise || 'workout';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `spectrax_session_${exercise}_${timestamp}.json`;
    
    // Download compressed format, massive storage savings
    const blob = new Blob([JSON.stringify(this.compressedFrames)], { type: 'application/json' });
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
