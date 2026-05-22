/**
 * Workout Sync Service
 * Handles syncing workout data between local IndexedDB and Firestore
 * Supports offline persistence and automatic synchronization
 */

import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

// ─────────────────────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkoutRecord {
  id?: string;
  userId: string;
  exerciseType: string;
  totalReps: number;
  accuracyScore: number; // 0–100
  duration: number; // seconds
  timestamp: number; // Date.now() for local timestamp
  createdAt?: any; // Firestore server timestamp
  updatedAt?: any; // Firestore server timestamp
  synced: boolean; // Local flag for sync status
  localId?: number; // IndexedDB id for tracking
}

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncTime: number | null;
  pendingUploads: number;
  error: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// IndexedDB Setup
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME = "spectrax_db";
const DB_VERSION = 2; // Incremented for sync fields
const WORKOUTS_STORE = "workout_sessions";
const SYNC_STATUS_STORE = "sync_status";

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      // Create workouts store
      if (!db.objectStoreNames.contains(WORKOUTS_STORE)) {
        const workoutStore = db.createObjectStore(WORKOUTS_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        workoutStore.createIndex("timestamp", "timestamp", { unique: false });
        workoutStore.createIndex("userId", "userId", { unique: false });
        workoutStore.createIndex("synced", "synced", { unique: false });
      }

      // Create sync status store
      if (!db.objectStoreNames.contains(SYNC_STATUS_STORE)) {
        db.createObjectStore(SYNC_STATUS_STORE, { keyPath: "userId" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Local Storage (IndexedDB) Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save a workout session to IndexedDB with sync flag
 */
export async function saveWorkoutLocally(
  workout: WorkoutRecord,
): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORKOUTS_STORE, "readwrite");
    const req = tx.objectStore(WORKOUTS_STORE).add({
      ...workout,
      synced: false, // Mark as not synced initially
    });
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get all workouts for a user from IndexedDB
 */
export async function getLocalWorkouts(
  userId: string,
): Promise<WorkoutRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORKOUTS_STORE, "readonly");
    const index = tx.objectStore(WORKOUTS_STORE).index("userId");
    const req = index.getAll(userId);
    req.onsuccess = () => resolve(req.result as WorkoutRecord[]);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get unsynced workouts from IndexedDB
 */
export async function getUnsyncedWorkouts(
  userId: string,
): Promise<WorkoutRecord[]> {
  const all = await getLocalWorkouts(userId);
  return all.filter((w) => !w.synced);
}

/**
 * Update sync status of a workout in IndexedDB
 */
async function markWorkoutAsSynced(localId: number | string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORKOUTS_STORE, "readwrite");
    const req = tx.objectStore(WORKOUTS_STORE).get(localId);

    req.onsuccess = () => {
      const workout = req.result as WorkoutRecord;
      if (workout) {
        workout.synced = true;
        tx.objectStore(WORKOUTS_STORE).put(workout);
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Update local workouts with Firestore data
 */
async function updateLocalWorkoutsFromFirestore(
  userId: string,
  firestoreWorkouts: WorkoutRecord[],
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(WORKOUTS_STORE, "readwrite");
  const store = tx.objectStore(WORKOUTS_STORE);

  return new Promise((resolve, reject) => {
    firestoreWorkouts.forEach((workout) => {
      store.put({
        ...workout,
        synced: true,
        userId, // Ensure userId is set
      });
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Firestore Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload a workout to Firestore
 */
export async function uploadWorkoutToFirestore(
  workout: WorkoutRecord,
): Promise<string> {
  try {
    const auth = getAuth();
    const userId = auth.currentUser?.uid;

    if (!userId) {
      throw new Error("User not authenticated");
    }

    const db = getFirestore();
    const workoutsRef = collection(db, "users", userId, "workouts");

    const docRef = await addDoc(workoutsRef, {
      exerciseType: workout.exerciseType,
      totalReps: workout.totalReps,
      accuracyScore: workout.accuracyScore,
      duration: workout.duration,
      timestamp: workout.timestamp,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    console.error("Error uploading workout to Firestore:", error);
    throw error;
  }
}

/**
 * Get all workouts from Firestore for current user
 */
export async function getFirestoreWorkouts(): Promise<WorkoutRecord[]> {
  try {
    const auth = getAuth();
    const userId = auth.currentUser?.uid;

    if (!userId) {
      throw new Error("User not authenticated");
    }

    const db = getFirestore();
    const workoutsRef = collection(db, "users", userId, "workouts");
    const q = query(workoutsRef);

    const querySnapshot = await getDocs(q);
    const workouts: WorkoutRecord[] = [];

    querySnapshot.forEach((doc) => {
      workouts.push({
        id: doc.id,
        userId,
        ...doc.data(),
      } as WorkoutRecord);
    });

    return workouts;
  } catch (error) {
    console.error("Error fetching workouts from Firestore:", error);
    throw error;
  }
}

/**
 * Delete a workout from Firestore
 */
export async function deleteWorkoutFromFirestore(
  workoutId: string,
): Promise<void> {
  try {
    const auth = getAuth();
    const userId = auth.currentUser?.uid;

    if (!userId || !workoutId) {
      throw new Error("Missing userId or workoutId");
    }

    const db = getFirestore();
    const workoutRef = doc(db, "users", userId, "workouts", workoutId);
    await deleteDoc(workoutRef);
  } catch (error) {
    console.error("Error deleting workout from Firestore:", error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sync all unsynced workouts to Firestore
 */
export async function syncWorkoutsToFirestore(userId: string): Promise<number> {
  try {
    const unsyncedWorkouts = await getUnsyncedWorkouts(userId);
    let syncedCount = 0;

    for (const workout of unsyncedWorkouts) {
      try {
        await uploadWorkoutToFirestore(workout);
        // Use localId (the IndexedDB auto-increment key) rather than workout.id
        // which may be a Firestore string and would produce NaN when cast to Number.
        if (workout.localId != null) {
          await markWorkoutAsSynced(workout.localId);
          syncedCount++;
        }
      } catch (error) {
        console.error(`Failed to sync workout ${workout.id}:`, error);
        // Continue with next workout instead of throwing
      }
    }

    console.log(`Successfully synced ${syncedCount} workouts to Firestore`);
    return syncedCount;
  } catch (error) {
    console.error("Error syncing workouts to Firestore:", error);
    throw error;
  }
}

/**
 * Download workouts from Firestore and merge with local
 */
export async function syncWorkoutsFromFirestore(userId: string): Promise<void> {
  try {
    const firestoreWorkouts = await getFirestoreWorkouts();
    await updateLocalWorkoutsFromFirestore(userId, firestoreWorkouts);
    console.log(
      `Downloaded ${firestoreWorkouts.length} workouts from Firestore`,
    );
  } catch (error) {
    console.error("Error syncing workouts from Firestore:", error);
    throw error;
  }
}

/**
 * Full bidirectional sync - upload local changes and download remote
 */
export async function fullSyncWorkouts(userId: string): Promise<SyncStatus> {
  const syncStatus: SyncStatus = {
    isSyncing: true,
    lastSyncTime: null,
    pendingUploads: 0,
    error: null,
  };

  try {
    // Get pending uploads count before sync
    const unsyncedWorkouts = await getUnsyncedWorkouts(userId);
    syncStatus.pendingUploads = unsyncedWorkouts.length;

    // Upload unsynced workouts to Firestore
    if (unsyncedWorkouts.length > 0) {
      const uploadedCount = await syncWorkoutsToFirestore(userId);
      syncStatus.pendingUploads = unsyncedWorkouts.length - uploadedCount;
    }

    // Download workouts from Firestore
    await syncWorkoutsFromFirestore(userId);

    syncStatus.isSyncing = false;
    syncStatus.lastSyncTime = Date.now();

    return syncStatus;
  } catch (error) {
    syncStatus.isSyncing = false;
    syncStatus.error =
      error instanceof Error ? error.message : "Unknown sync error";
    console.error("Full sync error:", error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Offline Detection & Auto-Sync
// ─────────────────────────────────────────────────────────────────────────────

let syncInProgress = false;

/**
 * Start auto-sync when connection is restored
 */
export function initializeAutoSync(userId: string): void {
  // Listen for online event
  window.addEventListener("online", async () => {
    console.log("Network connection restored. Starting workout sync...");
    try {
      if (!syncInProgress) {
        syncInProgress = true;
        await fullSyncWorkouts(userId);
        syncInProgress = false;
        console.log("Workout sync completed");
      }
    } catch (error) {
      syncInProgress = false;
      console.error("Auto-sync failed:", error);
    }
  });

  // Listen for offline event
  window.addEventListener("offline", () => {
    console.log(
      "Network connection lost. Workouts will sync when back online.",
    );
  });
}

/**
 * Check if device is online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Get current sync status from IndexedDB
 */
export async function getSyncStatus(userId: string): Promise<SyncStatus> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SYNC_STATUS_STORE, "readonly");
      const req = tx.objectStore(SYNC_STATUS_STORE).get(userId);

      req.onsuccess = () => {
        const status = req.result || {
          isSyncing: false,
          lastSyncTime: null,
          pendingUploads: 0,
          error: null,
        };
        resolve(status as SyncStatus);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.error("Error getting sync status:", error);
    return {
      isSyncing: false,
      lastSyncTime: null,
      pendingUploads: 0,
      error: "Unable to retrieve sync status",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch Operations for Performance
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bulk upload workouts with batch operations
 */
export async function bulkUploadWorkouts(
  workouts: WorkoutRecord[],
): Promise<string[]> {
  try {
    const auth = getAuth();
    const userId = auth.currentUser?.uid;

    if (!userId) {
      throw new Error("User not authenticated");
    }

    const db = getFirestore();
    const batch = writeBatch(db);
    const uploadedIds: string[] = [];

    workouts.forEach((workout) => {
      const workoutRef = doc(collection(db, "users", userId, "workouts"));
      batch.set(workoutRef, {
        exerciseType: workout.exerciseType,
        totalReps: workout.totalReps,
        accuracyScore: workout.accuracyScore,
        duration: workout.duration,
        timestamp: workout.timestamp,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      uploadedIds.push(workoutRef.id);
    });

    await batch.commit();
    return uploadedIds;
  } catch (error) {
    console.error("Error in bulk upload:", error);
    throw error;
  }
}

export default {
  saveWorkoutLocally,
  getLocalWorkouts,
  getUnsyncedWorkouts,
  uploadWorkoutToFirestore,
  getFirestoreWorkouts,
  deleteWorkoutFromFirestore,
  syncWorkoutsToFirestore,
  syncWorkoutsFromFirestore,
  fullSyncWorkouts,
  initializeAutoSync,
  isOnline,
  getSyncStatus,
  bulkUploadWorkouts,
};
