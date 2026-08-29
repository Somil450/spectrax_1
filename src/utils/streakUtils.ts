export interface WorkoutStreakData {
  currentStreak: number;
  longestStreak: number;
  /** Local calendar day key (YYYY-MM-DD) of the last workout. Timezone-independent. */
  lastWorkoutDate: string | null;
  version?: number;
}

const STORAGE_KEY = "spectrax_workout_streak";
const STORAGE_VERSION = 1;

const DEFAULT_STREAK_DATA: WorkoutStreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastWorkoutDate: null,
  version: STORAGE_VERSION,
};

/**
 * Formats a Date as the user's *local* calendar day key (YYYY-MM-DD).
 *
 * Streaks are defined against the user's local calendar day, so the stored key
 * must be derived from local components — never from Date.parse or toISOString
 * (UTC), which would silently shift the day when the user is east/west of UTC.
 */
export function toLocalDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Converts a YYYY-MM-DD day key to a stable integer day number via UTC math on
 * the *calendar* components only. This keeps day diffs identical in every
 * timezone because no local-timezone shifting is ever applied.
 */
export function dayKeyToDayNumber(key: string): number {
  const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return NaN;
  return Math.floor(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000
  );
}

/** Normalizes any historically persisted value into a YYYY-MM-DD day key, or null. */
function normalizeStoredDay(value: string | null | undefined): string | null {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  // Legacy format written by the previous implementation (e.g. "Sat Aug 02 2026").
  // Non-ISO strings are parsed in local time, so re-extracting local components
  // preserves the originally recorded calendar day in any timezone.
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return null;
  return toLocalDayKey(parsed);
}

function safeWrite(data: WorkoutStreakData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function sanitizeStreakData(parsed: unknown): WorkoutStreakData {
  const data = { ...DEFAULT_STREAK_DATA };
  if (!parsed || typeof parsed !== "object") return data;

  const raw = parsed as Partial<WorkoutStreakData>;
  data.currentStreak =
    typeof raw.currentStreak === "number" && Number.isFinite(raw.currentStreak) && raw.currentStreak >= 0
      ? Math.floor(raw.currentStreak)
      : 0;
  data.longestStreak =
    typeof raw.longestStreak === "number" && Number.isFinite(raw.longestStreak) && raw.longestStreak >= 0
      ? Math.floor(raw.longestStreak)
      : 0;
  data.lastWorkoutDate = normalizeStoredDay(raw.lastWorkoutDate);
  return data;
}

export function getWorkoutStreak(): WorkoutStreakData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { ...DEFAULT_STREAK_DATA };
    return sanitizeStreakData(JSON.parse(saved));
  } catch {
    return { ...DEFAULT_STREAK_DATA };
  }
}

/**
 * Records a workout and returns the updated streak metrics.
 *
 * @param now Optional clock source (injectable for tests). Defaults to `new Date()`.
 *
 * Day bookkeeping is done purely on local calendar day keys, so travelling
 * across timezones (or a DST boundary) cannot corrupt streak integrity: two
 * workouts on the same calendar day always count once, consecutive calendar
 * days increment, and any gap breaks the streak.
 */
export function updateWorkoutStreak(now: Date = new Date()): WorkoutStreakData {
  const streakData = getWorkoutStreak();
  const todayKey = toLocalDayKey(now);

  // First workout ever (or the stored date was corrupt/unreadable — a fresh
  // start that still retains any previously recorded lifetime best).
  if (!streakData.lastWorkoutDate) {
    const newData: WorkoutStreakData = {
      currentStreak: 1,
      longestStreak: Math.max(1, streakData.longestStreak),
      lastWorkoutDate: todayKey,
      version: STORAGE_VERSION,
    };
    safeWrite(newData);
    return newData;
  }

  const lastKey = streakData.lastWorkoutDate;
  const diffDays = dayKeyToDayNumber(todayKey) - dayKeyToDayNumber(lastKey);

  // Negative diff means the stored day is in the future (system clock moved
  // backwards). Leave the streak untouched rather than corrupt it.
  if (diffDays < 0) {
    return streakData;
  }

  // Same calendar day — already recorded today.
  if (diffDays === 0) {
    return streakData;
  }

  const currentStreak = diffDays === 1 ? streakData.currentStreak + 1 : 1;
  const updatedData: WorkoutStreakData = {
    currentStreak,
    longestStreak: Math.max(currentStreak, streakData.longestStreak),
    lastWorkoutDate: todayKey,
    version: STORAGE_VERSION,
  };

  safeWrite(updatedData);
  return updatedData;
}
