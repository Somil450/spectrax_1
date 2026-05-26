// src/useWorkoutHistory.ts
import { useState, useCallback } from "react";
import { useAuth } from "./hooks/useAuth";
import {
  getLocalWorkouts,
  deleteWorkout,
  clearAllWorkouts,
} from "./services/workoutSyncService";

// ── Types ────────────────────────────────────────────────────────────────────

export interface WorkoutSession {
  id?: string | number;
  exerciseType: string;
  totalReps: number;
  accuracyScore: number; // 0–100
  duration: number;      // seconds
  timestamp: number;     // Date.now()
}

// ── Hook ─────────────────────────────────────────────────────────────────────

interface UseWorkoutHistoryReturn {
  sessions: WorkoutSession[];
  loading: boolean;
  error: string | null;
  fetchHistory: () => Promise<void>;
  removeSession: (id: string | number) => Promise<void>;
  clearHistory: () => Promise<void>;
}

export function useWorkoutHistory(): UseWorkoutHistoryReturn {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getLocalWorkouts(user.uid);
      // Sort sessions descending by timestamp
      const sortedData: WorkoutSession[] = [...data].sort(
        (a, b) => b.timestamp - a.timestamp
      );
      setSessions(sortedData);
    } catch (err) {
      setError("Failed to load workout history.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  const removeSession = useCallback(
    async (id: string | number) => {
      if (!user?.uid) return;
      setError(null);
      try {
        await deleteWorkout(user.uid, id);
        setSessions((prev) => prev.filter((s) => s.id !== id));
      } catch (err) {
        setError("Failed to delete session.");
        console.error(err);
      }
    },
    [user?.uid]
  );

  const clearHistory = useCallback(async () => {
    if (!user?.uid) return;
    setError(null);
    try {
      await clearAllWorkouts(user.uid);
      setSessions([]);
    } catch (err) {
      setError("Failed to clear history.");
      console.error(err);
    }
  }, [user?.uid]);

  return {
    sessions,
    loading,
    error,
    fetchHistory,
    removeSession,
    clearHistory,
  };
}