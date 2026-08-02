// src/utils/sessionExport.ts

export type RepQualityTier = "Good" | "Acceptable" | "Poor";

export interface RepLogRow {
  rep: number;
  timestampSec: number;
  score: number;
  tier: RepQualityTier;
  issue: string;
}

export interface SessionStatsLike {
  reps: number;
  totalReps: number;
  correctReps: number;
  repScores: number[];
  repDeviations?: number[];
  duration: number;
  accuracy: number;
  exerciseName?: string;
  mistakes: Record<string, number>;
  bestStreak: number;
  calories?: number;
}

const GOOD_TIER_MIN = 80;
const ACCEPTABLE_TIER_MIN = 60;

export function qualityTierFor(score: number): RepQualityTier {
  if (score >= GOOD_TIER_MIN) return "Good";
  if (score >= ACCEPTABLE_TIER_MIN) return "Acceptable";
  return "Poor";
}

export function issueForRep(score: number, deviation: number | undefined): string {
  if (deviation !== undefined && deviation >= 20) {
    return "Posture deviation detected";
  }
  if (score >= GOOD_TIER_MIN) return "Good form";
  if (score >= ACCEPTABLE_TIER_MIN) return "Slight inconsistency";
  return "Poor form — slow down and re-check technique";
}

export function buildRepLog(stats: SessionStatsLike): RepLogRow[] {
  const { repScores, repDeviations, duration } = stats;
  if (!repScores.length) return [];

  const repDuration = duration / repScores.length;
  return repScores.map((score, index) => ({
    rep: index + 1,
    timestampSec: Math.round(repDuration * (index + 1)),
    score: Math.round(score),
    tier: qualityTierFor(score),
    issue: issueForRep(score, repDeviations?.[index]),
  }));
}

export function countQualityTiers(rows: RepLogRow[]): Record<RepQualityTier, number> {
  const counts: Record<RepQualityTier, number> = {
    Good: 0,
    Acceptable: 0,
    Poor: 0,
  };
  for (const row of rows) {
    counts[row.tier] += 1;
  }
  return counts;
}

export function longestGoodStreak(rows: RepLogRow[]): number {
  let longest = 0;
  let current = 0;
  for (const row of rows) {
    if (row.tier === "Good") {
      current += 1;
      if (current > longest) longest = current;
    } else {
      current = 0;
    }
  }
  return longest;
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function sessionFileName(stats: SessionStatsLike, extension: string): string {
  const base = stats.exerciseName
    ? stats.exerciseName.toLowerCase().replace(/\s+/g, "-")
    : "workout";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${base}-session-${stamp}.${extension}`;
}

export function exportSessionJSON(stats: SessionStatsLike): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    exercise: stats.exerciseName ?? "unknown",
    accuracy: stats.accuracy,
    totalReps: stats.totalReps,
    correctReps: stats.correctReps,
    durationSec: stats.duration,
    calories: stats.calories,
    bestStreak: stats.bestStreak,
    mistakes: stats.mistakes,
    repLog: buildRepLog(stats),
    repScores: stats.repScores,
    repDeviations: stats.repDeviations ?? [],
  };
  downloadBlob(
    sessionFileName(stats, "json"),
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
  );
}

function csvEscape(value: string | number): string {
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function exportSessionCSV(stats: SessionStatsLike): void {
  const rows = buildRepLog(stats);
  const header = [
    "rep",
    "timestamp_seconds",
    "form_score",
    "quality_tier",
    "top_issue",
  ];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.rep,
        row.timestampSec,
        row.score,
        row.tier,
        csvEscape(row.issue),
      ].join(",")
    ),
  ];
  downloadBlob(
    sessionFileName(stats, "csv"),
    new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
  );
}
