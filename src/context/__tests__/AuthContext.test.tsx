import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

const mockOnAuthStateChanged = vi.fn();
const mockSignInWithEmailAndPassword = vi.fn();
const mockCreateUserWithEmailAndPassword = vi.fn();
const mockSignOut = vi.fn();
const mockSignInWithPopup = vi.fn();
const mockUpdateProfile = vi.fn();
const mockSendPasswordResetEmail = vi.fn();
const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({})),
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
  signInWithEmailAndPassword: (...args: unknown[]) =>
    mockSignInWithEmailAndPassword(...args),
  createUserWithEmailAndPassword: (...args: unknown[]) =>
    mockCreateUserWithEmailAndPassword(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  GoogleAuthProvider: vi.fn(() => ({})),
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  sendPasswordResetEmail: (...args: unknown[]) =>
    mockSendPasswordResetEmail(...args),
  browserLocalPersistence: "local",
  setPersistence: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
}));

vi.mock("../config/firebase", () => ({
  auth: {},
  db: {},
}));

import { AuthProvider, useAuth } from "../AuthContext";

function TestConsumer() {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="loading">{auth.loading.toString()}</div>
      <div data-testid="user">{auth.user?.email ?? "null"}</div>
      <div data-testid="error">{auth.error ?? "null"}</div>
    </div>
  );
}

function renderWithAuth() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>,
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes in loading state and resolves", async () => {
    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      setTimeout(() => cb(null), 10);
      return vi.fn();
    });

    renderWithAuth();

    expect(screen.getByTestId("loading").textContent).toBe("true");

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
  });

  it("sets user when auth state changes to authenticated", async () => {
    const mockUser = { uid: "123", email: "test@test.com" };
    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      setTimeout(() => cb(mockUser), 10);
      return vi.fn();
    });
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        uid: "123",
        email: "test@test.com",
        displayName: "Test",
        photoURL: null,
        createdAt: 1000,
        lastLogin: 1000,
      }),
    });

    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("test@test.com");
    });
  });

  it("clears user on sign out", async () => {
    const mockUser = { uid: "123", email: "test@test.com" };
    let authCallback: ((user: typeof mockUser | null) => void) | null = null;
    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      authCallback = cb as typeof authCallback;
      setTimeout(() => cb(mockUser), 10);
      return vi.fn();
    });
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        uid: "123",
        email: "test@test.com",
        displayName: "Test",
        photoURL: null,
        createdAt: 1000,
        lastLogin: 1000,
      }),
    });

    renderWithAuth();
    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("test@test.com");
    });

    mockSignOut.mockResolvedValue(undefined);
    if (authCallback) authCallback(null);

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("null");
    });
  });

  it("useAuth throws when used outside AuthProvider", () => {
    const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      "useAuth must be used inside AuthProvider",
    );
    consoleErr.mockRestore();
  });
});
