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
      return this.getMetrics();
    }
    
    const dt = (timestamp - this.previousTime) / 1000; // seconds
    if (dt <= 0) return this.getMetrics();
    
    const dy = currentY - this.previousY;
    
    // Normalized velocity (normalized units per second)
    const rawVelocity = (dy / this.boundingBoxHeight) / dt;
    
    // Smooth velocity with EMA
    this.emaVelocity = (this.alpha * rawVelocity) + ((1 - this.alpha) * this.emaVelocity);
    
    // Determine Phase based on Y deltas (assuming y grows downwards, e.g. for squats Concentric is moving UP -> negative rawVelocity, Eccentric is moving DOWN -> positive rawVelocity)
    // To generalize, we assume Concentric moves against gravity (UP -> Y decreases). 
    // Wait, it depends on the exercise. For squats/pushups, concentric is going up (y decreases -> dy < 0, velocity negative).
    // Let's use absolute speed and phase direction.
    // Let's say if dy < -0.005, it's Concentric (moving up). If dy > 0.005, it's Eccentric.
    
    if (this.emaVelocity < -0.05) {
        this.currentPhase = "concentric";
        this.currentConcentricVelocities.push(Math.abs(this.emaVelocity));
    } else if (this.emaVelocity > 0.05) {
        this.currentPhase = "eccentric";
    } else {
        this.currentPhase = "isometric";
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
