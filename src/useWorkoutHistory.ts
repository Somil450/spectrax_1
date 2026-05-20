// src/hooks/useWorkoutHistory.ts
import { useState, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface WorkoutSession {
  id?: number;
  exerciseType: string;
  totalReps: number;
  accuracyScore: number; // 0–100
  duration: number;      // seconds
  timestamp: number;     // Date.now()
}

// ── DB bootstrap ─────────────────────────────────────────────────────────────

const DB_NAME = "spectrax_db";
const DB_VERSION = 1;
const STORE = "workout_sessions";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── CRUD helpers ─────────────────────────────────────────────────────────────

async function saveSession(session: WorkoutSession): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).add(session);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

async function getAllSessions(): Promise<WorkoutSession[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () =>
      resolve(
        (req.result as WorkoutSession[]).sort(
          (a, b) => b.timestamp - a.timestamp
        )
      );
    req.onerror = () => reject(req.error);
  });
}

async function deleteSession(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function clearAllSessions(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Hook ─────────────────────────────────────────────────────────────────────

interface UseWorkoutHistoryReturn {
  sessions: WorkoutSession[];
  loading: boolean;
  error: string | null;
  saveWorkout: (session: WorkoutSession) => Promise<void>;
  fetchHistory: () => Promise<void>;
  removeSession: (id: number) => Promise<void>;
  clearHistory: () => Promise<void>;
}

export function useWorkoutHistory(): UseWorkoutHistoryReturn {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllSessions();
      setSessions(data);
    } catch (err) {
      setError("Failed to load workout history.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveWorkout = useCallback(
    async (session: WorkoutSession) => {
      setError(null);
      try {
        await saveSession(session);
        await fetchHistory();
      } catch (err) {
        setError("Failed to save workout session.");
        console.error(err);
      }
    },
    [fetchHistory]
  );

  const removeSession = useCallback(
    async (id: number) => {
      setError(null);
      try {
        await deleteSession(id);
        setSessions((prev) => prev.filter((s) => s.id !== id));
      } catch (err) {
        setError("Failed to delete session.");
        console.error(err);
      }
    },
    []
  );

  const clearHistory = useCallback(async () => {
    setError(null);
    try {
      await clearAllSessions();
      setSessions([]);
    } catch (err) {
      setError("Failed to clear history.");
      console.error(err);
    }
  }, []);

  return {
    sessions,
    loading,
    error,
    saveWorkout,
    fetchHistory,
    removeSession,
    clearHistory,
  };
}