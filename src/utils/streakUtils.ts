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
  const todayString = today.toISOString().split('T')[0];

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

  const lastWorkoutDate = streakData.lastWorkoutDate;

  // Attempt to parse old local date string formats (e.g., "Mon Jan 01 2024") and convert to UTC
  // If it's already YYYY-MM-DD, this will still parse correctly to midnight UTC.
  const lastDate = new Date(lastWorkoutDate);
  let parsedLastString = lastWorkoutDate;
  if (!lastWorkoutDate.match(/^\d{4}-\d{2}-\d{2}$/) && !isNaN(lastDate.getTime())) {
      parsedLastString = lastDate.toISOString().split('T')[0];
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

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));

  return updatedData;
}
