import type { WorkoutSession } from '../useWorkoutHistory';

export type ChartPeriod = 'weekly' | 'monthly';

export interface ChartDataPoint {
  label: string;
  sessions: number;
  reps: number;
  minutes: number;
  calories: number;
}

const DEFAULT_WEIGHT_KG = 70;

function estimateCalories(session: WorkoutSession): number {
  const met = 5.5;
  const hours = session.duration / 3600;
  const perRepKcal = 0.3;
  return Math.round(met * DEFAULT_WEIGHT_KG * hours + session.totalReps * perRepKcal);
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatDayLabel(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'short' });
}

function formatWeekLabel(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${d.toLocaleDateString(undefined, { month: 'short' })}`;
}

export function aggregateWorkoutChartData(
  sessions: WorkoutSession[],
  period: ChartPeriod,
): ChartDataPoint[] {
  if (!sessions.length) return [];

  const now = Date.now();
  const bucketMs = period === 'weekly' ? 86400000 : 86400000 * 7;
  const rangeMs = period === 'weekly' ? bucketMs * 7 : bucketMs * 4;
  const rangeStart = startOfDay(now - rangeMs + bucketMs);

  const buckets = new Map<number, ChartDataPoint>();

  for (let t = rangeStart; t <= now; t += bucketMs) {
    buckets.set(t, {
      label: period === 'weekly' ? formatDayLabel(t) : formatWeekLabel(t),
      sessions: 0,
      reps: 0,
      minutes: 0,
      calories: 0,
    });
  }

  sessions.forEach((session) => {
    const ts = session.timestamp;
    if (ts < rangeStart) return;

    const bucketKey =
      period === 'weekly'
        ? startOfDay(ts)
        : startOfDay(ts - ((startOfDay(ts) - rangeStart) % bucketMs));

    const bucket = buckets.get(bucketKey);
    if (!bucket) return;

    bucket.sessions += 1;
    bucket.reps += session.totalReps;
    bucket.minutes += Math.round(session.duration / 60);
    bucket.calories += estimateCalories(session);
  });

  return Array.from(buckets.values());
}
