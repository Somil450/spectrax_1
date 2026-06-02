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
  getDocs,
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
  id?: string | number;
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
const DB_VERSION = 3; // Incremented for sync fields and localId keyPath upgrade
const WORKOUTS_STORE = "workout_sessions";
const SYNC_STATUS_STORE = "sync_status";

let dbPromise: Promise<IDBDatabase> | null = null;

function createDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      // Recreate workouts store to change keyPath from "id" to "localId"
      if (db.objectStoreNames.contains(WORKOUTS_STORE)) {
        db.deleteObjectStore(WORKOUTS_STORE);
      }

      const workoutStore = db.createObjectStore(WORKOUTS_STORE, {
        keyPath: "localId",
        autoIncrement: true,
      });
      workoutStore.createIndex("timestamp", "timestamp", { unique: false });
      workoutStore.createIndex("userId", "userId", { unique: false });
      workoutStore.createIndex("synced", "synced", { unique: false });

      // Create sync status store
      if (!db.objectStoreNames.contains(SYNC_STATUS_STORE)) {
        db.createObjectStore(SYNC_STATUS_STORE, { keyPath: "userId" });
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
}

async function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = createDB();
  }
  try {
    return await dbPromise;
  } catch (error) {
    dbPromise = null;
    throw error;
  }
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

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORKOUTS_STORE, "readonly");
    const store = tx.objectStore(WORKOUTS_STORE);
    const index = store.index("synced");
    const req = index.getAll(false as any);

    req.onsuccess = () => {
      const allUnsynced = req.result as WorkoutRecord[];
      // Filter for current user
      const userUnsynced = allUnsynced.filter((w) => w.userId === userId);
      resolve(userUnsynced);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Update sync status and key of a workout in IndexedDB
 */
async function markWorkoutAsSynced(localId: number, firestoreId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORKOUTS_STORE, "readwrite");
    const store = tx.objectStore(WORKOUTS_STORE);
    const getReq = store.get(localId);

    getReq.onsuccess = () => {
      const workout = getReq.result as WorkoutRecord;

      if (workout) {
        store.delete(localId);

        store.put({
          ...workout,
          id: firestoreId,
          synced: true,
        });
      }
    };

    // resolve only after transaction completes safely
    getReq.onerror = () => reject(getReq.error);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(new Error(`Transaction aborted for localId ${localId}`));
  });
}

/**
 * Update local workouts with Firestore data, preventing duplicates by reusing existing localId keys
 */
