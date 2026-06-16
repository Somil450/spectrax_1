import type { NormalizedLandmark } from "@mediapipe/pose";

export interface VBTMetrics {
  currentVelocity: number; 
  peakConcentricVelocity: number;
  averageConcentricVelocity: number;
  baselineVelocity: number;
  fatigueDropoff: number; // percentage
  phase: "concentric" | "eccentric" | "isometric";
  velocitiesSession: number[];
  asymmetryScore: number; // 0-100
  fatigueIndex: number; // 0-100
  barPathDrift: number; // normalized variance
  tutSeconds: number; // time under tension for current rep
  projectedVelocity: number; // linear regression projection for next rep
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

  // Bilateral asymmetry tracking
  private readonly LEFT_LANDMARKS = [11, 13, 15, 23, 25, 27];
  private readonly RIGHT_LANDMARKS = [12, 14, 16, 24, 26, 28];
  private leftVelocities: number[] = [];
  private rightVelocities: number[] = [];
  private repAsymmetryScores: number[] = [];
  private previousLeftY: Record<number, number> = {};
  private previousRightY: Record<number, number> = {};
  
  // Bar path drift tracking
  private primaryJointTrajectory: { x: number; y: number }[] = [];
  private repBarPathDrifts: number[] = [];
  
  // TUT tracking
  private repTUT: number = 0;
  private lastTUTTimestamp: number = 0;
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
    
    // Bilateral velocity calculation
    let leftDy = 0;
    let leftCount = 0;
    let rightDy = 0;
    let rightCount = 0;
    
    for (const idx of this.LEFT_LANDMARKS) {
      if (landmarks[idx]) {
        leftDy += (landmarks[idx].y - (this.previousLeftY[idx] ?? landmarks[idx].y));
        leftCount++;
      }
    }
    for (const idx of this.RIGHT_LANDMARKS) {
      if (landmarks[idx]) {
        rightDy += (landmarks[idx].y - (this.previousRightY[idx] ?? landmarks[idx].y));
        rightCount++;
      }
    }
    
    const leftVelocity = leftCount > 0 ? (leftDy / leftCount / this.boundingBoxHeight) / dt : 0;
    const rightVelocity = rightCount > 0 ? (rightDy / rightCount / this.boundingBoxHeight) / dt : 0;
    
    // Bar path drift: track primary joint trajectory
    if (landmarks[primaryJointIndex]) {
      this.primaryJointTrajectory.push({
        x: landmarks[primaryJointIndex].x,
        y: landmarks[primaryJointIndex].y,
      });
      if (this.primaryJointTrajectory.length > 60) {
        this.primaryJointTrajectory.shift();
      }
    }
    
    // Determine Phase based on Y deltas (assuming y grows downwards, e.g. for squats Concentric is moving UP -> negative rawVelocity, Eccentric is moving DOWN -> positive rawVelocity)
    // To generalize, we assume Concentric moves against gravity (UP -> Y decreases). 
    // Wait, it depends on the exercise. For squats/pushups, concentric is going up (y decreases -> dy < 0, velocity negative).
    // Let's use absolute speed and phase direction.
    // Let's say if dy < -0.005, it's Concentric (moving up). If dy > 0.005, it's Eccentric.
    // Determine Phase based on Y deltas
    const prevPhase = this.currentPhase;
    
    if (this.emaVelocity < -0.05) {
        this.currentPhase = "concentric";
        this.currentConcentricVelocities.push(Math.abs(this.emaVelocity));
        this.leftVelocities.push(Math.abs(leftVelocity));
        this.rightVelocities.push(Math.abs(rightVelocity));
    } else if (this.emaVelocity > 0.05) {
        this.currentPhase = "eccentric";
    } else {
        this.currentPhase = "isometric";
    }
    
    // TUT tracking: accumulate time when not isometric
    if (this.currentPhase !== "isometric") {
      if (this.lastTUTTimestamp > 0) {
        this.repTUT += (timestamp - this.lastTUTTimestamp) / 1000;
      }
      this.lastTUTTimestamp = timestamp;
    } else {
      this.lastTUTTimestamp = 0;
    }

    // ── TUT: Accumulate time for the phase we just left ────────
    if (prevPhase !== this.currentPhase) {
      const phaseDuration = timestamp - this.phaseStartTime;
      this.currentRepTUT[prevPhase] += phaseDuration;
      this.phaseStartTime = timestamp;
    }

