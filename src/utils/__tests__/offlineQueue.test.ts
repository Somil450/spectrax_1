import { describe, it, expect, beforeEach } from "vitest";
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
  beforeEach(async () => {
    // Clear IndexedDB by clearing the queue
    await clearQueue();
  });

  describe("enqueueSession", () => {
    it("adds a session to an empty queue", async () => {
      const session = createMockSession("s1");
      await enqueueSession(session);

      const queue = await getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe("s1");
    });

    it("appends to existing queue", async () => {
      await enqueueSession(createMockSession("s1"));
      await enqueueSession(createMockSession("s2"));

      const queue = await getQueue();
      expect(queue).toHaveLength(2);
      expect(queue[0].id).toBe("s1");
      expect(queue[1].id).toBe("s2");
    });

    it("preserves session data correctly", async () => {
      const session = createMockSession("s1");
      session.exerciseType = "pushups";
      await enqueueSession(session);

      const queue = await getQueue();
      expect(queue[0].exerciseType).toBe("pushups");
      expect(queue[0].userId).toBe("user-123");
      expect(queue[0].archive.codec).toBe("rld-delta-v1");
    });
  });

  describe("getQueue", () => {
    it("returns empty array when no queue exists", async () => {
      const queue = await getQueue();
      expect(queue).toEqual([]);
    });
  });

  describe("clearQueue", () => {
    it("removes all sessions from the queue", async () => {
      await enqueueSession(createMockSession("s1"));
      await enqueueSession(createMockSession("s2"));
      expect(await getQueue()).toHaveLength(2);

      await clearQueue();
      expect(await getQueue()).toEqual([]);
    });

    it("does not throw on empty queue", async () => {
      await expect(clearQueue()).resolves.not.toThrow();
    });
  });

  describe("removeFromQueue", () => {
    it("removes a specific session by ID", async () => {
      await enqueueSession(createMockSession("s1"));
      await enqueueSession(createMockSession("s2"));
      await enqueueSession(createMockSession("s3"));

      await removeFromQueue("s2");

      const queue = await getQueue();
      expect(queue).toHaveLength(2);
      expect(queue.map((s) => s.id)).toEqual(["s1", "s3"]);
    });

    it("does nothing if ID not found", async () => {
      await enqueueSession(createMockSession("s1"));
      await removeFromQueue("nonexistent");

      expect(await getQueue()).toHaveLength(1);
    });

    it("handles removing from empty queue", async () => {
      await expect(removeFromQueue("s1")).resolves.not.toThrow();
      expect(await getQueue()).toEqual([]);
    });
  });
});