export async function updateLocalWorkoutsFromFirestore(
  userId: string,
  firestoreWorkouts: WorkoutRecord[],
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(WORKOUTS_STORE, "readwrite");
  const store = tx.objectStore(WORKOUTS_STORE);

  // Fetch all existing local records to match by firestore ID
  const localWorkouts = await new Promise<WorkoutRecord[]>((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as WorkoutRecord[]);
    req.onerror = () => reject(req.error);
  });

  return new Promise((resolve, reject) => {
    firestoreWorkouts.forEach((workout) => {
      const existing = localWorkouts.find((w) => w.id === workout.id);
      const recordToStore: WorkoutRecord = {
        ...workout,
        synced: true,
        userId,
      };

      if (existing && existing.localId) {
        recordToStore.localId = existing.localId;
      }

      store.put(recordToStore);
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
export async function getFirestoreWorkouts(userId: string): Promise<WorkoutRecord[]> {
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
        const firestoreId = await uploadWorkoutToFirestore(workout);
        const targetId = workout.localId ?? workout.id;
        if (targetId !== undefined) {
          await markWorkoutAsSynced(targetId as any, firestoreId);
          syncedCount++;
        }
      } catch (error) {
        console.error(`Failed to sync workout with localId ${workout.localId}:`, error);
        // Continue with next workout instead of throwing
      }
    }

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
    const db = getFirestore();

    const snapshot = await getDocs(collection(db, "workouts"));

    const firestoreWorkouts = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

console.log("Sync skipped - helper not implemented");
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
let onlineHandler: (() => void) | null = null;
let offlineHandler: (() => void) | null = null;

export function initializeAutoSync(userId: string): void {
  onlineHandler = async () => {
    if (syncInProgress) return;
    try {
      syncInProgress = true;
      console.log("Device back online. Syncing local workouts...");
      await syncWorkoutsToFirestore(userId);
      syncInProgress = false;
    } catch (error) {
      syncInProgress = false;
      console.error("Auto-sync failed:", error);
    }
  };

  offlineHandler = () => {
    console.log(
      "Network connection lost. Workouts will sync when back online.",
    );
  };

  // Add listeners
  window.addEventListener("online", onlineHandler);
  window.addEventListener("offline", offlineHandler);
}
export function cleanupAutoSync(): void {
  if (onlineHandler) {
    window.removeEventListener("online", onlineHandler);
    onlineHandler = null;
  }

  if (offlineHandler) {
    window.removeEventListener("offline", offlineHandler);
    offlineHandler = null;
  }
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

    // Mark each uploaded workout as synced in IndexedDB so subsequent
    // calls to getUnsyncedWorkouts do not find them again and re-upload them.
    for (let i = 0; i < workouts.length; i++) {
      const workout = workouts[i];
      const firestoreId = uploadedIds[i];
      const localKey =
        workout.localId !== undefined
          ? workout.localId
          : typeof workout.id === "number"
            ? workout.id
            : undefined;
      if (localKey !== undefined) {
        try {
          await markWorkoutAsSynced(localKey, firestoreId);
        } catch (syncError) {
          console.error(
            `[SpectraX] Failed to mark workout ${localKey} as synced locally:`,
            syncError,
          );
        }
      }
    }

    return uploadedIds;
  } catch (error) {
    console.error("Error in bulk upload:", error);
    throw error;
  }
}

/**
 * Delete a workout locally and from Firestore (if synced)
 */
export async function deleteWorkout(
  userId: string,
  id: string | number
): Promise<void> {
  const db = await openDB();
  
  // 1. Delete locally from IndexedDB
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(WORKOUTS_STORE, "readwrite");
    const req = tx.objectStore(WORKOUTS_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  // 2. Delete from Firestore if it was synced (string ID)
  if (typeof id === "string") {
    try {
      await deleteWorkoutFromFirestore(id);
    } catch (error) {
      console.error(`Failed to delete workout ${id} from Firestore:`, error);
      // Offline fallback: do not throw to allow offline experience
    }
  }
}

/**
 * Clear all workouts for a user locally and from Firestore
 */
export async function clearAllWorkouts(userId: string): Promise<void> {
  // Phase 1: delete from Firestore first.
  // If this throws (network error, permission denied) the local records are
  // left intact and the error propagates to the caller so the UI can surface
  // a meaningful message instead of falsely reporting success.
  const remoteWorkouts = await getFirestoreWorkouts(userId);
  for (const w of remoteWorkouts) {
    if (w.id) {
      await deleteWorkoutFromFirestore(w.id as string);
    }
  }

  // Phase 2: wipe IndexedDB only after remote deletion is confirmed.
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(WORKOUTS_STORE, "readwrite");
    const store = tx.objectStore(WORKOUTS_STORE);
    const index = store.index("userId");
    const req = index.openCursor(userId);

    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
try {
  const db = getFirestore();

  const snapshot = await getDocs(collection(db, "workouts"));

  const workouts = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));

  for (const w of workouts) {
    if (w.id) {
      await deleteWorkoutFromFirestore(w.id as string);
    }
  }
} catch (error) {
  console.error("Failed to clear workouts from Firestore:", error);
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
  cleanupAutoSync,
  initializeAutoSync,
  isOnline,
  getSyncStatus,
  bulkUploadWorkouts,
  deleteWorkout,
  clearAllWorkouts,
};

// TODO: Consider adding more comprehensive JSDoc comments
