/**
 * useWorkoutSync Hook (CRDT-based)
 * Manages workout syncing with Yjs CRDT for offline-first multi-device support.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "./useAuth";
import {
  saveWorkoutLocally,
  getLocalWorkouts,
  fullSyncWorkouts,
  initializeAutoSync,
  cleanupAutoSync,
  isOnline,
  getSyncStatus,
  SyncStatus,
  WorkoutRecord,
} from "../services/workoutSyncService";
import { CRDTSessionEngine, loadSessionFromDB, listActiveSessions, clearOldSessions } from "../services/crdtSessionEngine";
import type { RepOperation, SessionSnapshot } from "../services/crdtSessionEngine";

export interface CRDTWorkoutRecord extends WorkoutRecord {
  crdtSessionId?: string;
  repOps?: RepOperation[];
  hlcVector?: Record<string, string>;
}

export function useWorkoutSync() {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    lastSyncTime: null,
    pendingUploads: 0,
    error: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [activeSession, setActiveSession] = useState<SessionSnapshot | null>(null);
  const crdtEngineRef = useRef<CRDTSessionEngine | null>(null);

  // Load local workouts + active CRDT sessions on mount
  useEffect(() => {
    const loadWorkouts = async () => {
      if (!user?.uid) return;

      setIsLoading(true);
      try {
        const localWorkouts = await getLocalWorkouts(user.uid);
        setWorkouts(localWorkouts);

        // Load active CRDT sessions
        const sessions = await listActiveSessions();
        const recentSession = sessions
          .filter((s) => Date.now() - s.lastUpdate < 30 * 60 * 1000)
          .sort((a, b) => b.lastUpdate - a.lastUpdate)[0];

        if (recentSession) {
          const state = await loadSessionFromDB(recentSession.sessionId);
          if (state) {
            const engine = CRDTSessionEngine.fromState(state);
            crdtEngineRef.current = engine;
            setActiveSession(engine.getSnapshot());
          }
        }

        const status = await getSyncStatus(user.uid);
        setSyncStatus(status);
      } catch (error) {
        console.error("Error loading workouts:", error);
        setSyncStatus((prev) => ({
          ...prev,
          error: "Failed to load workouts",
        }));
      } finally {
        setIsLoading(false);
      }
    };

    loadWorkouts();

    // Cleanup old sessions periodically
    const cleanupInterval = setInterval(() => {
      clearOldSessions(24 * 60 * 60 * 1000).catch(console.error);
    }, 60 * 60 * 1000); // Every hour

    return () => clearInterval(cleanupInterval);
  }, [user?.uid]);

  // Initialize auto-sync when user logs in
  useEffect(() => {
    if (!user?.uid) return;

    if (isOnline()) {
      const initialSync = async () => {
        try {
          const status = await fullSyncWorkouts(user.uid);
          setSyncStatus(status);
          const updatedWorkouts = await getLocalWorkouts(user.uid);
          setWorkouts(updatedWorkouts);
        } catch (error) {
          console.error("Initial sync failed:", error);
        }
      };
      initialSync();
    }

    initializeAutoSync(user.uid);
    return () => cleanupAutoSync();
  }, [user?.uid]);

  // Start a new CRDT-backed workout session
  const startSession = useCallback((exerciseKey: string, exerciseName: string) => {
    const engine = new CRDTSessionEngine(exerciseKey, exerciseName);
    crdtEngineRef.current = engine;
    setActiveSession(engine.getSnapshot());
    return engine;
  }, []);

  // Record a rep in the active CRDT session
  const recordRep = useCallback((state: any, angles: Record<string, number>) => {
    if (!crdtEngineRef.current) return null;
    const op = crdtEngineRef.current.recordRep(state, angles);
    setActiveSession(crdtEngineRef.current.getSnapshot());
    return op;
  }, []);

  // Update session state (non-rep changes)
  const updateSessionState = useCallback((state: Partial<any>) => {
    if (!crdtEngineRef.current) return;
    crdtEngineRef.current.updateState(state);
    setActiveSession(crdtEngineRef.current.getSnapshot());
  }, []);

  // Get current session for handoff
  const getSessionForHandoff = useCallback((): Uint8Array | null => {
    if (!crdtEngineRef.current) return null;
    return crdtEngineRef.current.encodeState();
  }, []);

  // Apply handoff from another device
  const applyHandoff = useCallback((update: Uint8Array) => {
    const engine = CRDTSessionEngine.fromState(update);
    crdtEngineRef.current = engine;
    setActiveSession(engine.getSnapshot());
    return engine.getSnapshot();
  }, []);

  // End session and save to traditional workout storage
  const endSession = useCallback(async () => {
    if (!crdtEngineRef.current || !user?.uid) return null;

    const snapshot = crdtEngineRef.current.getSnapshot();
    const record: CRDTWorkoutRecord = {
      userId: user.uid,
      exerciseType: snapshot.exerciseKey,
      totalReps: snapshot.state.totalReps || 0,
      accuracyScore: snapshot.state.accuracy || 0,
      duration: Math.floor((Date.now() - snapshot.startTime) / 1000),
      timestamp: Date.now(),
      synced: false,
      crdtSessionId: snapshot.sessionId,
      repOps: snapshot.repOps,
      hlcVector: snapshot.hlcVector,
    };

    const localId = await saveWorkoutLocally(record);
    const updatedWorkouts = await getLocalWorkouts(user.uid);
    setWorkouts(updatedWorkouts);
    setActiveSession(null);

    // Clear CRDT session after successful save
    const { clearSession } = await import("../services/crdtSessionEngine");
    await clearSession(snapshot.sessionId);
    crdtEngineRef.current = null;

    return localId;
  }, [user?.uid]);

  // Legacy addWorkout (for completed sessions without CRDT)
  const addWorkout = useCallback(
    async (workout: Omit<WorkoutRecord, "userId" | "synced">) => {
      if (!user?.uid) throw new Error("User not authenticated");

      setIsLoading(true);
      try {
        const newWorkout: WorkoutRecord = {
          ...workout,
          userId: user.uid,
          synced: false,
          timestamp: Date.now(),
        };

        const localId = await saveWorkoutLocally(newWorkout);
        const updatedWorkouts = await getLocalWorkouts(user.uid);
        setWorkouts(updatedWorkouts);

        if (isOnline()) {
          try {
            const status = await fullSyncWorkouts(user.uid);
            setSyncStatus(status);
          } catch (syncError) {
            console.warn("Auto-sync failed, will retry later:", syncError);
          }
        }

        return localId;
      } catch (error) {
        console.error("Error adding workout:", error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [user?.uid],
  );

  // Manual sync
  const manualSync = useCallback(async () => {
    if (!user?.uid) throw new Error("User not authenticated");
    if (!isOnline()) {
      setSyncStatus((prev) => ({ ...prev, error: "No internet connection" }));
      return;
    }

    try {
      setSyncStatus((prev) => ({ ...prev, isSyncing: true }));
      const status = await fullSyncWorkouts(user.uid);
      setSyncStatus(status);
      const updatedWorkouts = await getLocalWorkouts(user.uid);
      setWorkouts(updatedWorkouts);
      return status;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Sync failed";
      setSyncStatus((prev) => ({ ...prev, isSyncing: false, error: errorMessage }));
      throw error;
    }
  }, [user?.uid]);

  // Refresh sync status
  const refreshSyncStatus = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const status = await getSyncStatus(user.uid);
      setSyncStatus(status);
    } catch (error) {
      console.error("Error refreshing sync status:", error);
    }
  }, [user?.uid]);

  return {
    workouts,
    syncStatus,
    isLoading,
    isOnline: isOnline(),
    activeSession,
    startSession,
    recordRep,
    updateSessionState,
    getSessionForHandoff,
    applyHandoff,
    endSession,
    addWorkout,
    manualSync,
    refreshSyncStatus,
  };
}

export default useWorkoutSync;