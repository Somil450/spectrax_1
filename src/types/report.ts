export type TemplateType = "executive" | "technical" | "compliance";

export type ExportFormat = "html" | "markdown" | "json";

export interface ReportTemplate {
  readonly type: TemplateType;
  readonly label: string;
  readonly description: string;
  readonly supportedFormats: ExportFormat[];
  render(data: ReportData, format: ExportFormat): string;
}

export interface ReportData {
  session: SessionSummary;
  biomechanics?: BiomechanicsSummary;
  risk?: RiskSummary;
  vbt?: VBTSummary;
  depthAnalysis?: DepthAnalysisSummary;
  user?: UserContext;
}

export interface SessionSummary {
  exerciseName: string;
  reps: number;
  totalReps: number;
  correctReps: number;
  accuracy: number;
  duration: number;
  totalScore: number;
  totalFrames: number;
  mistakes: Record<string, number>;
  bestStreak: number;
  calories: number;
  gainedXp: number;
  timestamp: number;
  jumpingJackSync?: {
    score: number | null;
    lagMs: number | null;
    confidence: number;
  };
}

export interface BiomechanicsSummary {
  repScores: number[];
  repDeviations: number[];
  averageScore: number;
  minScore: number;
  maxScore: number;
  tempoRatio?: string;
  holdTime?: number;
}

export interface RiskSummary {
  riskIndex: number;
  fatigueIndex: number;
  asymmetryScore: number;
  recommendedStopRep: number | null;
  riskHistory: Array<{
    timestamp: number;
    riskIndex: number;
    fatigueIndex: number;
    asymmetryScore: number;
  }>;
}

export interface VBTSummary {
  peakConcentricVelocity: number;
  averageConcentricVelocity: number;
  baselineVelocity: number;
  fatigueDropoff: number;
  currentVelocity: number;
}

export interface DepthAnalysisSummary {
  squatDepthStats?: {
    fullDepthRatio: number;
    partialRatio: number;
    aboveParallelRatio: number;
  };
  pushupDepthStats?: {
    fullDepthRatio: number;
    partialRatio: number;
  };
}

export interface UserContext {
  displayName?: string;
  level?: number;
  xp?: number;
  bodyType?: string;
}
