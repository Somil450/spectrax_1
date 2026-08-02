// Timezone-safe helpers for the weekly activity chart (#49).
// Aggregates workouts into the last 7 local calendar days by total reps
// and total minutes, using the same local-day-key math as streakUtils.

export interface WeeklyActivityDay {
  /** Local calendar day key, e.g. "2026-08-02" */
  key: string;
  /** Short weekday label, e.g. "Mon" */
  label: string;
  /** True when the day is today */
  isToday: boolean;
  /** Sum of totalReps for workouts on that day */
  reps: number;
  /** Sum of duration (in minutes, rounded) for workouts on that day */
  minutes: number;
  /** Number of workouts recorded on that day */
  sessions: number;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function toLocalDayKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export interface WeeklyActivityInput {
  timestamp: number;
  totalReps: number;
  duration: number;
}

/**
 * Builds the 7-day activity summary (ending today) for the given workouts.
 * Workouts outside the trailing 7 local calendar days are ignored.
 */
export function getWeeklyActivity(
  workouts: WeeklyActivityInput[],
  now: Date = new Date()
): WeeklyActivityDay[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  today.setHours(0, 0, 0, 0);

  const days: WeeklyActivityDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - i));
    return {
      key: toLocalDayKey(date),
      label: DAY_LABELS[date.getDay()],
      isToday: i === 6,
      reps: 0,
      minutes: 0,
      sessions: 0,
    };
  });

  const dayByKey = new Map(days.map((d) => [d.key, d]));

  for (const workout of workouts) {
    const key = toLocalDayKey(new Date(workout.timestamp));
    const day = dayByKey.get(key);
    if (!day) continue;

    day.reps += Math.max(0, workout.totalReps || 0);
    day.minutes += Math.max(0, Math.round((workout.duration || 0) / 60));
    day.sessions += 1;
  }

  return days;
}
