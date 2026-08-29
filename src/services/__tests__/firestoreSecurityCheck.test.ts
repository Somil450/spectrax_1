import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGetDoc = vi.fn();

vi.mock("../config/firebase", () => ({
  db: { mock: true },
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(() => "mock-collection"),
  doc: vi.fn(() => "mock-doc"),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}));

import { areFirestoreRulesEnforced, verifyFirestoreSecurity } from "../firestoreSecurityCheck";

describe("areFirestoreRulesEnforced", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false when the sentinel read succeeds (test mode)", async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true });
    await expect(areFirestoreRulesEnforced()).resolves.toBe(false);
  });

  it("returns true when the sentinel read is denied (rules deployed)", async () => {
    const permissionDenied = new Error("Missing or insufficient permissions");
    (permissionDenied as any).code = "permission-denied";
    mockGetDoc.mockRejectedValue(permissionDenied);
    await expect(areFirestoreRulesEnforced()).resolves.toBe(true);
  });
});

describe("verifyFirestoreSecurity", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("warns loudly and returns false in test mode", async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true });
    await expect(verifyFirestoreSecurity()).resolves.toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("SECURITY WARNING"),
    );
  });

  it("does not warn when rules are enforced", async () => {
    mockGetDoc.mockRejectedValue(new Error("permission-denied"));
    await expect(verifyFirestoreSecurity()).resolves.toBe(true);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("does not block the app when Firestore is unreachable", async () => {
    mockGetDoc.mockRejectedValue(new Error("network error"));
    await expect(verifyFirestoreSecurity()).resolves.toBe(true);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