    this.previousTime = timestamp;
    this.previousY = currentY;
    
    for (const idx of this.LEFT_LANDMARKS) {
      if (landmarks[idx]) this.previousLeftY[idx] = landmarks[idx].y;
    }
    for (const idx of this.RIGHT_LANDMARKS) {
      if (landmarks[idx]) this.previousRightY[idx] = landmarks[idx].y;
    }

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
      
      // Compute rep asymmetry score
      if (this.leftVelocities.length > 0 && this.rightVelocities.length > 0) {
        const leftPeak = Math.max(...this.leftVelocities);
        const rightPeak = Math.max(...this.rightVelocities);
        const maxPeak = Math.max(leftPeak, rightPeak, 0.001);
        const asymmetry = (Math.abs(leftPeak - rightPeak) / maxPeak) * 100;
        this.repAsymmetryScores.push(asymmetry);
      }
      
      // Compute rep bar path drift (variance of trajectory)
      if (this.primaryJointTrajectory.length > 2) {
        const xs = this.primaryJointTrajectory.map(p => p.x);
        const ys = this.primaryJointTrajectory.map(p => p.y);
        const avgX = xs.reduce((a, b) => a + b, 0) / xs.length;
        const avgY = ys.reduce((a, b) => a + b, 0) / ys.length;
        const variance = xs.reduce((sum, x) => sum + Math.pow(x - avgX, 2), 0) + 
                        ys.reduce((sum, y) => sum + Math.pow(y - avgY, 2), 0);
        this.repBarPathDrifts.push(variance / xs.length);
      }
      
      this.currentConcentricVelocities = [];
      this.leftVelocities = [];
      this.rightVelocities = [];
      this.primaryJointTrajectory = [];
      this.repTUT = 0;
      this.lastTUTTimestamp = 0;

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
    this.leftVelocities = [];
    this.rightVelocities = [];
    this.repAsymmetryScores = [];
    this.primaryJointTrajectory = [];
    this.repBarPathDrifts = [];
    this.previousLeftY = {};
    this.previousRightY = {};
    this.repTUT = 0;
    this.lastTUTTimestamp = 0;
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
          asymmetryScore: this.getAsymmetryScore(),
          fatigueIndex: this.getFatigueIndex(),
          barPathDrift: this.repBarPathDrifts.length > 0 ? this.repBarPathDrifts[this.repBarPathDrifts.length - 1] : 0,
          tutSeconds: this.repTUT,
          projectedVelocity: this.getProjectedVelocity(),
      };
  }

  public getAsymmetryScore(): number {
    if (this.repAsymmetryScores.length === 0) return 0;
    const recent = this.repAsymmetryScores.slice(-3);
    return Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
  }

  public getFatigueIndex(): number {
    const baseline = this.baselineVelocities.length > 0 
      ? this.baselineVelocities.reduce((a, b) => a + b, 0) / this.baselineVelocities.length 
      : 0;
    const latestPeak = this.sessionPeakVelocities.length > 0 
      ? this.sessionPeakVelocities[this.sessionPeakVelocities.length - 1] 
      : 0;
    let dropoff = 0;
    if (baseline > 0 && latestPeak > 0) {
      dropoff = ((baseline - latestPeak) / baseline) * 100;
      if (dropoff < 0) dropoff = 0;
    }
    const asymmetry = this.getAsymmetryScore();
    const drift = this.repBarPathDrifts.length > 0 ? this.repBarPathDrifts[this.repBarPathDrifts.length - 1] * 1000 : 0;
    
    // Weighted composite: 50% velocity dropoff, 30% asymmetry, 20% drift
    const index = Math.round(dropoff * 0.5 + asymmetry * 0.3 + Math.min(drift, 100) * 0.2);
    return Math.min(100, Math.max(0, index));
  }

  private getProjectedVelocity(): number {
    if (this.sessionPeakVelocities.length < 2) return 0;
    const last5 = this.sessionPeakVelocities.slice(-5);
    const n = last5.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = last5.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * last5[i], 0);
    const sumXX = x.reduce((acc, xi) => acc + xi * xi, 0);
    const denominator = n * sumXX - sumX * sumX;
    if (denominator === 0) return last5[last5.length - 1];
    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;
    return Math.max(0, intercept + slope * n);
  }
}

export const kinematicEngine = new KinematicEngine();
