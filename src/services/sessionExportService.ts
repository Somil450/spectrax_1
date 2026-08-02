import { FrameData } from './sessionRecorder';

/**
 * sessionExportService.ts
 *
 * Real-time CSV/JSON export engine for session data. Produces valid,
 * well-structured files (JSON object or sectioned CSV) that include the
 * summary metrics, per-rep quality breakdown and — when recorded frames are
 * supplied — the raw joint coordinate logs, so sessions can be exported,
 * archived and replayed offline.
 */

export interface ExportableSessionStats {
  exerciseName?: string;
  reps: number;
  totalReps: number;
  correctReps: number;
  repScores: number[];
  repDeviations?: number[];
  duration: number; // seconds
  accuracy: number; // 0–100
  mistakes: Record<string, number>;
  bestStreak: number;
  tags?: string[];
  calories?: number;
  gainedXp?: number;
}

export interface SessionExportOptions {
  /** Include raw joint coordinate logs in the export (CSV coordinates section / JSON coordinates array). */
  includeCoordinates?: boolean;
  /** Cap the number of coordinate frames written (default: all). */
  maxCoordinateFrames?: number;
}

export interface SessionJsonExport {
  format: 'spectrax-session-export';
  version: 1;
  exportedAt: string;
  session: {
    exerciseName: string | null;
    durationSeconds: number;
    totalReps: number;
    correctReps: number;
    reps: number;
    accuracy: number;
    bestStreak: number;
    calories: number | null;
    gainedXp: number | null;
    tags: string[];
    mistakes: Record<string, number>;
  };
  reps: Array<{ index: number; score: number; deviation: number | null }>;
  coordinates: Array<{
    frameIndex: number;
    timeMs: number;
    landmarks: Array<{ x: number; y: number; z: number; visibility: number }>;
  }>;
}

/** Escapes a single CSV field per RFC 4180. */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** Joins fields into a single CSV line (CRLF line endings). */
export function toCsvLine(fields: unknown[]): string {
  return fields.map(escapeCsvField).join(',') + '\r\n';
}

/** Builds the exported session object (JSON template). */
export function buildSessionJson(
  stats: ExportableSessionStats,
  frames?: FrameData[],
  options?: SessionExportOptions
): SessionJsonExport {
  const includeCoordinates = options?.includeCoordinates ?? frames !== undefined;
  const maxCoordinateFrames = options?.maxCoordinateFrames ?? 0;

  const framesToWrite =
    includeCoordinates && frames && frames.length > 0
      ? (maxCoordinateFrames > 0 ? frames.slice(0, maxCoordinateFrames) : frames)
      : [];

  return {
    format: 'spectrax-session-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    session: {
      exerciseName: stats.exerciseName ?? null,
      durationSeconds: stats.duration,
      totalReps: stats.totalReps,
      correctReps: stats.correctReps,
      reps: stats.reps,
      accuracy: stats.accuracy,
      bestStreak: stats.bestStreak,
      calories: stats.calories ?? null,
      gainedXp: stats.gainedXp ?? null,
      tags: stats.tags ?? [],
      mistakes: stats.mistakes,
    },
    reps: stats.repScores.map((score, index) => ({
      index,
      score,
      deviation: stats.repDeviations?.[index] ?? null,
    })),
    coordinates: framesToWrite.map((frame, frameIndex) => ({
      frameIndex,
      timeMs: frame.timestamp,
      landmarks: (frame.landmarks || []).map((lm) => ({
        x: lm.x,
        y: lm.y,
        z: lm.z ?? 0,
        visibility: lm.visibility ?? 0,
      })),
    })),
  };
}

/**
 * Builds the sectioned CSV template:
 *   [SESSION]  one row of session-level metrics
 *   [REPS]     per-rep score / deviation rows
 *   [MISTAKES] mistake category counts
 *   [COORDINATES] raw joint coordinate log rows (when frames are supplied)
 */
export function buildSessionCsv(
  stats: ExportableSessionStats,
  frames?: FrameData[],
  options?: SessionExportOptions
): string {
  const lines: string[] = [];

  lines.push(toCsvLine(['[SESSION]', 'exerciseName', 'durationSeconds', 'totalReps', 'correctReps', 'reps', 'accuracy', 'bestStreak', 'calories', 'gainedXp', 'tags', 'exportedAt']));
  lines.push(
    toCsvLine([
      stats.exerciseName ?? '',
      stats.duration,
      stats.totalReps,
      stats.correctReps,
      stats.reps,
      stats.accuracy,
      stats.bestStreak,
      stats.calories ?? '',
      stats.gainedXp ?? '',
      (stats.tags ?? []).join(';'),
      new Date().toISOString(),
    ])
  );

  lines.push(toCsvLine(['[REPS]', 'index', 'score', 'deviation']));
  stats.repScores.forEach((score, index) => {
    lines.push(toCsvLine([index, score, stats.repDeviations?.[index] ?? '']));
  });

  lines.push(toCsvLine(['[MISTAKES]', 'category', 'count']));
  Object.entries(stats.mistakes).forEach(([category, count]) => {
    lines.push(toCsvLine([category, count]));
  });

  const includeCoordinates = options?.includeCoordinates ?? frames !== undefined;
  if (includeCoordinates && frames && frames.length > 0) {
    const maxCoordinateFrames = options?.maxCoordinateFrames ?? 0;
    const framesToWrite =
      maxCoordinateFrames > 0 ? frames.slice(0, maxCoordinateFrames) : frames;

    lines.push(toCsvLine(['[COORDINATES]', 'frameIndex', 'timeMs', 'landmarkIndex', 'x', 'y', 'z', 'visibility']));
    framesToWrite.forEach((frame, frameIndex) => {
      (frame.landmarks || []).forEach((lm, landmarkIndex) => {
        lines.push(
          toCsvLine([
            frameIndex,
            frame.timestamp,
            landmarkIndex,
            lm.x,
            lm.y,
            lm.z ?? 0,
            lm.visibility ?? 0,
          ])
        );
      });
    });
  }

  return lines.join('');
}

/**
 * Triggers a browser download of the session export as either a CSV or JSON
 * file. CSV output is prefixed with a UTF-8 BOM so Excel opens it correctly.
 */
export function downloadSessionData(
  stats: ExportableSessionStats,
  format: 'csv' | 'json',
  frames?: FrameData[],
  options?: SessionExportOptions
): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  let content: string;
  let mime: string;
  if (format === 'csv') {
    content = '\uFEFF' + buildSessionCsv(stats, frames, options);
    mime = 'text/csv;charset=utf-8;';
  } else {
    content = JSON.stringify(buildSessionJson(stats, frames, options), null, 2);
    mime = 'application/json';
  }

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `workout-session-${timestamp}.${format}`;
  link.click();
  URL.revokeObjectURL(url);
}
