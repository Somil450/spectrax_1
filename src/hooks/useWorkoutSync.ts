/**
 * useWorkoutSync Hook
 * Manages workout syncing state and operations
 */

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "./useAuth";
import {
  saveWorkoutLocally,
  getLocalWorkouts,
  fullSyncWorkouts,
  initializeAutoSync,
  isOnline,
  getSyncStatus,
  SyncStatus,
  WorkoutRecord,
} from "../services/workoutSyncService";

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

  // Load local workouts on mount or when user changes
  useEffect(() => {
    const loadWorkouts = async () => {
      if (!user?.uid) return;

      setIsLoading(true);
      try {
        const localWorkouts = await getLocalWorkouts(user.uid);
        setWorkouts(localWorkouts);

        // Get current sync status
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
  }, [user?.uid]);

  // Initialize auto-sync when user logs in and online
  useEffect(() => {
    if (!user?.uid) return;

    // Perform initial sync if online
    if (isOnline()) {
      const initialSync = async () => {
        try {
          const status = await fullSyncWorkouts(user.uid);
          setSyncStatus(status);

          // Reload workouts after sync
          const updatedWorkouts = await getLocalWorkouts(user.uid);
          setWorkouts(updatedWorkouts);
        } catch (error) {
          console.error("Initial sync failed:", error);
        }
      };

      initialSync();
    }

    // Set up auto-sync listener for when connection is restored
    initializeAutoSync(user.uid);
  }, [user?.uid]);

  // Add new workout
  const addWorkout = useCallback(
    async (workout: Omit<WorkoutRecord, "userId" | "synced">) => {
      if (!user?.uid) {
        throw new Error("User not authenticated");
      }

      try {
        setIsLoading(true);
        const newWorkout: WorkoutRecord = {
          ...workout,
          userId: user.uid,
          synced: false,
          timestamp: Date.now(),
        };

        const localId = await saveWorkoutLocally(newWorkout);

        // Update local state
        const updatedWorkouts = await getLocalWorkouts(user.uid);
        setWorkouts(updatedWorkouts);

        // Try to sync immediately if online
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
    if (!user?.uid) {
      throw new Error("User not authenticated");
    }

    if (!isOnline()) {
      setSyncStatus((prev) => ({
        ...prev,
        error: "No internet connection",
      }));
      return;
    }

    try {
      setSyncStatus((prev) => ({ ...prev, isSyncing: true }));
      const status = await fullSyncWorkouts(user.uid);
      setSyncStatus(status);

      // Reload workouts after sync
      const updatedWorkouts = await getLocalWorkouts(user.uid);
      setWorkouts(updatedWorkouts);

      return status;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Sync failed";
      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, [user?.uid]);

  // Get sync status
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
    addWorkout,
    manualSync,
    refreshSyncStatus,
  };
}

export default useWorkoutSync;
