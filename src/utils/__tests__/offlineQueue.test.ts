import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  enqueueSession,
  getQueue,
  clearQueue,
  removeFromQueue,
} from "../offlineQueue";
import type { ReplaySession } from "../offlineQueue";

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockSession(id: string): ReplaySession {
  return {
    id,
    userId: "user-123",
    exerciseType: "squats",
    timestamp: Date.now(),
    archive: {
      codec: "rld-delta-v1",
      frameCount: 10,
      generatedAt: Date.now(),
      frames: [],
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("offlineQueue", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("enqueueSession", () => {
    it("adds a session to an empty queue", () => {
      const session = createMockSession("s1");
      enqueueSession(session);

      const queue = getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe("s1");
    });

    it("appends to existing queue", () => {
      enqueueSession(createMockSession("s1"));
      enqueueSession(createMockSession("s2"));

      const queue = getQueue();
      expect(queue).toHaveLength(2);
      expect(queue[0].id).toBe("s1");
      expect(queue[1].id).toBe("s2");
    });

    it("preserves session data correctly", () => {
      const session = createMockSession("s1");
      session.exerciseType = "pushups";
      enqueueSession(session);

      const queue = getQueue();
      expect(queue[0].exerciseType).toBe("pushups");
      expect(queue[0].userId).toBe("user-123");
      expect(queue[0].archive.codec).toBe("rld-delta-v1");
    });
  });

  describe("getQueue", () => {
    it("returns empty array when no queue exists", () => {
      expect(getQueue()).toEqual([]);
    });

    it("returns empty array for corrupted data", () => {
      localStorage.setItem("spectrax_offline_replay_queue", "not-json{{{");
      expect(getQueue()).toEqual([]);
    });

    it("returns empty array for non-array JSON", () => {
      localStorage.setItem(
        "spectrax_offline_replay_queue",
        JSON.stringify({ foo: "bar" }),
      );
      expect(getQueue()).toEqual([]);
    });
  });

  describe("clearQueue", () => {
    it("removes all sessions from the queue", () => {
      enqueueSession(createMockSession("s1"));
      enqueueSession(createMockSession("s2"));
      expect(getQueue()).toHaveLength(2);

      clearQueue();
      expect(getQueue()).toEqual([]);
    });

    it("does not throw on empty queue", () => {
      expect(() => clearQueue()).not.toThrow();
    });
  });

  describe("removeFromQueue", () => {
    it("removes a specific session by ID", () => {
      enqueueSession(createMockSession("s1"));
      enqueueSession(createMockSession("s2"));
      enqueueSession(createMockSession("s3"));

      removeFromQueue("s2");

      const queue = getQueue();
      expect(queue).toHaveLength(2);
      expect(queue.map((s) => s.id)).toEqual(["s1", "s3"]);
    });

    it("does nothing if ID not found", () => {
      enqueueSession(createMockSession("s1"));
      removeFromQueue("nonexistent");

      expect(getQueue()).toHaveLength(1);
    });

    it("handles removing from empty queue", () => {
      expect(() => removeFromQueue("s1")).not.toThrow();
      expect(getQueue()).toEqual([]);
    });
  });
});
