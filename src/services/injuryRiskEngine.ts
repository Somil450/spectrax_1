import type { VBTMetrics } from './kinematicEngine';

export interface RiskSnapshot {
  timestamp: number;
  riskIndex: number; // 0-100
  fatigueIndex: number;
  asymmetryScore: number;
  barPathDrift: number;
  projectedVelocity: number;
  baselineVelocity: number;
  recommendedStopRep: number | null;
}

export class InjuryRiskEngine {
  private riskHistory: RiskSnapshot[] = [];
  private readonly VELOCITY_FAILURE_THRESHOLD = 0.6; // 60% of baseline

  public computeRisk(metrics: VBTMetrics, currentRep: number): RiskSnapshot {
    const baseline = metrics.baselineVelocity;
    const projected = metrics.projectedVelocity;
    
    let riskIndex = 0;
    
    // Velocity decay risk: weight 40%
    if (baseline > 0 && projected > 0) {
      const velocityRatio = projected / baseline;
      if (velocityRatio < this.VELOCITY_FAILURE_THRESHOLD) {
        riskIndex += 40 + ((this.VELOCITY_FAILURE_THRESHOLD - velocityRatio) / this.VELOCITY_FAILURE_THRESHOLD) * 30;
      } else if (velocityRatio < 0.8) {
        riskIndex += (0.8 - velocityRatio) / 0.2 * 20;
      }
    }
    
    // Fatigue index risk: weight 35%
    riskIndex += metrics.fatigueIndex * 0.35;
    
    // Asymmetry risk: weight 25%
    riskIndex += metrics.asymmetryScore * 0.25;
    
    riskIndex = Math.min(100, Math.max(0, Math.round(riskIndex)));
    
    let recommendedStopRep: number | null = null;
    if (riskIndex >= 75 && currentRep > 0) {
      recommendedStopRep = currentRep + 2;
    } else if (riskIndex >= 50 && currentRep > 0) {
      recommendedStopRep = currentRep + 3;
    }
    
    const snapshot: RiskSnapshot = {
      timestamp: Date.now(),
      riskIndex,
      fatigueIndex: metrics.fatigueIndex,
      asymmetryScore: metrics.asymmetryScore,
      barPathDrift: metrics.barPathDrift,
      projectedVelocity: metrics.projectedVelocity,
      baselineVelocity: metrics.baselineVelocity,
      recommendedStopRep,
    };
    
    this.riskHistory.push(snapshot);
    if (this.riskHistory.length > 300) {
      this.riskHistory.shift();
    }
    
    return snapshot;
  }

  public getRiskHistory(): RiskSnapshot[] {
    return [...this.riskHistory];
  }

  public getLatestRisk(): RiskSnapshot | null {
    return this.riskHistory.length > 0 ? this.riskHistory[this.riskHistory.length - 1] : null;
  }

  public reset(): void {
    this.riskHistory = [];
  }
}

export const injuryRiskEngine = new InjuryRiskEngine();