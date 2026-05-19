import { useState, useEffect, useCallback, useRef } from 'react';
import { Badge, EarnedBadge } from '../types/badge';
import { BADGES_CONFIG } from '../config/badges';

// ─── Keys ────────────────────────────────────────────────────────────────────
const LS_BADGES        = 'spectrax_badges';
const LS_WORKOUT_COUNT = 'spectrax_workout_count';
const LS_TOTAL_SQUATS  = 'spectrax_total_squats';
const LS_WORKOUT_DATES = 'spectrax_workout_dates';

// ─── Matches the REAL WorkoutStats shape from App.tsx ────────────────────────
export interface WorkoutSessionStats {
  totalReps: number;
  accuracy: number;
  exerciseName: string;
  bestStreak: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed;
  } catch {
    return fallback;
  }
}

function calculateStreak(isoDateStrings: string[]): number {
  if (isoDateStrings.length === 0) return 0;

  // Deduplicate to one entry per calendar day, newest first
  const days = [...new Set(isoDateStrings.map(d => d.slice(0, 10)))]
    .sort()
    .reverse();

  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  // Streak must start today or yesterday (grace for late-night workouts)
  if (days[0] !== today && days[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const diffMs   = new Date(days[i - 1]).getTime() - new Date(days[i]).getTime();
    const diffDays = Math.round(diffMs / 86_400_000);
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useBadges = () => {
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([]);
  const [newlyEarned,  setNewlyEarned]  = useState<Badge | null>(null);

  // Load on mount
  useEffect(() => {
    const saved = safeRead<EarnedBadge[]>(LS_BADGES, []);
    setEarnedBadges(Array.isArray(saved) ? saved : []);
  }, []);

  const checkAndAwardBadges = useCallback((session: WorkoutSessionStats) => {
    const now = new Date();

    // ── 1. Update cumulative counters ──
    const workoutCount  = safeRead<number>(LS_WORKOUT_COUNT, 0) + 1;
    localStorage.setItem(LS_WORKOUT_COUNT, JSON.stringify(workoutCount));

    const isSquat       = session.exerciseName.toLowerCase().includes('squat');
    const totalSquats   = safeRead<number>(LS_TOTAL_SQUATS, 0) + (isSquat ? session.totalReps : 0);
    localStorage.setItem(LS_TOTAL_SQUATS, JSON.stringify(totalSquats));

    const workoutDates  = safeRead<string[]>(LS_WORKOUT_DATES, []);
    workoutDates.push(now.toISOString());
    localStorage.setItem(LS_WORKOUT_DATES, JSON.stringify(workoutDates));

    const currentStreak = calculateStreak(workoutDates);
    const workoutHour   = now.getHours();

    // ── 2. Load currently earned badge ids ──
    const currentEarned = safeRead<EarnedBadge[]>(LS_BADGES, []);
    const safeEarned    = Array.isArray(currentEarned) ? currentEarned : [];
    const earnedIds     = new Set(safeEarned.map(b => b.id));

    // ── 3. Check each badge ──
    const newlyUnlocked: EarnedBadge[] = [];

    for (const badge of BADGES_CONFIG) {
      if (earnedIds.has(badge.id)) continue;

      let isEarned = false;
      switch (badge.criteriaType) {
        case 'workouts':  isEarned = workoutCount  >= badge.targetValue; break;
        case 'reps':      isEarned = totalSquats   >= badge.targetValue; break;
        case 'accuracy':  isEarned = session.accuracy >= badge.targetValue; break;
        case 'streak':    isEarned = currentStreak >= badge.targetValue; break;
        case 'time':      isEarned = workoutHour   >= badge.targetValue; break;
      }

      if (isEarned) {
        newlyUnlocked.push({ id: badge.id, unlockedAt: now.toISOString() });
      }
    }

    // ── 4. Persist and notify (only once — for the first new badge) ──
    if (newlyUnlocked.length > 0) {
      const updatedBadges = [...safeEarned, ...newlyUnlocked];
      localStorage.setItem(LS_BADGES, JSON.stringify(updatedBadges));
      setEarnedBadges(updatedBadges);

      const firstNew = BADGES_CONFIG.find(b => b.id === newlyUnlocked[0].id);
      if (firstNew) setNewlyEarned(firstNew);
    }
  }, []);

  const clearNewlyEarned = useCallback(() => setNewlyEarned(null), []);

  /** Set of earned badge ids — O(1) lookups in components */
  const earnedIds = new Set(earnedBadges.map(b => b.id));

  /** Returns formatted unlock date string, or null if not earned */
  const getUnlockDate = useCallback(
    (badgeId: string): string | null => {
      const found = earnedBadges.find(b => b.id === badgeId);
      if (!found) return null;
      return new Date(found.unlockedAt).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
    },
    [earnedBadges],
  );

  return { earnedBadges, earnedIds, checkAndAwardBadges, newlyEarned, clearNewlyEarned, getUnlockDate };
};
