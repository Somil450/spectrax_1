/**
 * velocityProfiler.ts
 *
 * Real-time velocity profiling for the primary joint centre. Consumes the
 * per-frame normalized velocity emitted by KinematicEngine and builds a rolling
 * velocity curve that drives:
 *   - tempo classification (fast / moderate / slow) relative to the athlete's
 *     own baseline, so heavy sets that stall get flagged instead of compared
 *     against a fixed (exercise-independent) number
 *   - deceleration detection within a rep (velocity dropping off near the top)
 *   - pacing assessment (steady cadence vs. erratic start-stop motion)
 */

export type VelocityTempo = "fast" | "moderate" | "slow";
export type VelocityPacing = "steady" | "erratic";

export interface VelocityProfile {
  currentSpeed: number;
  peakSpeed: number;
  averageSpeed: number;
  baselineSpeed: number;
  tempo: VelocityTempo;
  decelerating: boolean;
  decelerationPct: number;
  pacing: VelocityPacing;
  curve: number[];
  samples: number;
}

const CURVE_SIZE = 30;
const DECELERATION_THRESHOLD_PCT = 30;
const PACING_CV_THRESHOLD = 0.55;
const BASELINE_REPS = 3;
const TEMPO_FAST_RATIO = 1.15;
const TEMPO_SLOW_RATIO = 0.65;

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Classify instantaneous velocity into a tempo. Prefers comparing against the
 * athlete's own baseline (first few rep peaks) and falls back to absolute
 * bands only before baseline calibration completes.
 */
export function classifyTempo(velocity: number, baseline: number): VelocityTempo {
  if (baseline > 0.001) {
    const ratio = velocity / baseline;
    if (ratio > TEMPO_FAST_RATIO) return "fast";
    if (ratio < TEMPO_SLOW_RATIO) return "slow";
    return "moderate";
  }
  if (velocity > 0.8) return "fast";
  if (velocity < 0.25) return "slow";
  return "moderate";
}

export class VelocityProfiler {
  private curve: number[] = [];
  private repSamples: number[] = [];
  private repPeak = 0;
  private baselinePeaks: number[] = [];

  addSample(velocity: number): void {
    if (!Number.isFinite(velocity) || velocity < 0) return;
    this.curve.push(velocity);
    if (this.curve.length > CURVE_SIZE) this.curve.shift();
    this.repSamples.push(velocity);
    this.repPeak = Math.max(this.repPeak, velocity);
  }

  onRepComplete(): void {
    if (this.baselinePeaks.length < BASELINE_REPS) {
      this.baselinePeaks.push(this.repPeak);
    }
    this.repSamples = [];
    this.repPeak = 0;
  }

  reset(): void {
    this.curve = [];
    this.repSamples = [];
    this.repPeak = 0;
    this.baselinePeaks = [];
  }

  getProfile(): VelocityProfile {
    const current = this.curve.length > 0 ? this.curve[this.curve.length - 1] : 0;
    const average = this.repSamples.length > 0 ? mean(this.repSamples) : current;
    const peak = this.repPeak > 0 ? this.repPeak : this.curve.length > 0 ? Math.max(...this.curve) : 0;
    const baseline = this.baselinePeaks.length > 0 ? mean(this.baselinePeaks) : 0;

    const deceleration = this.detectDeceleration();

    return {
      currentSpeed: round2(current),
      peakSpeed: round2(peak),
      averageSpeed: round2(average),
      baselineSpeed: round2(baseline),
      tempo: classifyTempo(current, baseline),
      decelerating: deceleration.decelerating,
      decelerationPct: round2(deceleration.pct),
      pacing: this.measurePacing(),
      curve: [...this.curve],
      samples: this.curve.length,
    };
  }

  private detectDeceleration(): { decelerating: boolean; pct: number } {
    if (this.curve.length < 8 || this.repPeak <= 0) {
      return { decelerating: false, pct: 0 };
    }
    const recentAvg = mean(this.curve.slice(-6));
    const pct = ((this.repPeak - recentAvg) / this.repPeak) * 100;
    return {
      decelerating: pct > DECELERATION_THRESHOLD_PCT,
      pct: Math.max(0, pct),
    };
  }

  private measurePacing(): VelocityPacing {
    const samples = this.repSamples.length > 6 ? this.repSamples : this.curve.slice(-8);
    if (samples.length < 4) return "steady";
    const meanValue = mean(samples);
    if (meanValue <= 0) return "steady";
    const variance = samples.reduce((sum, value) => sum + (value - meanValue) ** 2, 0) / samples.length;
    const coefficientOfVariation = Math.sqrt(variance) / meanValue;
    return coefficientOfVariation > PACING_CV_THRESHOLD ? "erratic" : "steady";
  }
}
