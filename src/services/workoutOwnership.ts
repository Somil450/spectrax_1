/**
 * Client-side row-level security defense-in-depth for Firestore workouts.
 *
 * Firestore security rules (`firestore.rules`) are the authoritative access
 * control layer — every write to `/users/{userId}/workouts/{workoutId}` is
 * rejected server-side unless `request.auth.uid == userId`. These helpers add
 * an extra client-side integrity check so a tampered/buggy client refuses to
 * even attempt a cross-user write instead of relying solely on the network.
 */

export class WorkoutOwnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkoutOwnershipError";
  }
}

/**
 * Verifies that a workout record belongs to the currently authenticated user
 * before it is written to Firestore. Throws `WorkoutOwnershipError` when the
 * record is missing an owner or the owner does not match `currentUserId`.
 *
 * @param workoutUserId - owner claimed by the workout record (`WorkoutRecord.userId`)
 * @param currentUserId - authenticated user's UID (`auth.currentUser?.uid`)
 */
export function assertWorkoutOwnedByUser(
  workoutUserId: string | undefined,
  currentUserId: string | undefined,
): void {
  if (!currentUserId) {
    throw new WorkoutOwnershipError("User not authenticated");
  }
  if (!workoutUserId) {
    throw new WorkoutOwnershipError(
      "Workout is missing an owner (userId) — refusing to guess a target user",
    );
  }
  if (workoutUserId !== currentUserId) {
    throw new WorkoutOwnershipError(
      `Workout UID mismatch: record belongs to "${workoutUserId}" but current user is "${currentUserId}". Refusing cross-user write.`,
    );
  }
}
