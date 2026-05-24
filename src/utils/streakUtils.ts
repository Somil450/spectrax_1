export interface WorkoutStreakData {
  currentStreak: number;
  longestStreak: number;
  lastWorkoutDate: string | null;
}

const STORAGE_KEY = "spectrax_workout_streak";

export function getWorkoutStreak(): WorkoutStreakData {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastWorkoutDate: null,
    };
  }

  return JSON.parse(saved);
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

    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    return newData;
  }

  const lastWorkout = new Date(streakData.lastWorkoutDate);

  const diffTime = today.getTime() - lastWorkout.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

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

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));

  return updatedData;
}