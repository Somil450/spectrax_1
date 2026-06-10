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

  // Attempt to parse old local date string formats (e.g., "Mon Jan 01 2024") and convert to UTC
  // If it's already YYYY-MM-DD, this will still parse correctly to midnight UTC.
  const lastDate = new Date(lastWorkoutDate);
  let parsedLastString = lastWorkoutDate;
  if (!lastWorkoutDate.match(/^\d{4}-\d{2}-\d{2}$/) && !isNaN(lastDate.getTime())) {
      parsedLastString = lastDate.toDateString();
  } else if (isNaN(lastDate.getTime())) {
      // Fallback if parsing fails entirely
      parsedLastString = todayString; 
  }

  const todayParsed = new Date(todayString);
  const lastParsed = new Date(parsedLastString);
  
  const diffTime = todayParsed.getTime() - lastParsed.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

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
