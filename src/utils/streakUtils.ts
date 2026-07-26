export interface WorkoutStreakData {
  currentStreak: number;
  longestStreak: number;
  lastWorkoutDate: string | null;
}

const STORAGE_KEY = "spectrax_workout_streak";

const DEFAULT_STREAK_DATA: WorkoutStreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastWorkoutDate: null,
};

function safeWrite(data: WorkoutStreakData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function getWorkoutStreak(): WorkoutStreakData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { ...DEFAULT_STREAK_DATA };
    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_STREAK_DATA };
    }
    return { ...DEFAULT_STREAK_DATA, ...parsed };
  } catch {
    return { ...DEFAULT_STREAK_DATA };
  }
}

export function updateWorkoutStreak(): WorkoutStreakData {
  const streakData = getWorkoutStreak();

  const today = new Date();
  const todayString = today.toDateString();

  // First workout ever
  if (!streakData.lastWorkoutDate) {
    const newData = {
      currentStreak: 1,
      longestStreak: 1,
      lastWorkoutDate: todayString,
    };

    safeWrite(newData);
    return newData;
  }

  const lastWorkoutDate = streakData.lastWorkoutDate;

  const localDayNumber = (d: Date): number =>
    Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);

  const isoMatch = lastWorkoutDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let lastDate: Date;
  if (isoMatch) {
    lastDate = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  } else {
    const parsed = new Date(lastWorkoutDate);
    lastDate = isNaN(parsed.getTime()) ? today : parsed;
  }

  const diffDays = localDayNumber(today) - localDayNumber(lastDate);

  let currentStreak = streakData.currentStreak;

  // Same day
  if (diffDays === 0) {
    return streakData;
  }

  // Consecutive day
  if (diffDays === 1) {
    currentStreak += 1;
  } else {
    // Streak broken
    currentStreak = 1;
  }

  const longestStreak = Math.max(
    currentStreak,
    streakData.longestStreak
  );

  const updatedData = {
    currentStreak,
    longestStreak,
    lastWorkoutDate: todayString,
  };

  safeWrite(updatedData);

  return updatedData;
}
