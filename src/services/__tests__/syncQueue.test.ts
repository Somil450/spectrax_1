import { describe, it, expect, beforeEach, vi } from "vitest";
import { syncOfflineQueue } from "../syncQueue";
import * as offlineQueue from "../../utils/offlineQueue";
import type { ReplaySession } from "../../utils/offlineQueue";

// Mock Firebase
vi.mock("firebase/auth", () => ({
  getAuth: () => ({
    currentUser: { uid: "user-123" },
  }),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  addDoc: vi.fn().mockResolvedValue({ id: "firestore-doc-id" }),
  serverTimestamp: vi.fn(() => "mock-timestamp"),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockSession(id: string): ReplaySession {
  return {
    id,
    userId: "user-123",
    exerciseType: "squats",
    timestamp: Date.now(),
    archive: {
      codec: "rld-delta-v1",
      frameCount: 5,
      generatedAt: Date.now(),
      frames: [],
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("syncOfflineQueue", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("returns { synced: 0, failed: 0 } when queue is empty", async () => {
    const result = await syncOfflineQueue();
    expect(result).toEqual({ synced: 0, failed: 0 });
  });

  it("syncs all sessions and removes them from queue on success", async () => {
    offlineQueue.enqueueSession(createMockSession("s1"));
    offlineQueue.enqueueSession(createMockSession("s2"));

    const result = await syncOfflineQueue();

    expect(result.synced).toBe(2);
    expect(result.failed).toBe(0);
    expect(offlineQueue.getQueue()).toHaveLength(0);
  });

  it("keeps failed sessions in queue and continues with remaining", async () => {
    const { addDoc } = await import("firebase/firestore");
    const mockAddDoc = vi.mocked(addDoc);

    // First call succeeds, second fails, third succeeds
    mockAddDoc
      .mockResolvedValueOnce({ id: "doc-1" } as any)
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({ id: "doc-3" } as any);

    offlineQueue.enqueueSession(createMockSession("s1"));
    offlineQueue.enqueueSession(createMockSession("s2"));
    offlineQueue.enqueueSession(createMockSession("s3"));

    const result = await syncOfflineQueue();

    expect(result.synced).toBe(2);
    expect(result.failed).toBe(1);

    // Only the failed session remains in queue
    const remaining = offlineQueue.getQueue();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("s2");
  });

  it("handles all sessions failing gracefully", async () => {
    const { addDoc } = await import("firebase/firestore");
    const mockAddDoc = vi.mocked(addDoc);
    mockAddDoc.mockRejectedValue(new Error("Server down"));

    offlineQueue.enqueueSession(createMockSession("s1"));
    offlineQueue.enqueueSession(createMockSession("s2"));

    const result = await syncOfflineQueue();

    expect(result.synced).toBe(0);
    expect(result.failed).toBe(2);
    expect(offlineQueue.getQueue()).toHaveLength(2);
  });
});
