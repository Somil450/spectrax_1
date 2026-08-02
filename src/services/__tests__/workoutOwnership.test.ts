import { describe, it, expect } from "vitest";
import {
  assertWorkoutOwnedByUser,
  WorkoutOwnershipError,
} from "../workoutOwnership";

describe("assertWorkoutOwnedByUser", () => {
  it("passes when the workout belongs to the authenticated user", () => {
    expect(() => assertWorkoutOwnedByUser("alice-123", "alice-123")).not.toThrow();
  });

  it("throws when the workout targets another user (UID forgery)", () => {
    expect(() => assertWorkoutOwnedByUser("victim-456", "alice-123")).toThrow(
      WorkoutOwnershipError,
    );
  });

  it("throws when the current user is not authenticated", () => {
    expect(() => assertWorkoutOwnedByUser("alice-123", undefined)).toThrow(
      WorkoutOwnershipError,
    );
  });

  it("throws when the workout has no owner", () => {
    expect(() => assertWorkoutOwnedByUser(undefined, "alice-123")).toThrow(
      WorkoutOwnershipError,
    );
  });

  it("throws with a descriptive message naming the offending UIDs", () => {
    try {
      assertWorkoutOwnedByUser("victim-456", "alice-123");
      throw new Error("expected to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(WorkoutOwnershipError);
      expect((error as Error).message).toContain("victim-456");
      expect((error as Error).message).toContain("alice-123");
    }
  });
});
