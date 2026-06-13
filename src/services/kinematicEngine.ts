import type { NormalizedLandmark } from "@mediapipe/pose";

export interface VBTMetrics {
  currentVelocity: number; 
  peakConcentricVelocity: number;
  averageConcentricVelocity: number;
  baselineVelocity: number;
  fatigueDropoff: number; // percentage
  phase: "concentric" | "eccentric" | "isometric";
  velocitiesSession: number[];
}

export interface TUTMetrics {
  eccentricMs: number;
  concentricMs: number;
  isometricMs: number;
  tempoRatio: string; // e.g. "3-0-1-0"
  totalRepMs: number;
}

export class KinematicEngine {
  private previousY: number = 0;
  private previousTime: number = 0;
  
  private currentPhase: "concentric" | "eccentric" | "isometric" = "isometric";
  
  private currentConcentricVelocities: number[] = [];
  
  private baselineVelocities: number[] = [];
  private sessionPeakVelocities: number[] = [];
  
  // Smoothing
  private emaVelocity: number = 0;
  private readonly alpha = 0.2; // Smoothing factor
  
  private boundingBoxHeight: number = 1;

  // ── TUT Tracking ─────────────────────────────────────────────
  private phaseStartTime: number = 0;
  private currentRepTUT: { eccentric: number; concentric: number; isometric: number } = {
    eccentric: 0,
    concentric: 0,
    isometric: 0,
  };
  private lastRepTUT: TUTMetrics | null = null;

  public update(
    landmarks: NormalizedLandmark[], 
    timestamp: number, 
    primaryJointIndex: number // e.g. 24 for right hip in squats
  ): VBTMetrics {
    if (!landmarks || landmarks.length === 0 || !landmarks[primaryJointIndex]) {
      return this.getMetrics();
    }
    
    // Calculate Normalization Factor (Bounding Box Height)
    let minY = 1;
    let maxY = 0;
    for (let i = 0; i < landmarks.length; i++) {
        const y = landmarks[i].y;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }
    const height = maxY - minY;
    if (height > 0.1) {
        this.boundingBoxHeight = height;
    }

    const currentY = landmarks[primaryJointIndex].y;
    
    if (this.previousTime === 0) {
      this.previousTime = timestamp;
      this.previousY = currentY;
      this.phaseStartTime = timestamp;
      return this.getMetrics();
    }
    
    const dt = (timestamp - this.previousTime) / 1000; // seconds
    if (dt <= 0) return this.getMetrics();
    
    const dy = currentY - this.previousY;
    
    // Normalized velocity (normalized units per second)
    const rawVelocity = (dy / this.boundingBoxHeight) / dt;
    
    // Smooth velocity with EMA
    this.emaVelocity = (this.alpha * rawVelocity) + ((1 - this.alpha) * this.emaVelocity);
    
    // Determine Phase based on Y deltas
    const prevPhase = this.currentPhase;
    
    if (this.emaVelocity < -0.05) {
        this.currentPhase = "concentric";
        this.currentConcentricVelocities.push(Math.abs(this.emaVelocity));
    } else if (this.emaVelocity > 0.05) {
        this.currentPhase = "eccentric";
    } else {
        this.currentPhase = "isometric";
    }

    // ── TUT: Accumulate time for the phase we just left ────────
    if (prevPhase !== this.currentPhase) {
      const phaseDuration = timestamp - this.phaseStartTime;
      this.currentRepTUT[prevPhase] += phaseDuration;
      this.phaseStartTime = timestamp;
    }

    this.previousTime = timestamp;
    this.previousY = currentY;

    return this.getMetrics();
  }
  
  public onRepComplete() {
      if (this.currentConcentricVelocities.length > 0) {
          const peak = Math.max(...this.currentConcentricVelocities);
          this.sessionPeakVelocities.push(peak);
          
          if (this.baselineVelocities.length < 3) {
              this.baselineVelocities.push(peak);
          }
      }
      this.currentConcentricVelocities = [];

      // ── TUT: Finalize current rep's phase timing ───────────────
      // Add time for the current active phase since last transition
      const now = performance.now();
      const activePhaseDuration = now - this.phaseStartTime;
      this.currentRepTUT[this.currentPhase] += activePhaseDuration;

      const total = this.currentRepTUT.eccentric + this.currentRepTUT.concentric + this.currentRepTUT.isometric;
      const eccSec = Math.round(this.currentRepTUT.eccentric / 1000);
      const isoSec = Math.round(this.currentRepTUT.isometric / 1000);
      const conSec = Math.round(this.currentRepTUT.concentric / 1000);

      this.lastRepTUT = {
        eccentricMs: this.currentRepTUT.eccentric,
        concentricMs: this.currentRepTUT.concentric,
        isometricMs: this.currentRepTUT.isometric,
        tempoRatio: `${eccSec}-${isoSec}-${conSec}-0`,
        totalRepMs: total,
      };

      // Reset for next rep
      this.currentRepTUT = { eccentric: 0, concentric: 0, isometric: 0 };
      this.phaseStartTime = now;
  }

  public getLastRepTUT(): TUTMetrics | null {
    return this.lastRepTUT;
  }

  public reset(): void {
    this.previousY = 0;
    this.previousTime = 0;
    this.currentPhase = "isometric";
    this.currentConcentricVelocities = [];
    this.baselineVelocities = [];
    this.sessionPeakVelocities = [];
    this.emaVelocity = 0;
    this.boundingBoxHeight = 1;
    this.phaseStartTime = 0;
    this.currentRepTUT = { eccentric: 0, concentric: 0, isometric: 0 };
    this.lastRepTUT = null;
  }

  public getMetrics(): VBTMetrics {
      const baseline = this.baselineVelocities.length > 0 
          ? this.baselineVelocities.reduce((a, b) => a + b, 0) / this.baselineVelocities.length 
          : 0;
          
      let dropoff = 0;
      let peakCurrent = 0;
      if (this.currentConcentricVelocities.length > 0) {
          peakCurrent = Math.max(...this.currentConcentricVelocities);
      }
      
      const latestPeak = this.sessionPeakVelocities.length > 0 
        ? this.sessionPeakVelocities[this.sessionPeakVelocities.length - 1] 
        : peakCurrent;
        
      if (baseline > 0 && latestPeak > 0) {
          dropoff = ((baseline - latestPeak) / baseline) * 100;
          if (dropoff < 0) dropoff = 0;
      }
      
      const avgCurrent = this.currentConcentricVelocities.length > 0 
          ? this.currentConcentricVelocities.reduce((a, b) => a + b, 0) / this.currentConcentricVelocities.length
          : Math.abs(this.emaVelocity);

      return {
          currentVelocity: Math.abs(this.emaVelocity),
          peakConcentricVelocity: peakCurrent,
          averageConcentricVelocity: avgCurrent,
          baselineVelocity: baseline,
          fatigueDropoff: dropoff,
          phase: this.currentPhase,
          velocitiesSession: [...this.sessionPeakVelocities],
      };
  }
}

export const kinematicEngine = new KinematicEngine();
