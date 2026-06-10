// Monitors frame drops using requestAnimationFrame and provides a throttle level (0,1,2)

type ThrottleLevel = 0 | 1 | 2;

class FrameDropMonitor {
  private timestamps: number[] = [];
  private rafId: number | null = null;
  private listeners: Set<(level: ThrottleLevel) => void> = new Set();
  private currentLevel: ThrottleLevel = 0;
  private started = false;

  // Configuration
  private readonly WINDOW_SIZE = 60; // frames to keep (≈1s at 60fps)
  private readonly DROP_THRESHOLD = 0.2; // 20% drop → level 1
  private readonly SEVERE_THRESHOLD = 0.35; // 35% drop → level 2

  start() {
    if (this.started) return;
    this.started = true;
    const loop = (now: number) => {
      this.recordFrame(now);
      this.updateThrottleLevel();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.started = false;
    this.timestamps = [];
  }

  private recordFrame(now: number) {
    this.timestamps.push(now);
    if (this.timestamps.length > this.WINDOW_SIZE) {
      this.timestamps.shift();
    }
  }

  private getFrameDropIndex(): number {
    if (this.timestamps.length < 2) return 0;
    const duration =
      this.timestamps[this.timestamps.length - 1] - this.timestamps[0];
    const expectedFrames = (duration / 1000) * 60;
    const actualFrames = this.timestamps.length - 1;
    if (expectedFrames <= 0) return 0;
    const drop = (expectedFrames - actualFrames) / expectedFrames;
    return Math.min(Math.max(drop, 0), 1);
  }

  private updateThrottleLevel() {
    const dropIndex = this.getFrameDropIndex();
    let newLevel: ThrottleLevel = 0;
    if (dropIndex > this.SEVERE_THRESHOLD) {
      newLevel = 2;
    } else if (dropIndex > this.DROP_THRESHOLD) {
      newLevel = 1;
    }
    if (newLevel !== this.currentLevel) {
      this.currentLevel = newLevel;
      this.listeners.forEach((fn) => fn(newLevel));
    }
  }

  getCurrentLevel(): ThrottleLevel {
    return this.currentLevel;
  }

  onLevelChange(cb: (level: ThrottleLevel) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}

// Singleton instance
export const throttleMonitor = new FrameDropMonitor();

// React hook for easy integration
import { useEffect, useState } from "react";

export function useThrottleLevel(): ThrottleLevel {
  const [level, setLevel] = useState<ThrottleLevel>(
    throttleMonitor.getCurrentLevel(),
  );

  useEffect(() => {
    throttleMonitor.start();
    const unsubscribe = throttleMonitor.onLevelChange(setLevel);
    return () => {
      unsubscribe();
      // Do not stop the monitor globally; other components may use it.
      // throttleMonitor.stop();
    };
  }, []);

  return level;
}
