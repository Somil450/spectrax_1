/**
 * AuthContext.tsx
 *
 * Global authentication context managing:
 * - Firebase Authentication (Email/Password, Google Sign-In)
 * - User Profile persistence in Firestore
 * - Session management with localStorage persistence
 * - Error handling with user-friendly messages
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db } from "../config/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

// ─────────────────────── TYPES & INTERFACES ────────────────────────

/** User profile stored in Firestore */
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  createdAt: number;
  lastLogin: number;
}

/** Authentication context type */
export interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signUp: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  clearError: () => void;
}

// ─────────────────────── CONTEXT CREATION ────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export { AuthContext };

// ─────────────────────── HELPER FUNCTIONS ────────────────────────

/**
 * Convert Firebase error codes to user-friendly messages
 */
const getErrorMessage = (error: unknown): string => {
  // Check if error has Firebase error properties
  const firebaseError = error as any;
  const errorCode = firebaseError?.code || "";

  // Email/Password errors
  if (errorCode === "auth/invalid-email") return "Invalid email address";
  if (
    errorCode === "auth/user-not-found" ||
    errorCode === "auth/wrong-password" ||
    errorCode === "auth/invalid-credential"
  )
    return "Invalid email or password";
  if (errorCode === "auth/user-disabled")
    return "This account has been disabled";
  if (errorCode === "auth/email-already-in-use")
    return "Email already registered";
  if (errorCode === "auth/weak-password")
    return "Password must be at least 6 characters";
  if (errorCode === "auth/too-many-requests")
    return "Too many login attempts. Try again later";
  if (errorCode === "auth/network-request-failed")
    return "Network error. Check your connection";

  // Google Sign-In errors
  if (errorCode === "auth/popup-closed-by-user") return "Sign-in cancelled";
  if (errorCode === "auth/popup-blocked") return "Sign-in popup was blocked";
  if (errorCode === "auth/account-exists-with-different-credential") {
    return "Email already registered with different sign-in method";
  }

  if (errorCode) {
    return "Something went wrong. Please try again.";
  }

  // Non-Firebase errors
  if (error instanceof Error) {
    return error.message;
  }

  return "An unknown error occurred";
};

/**
 * Create or update user profile in Firestore
 */
const syncUserProfile = async (
  firebaseUser: User,
  isNewUser: boolean = false,
): Promise<UserProfile> => {
  const userDocRef = doc(db, "users", firebaseUser.uid);
  const userDocSnap = await getDoc(userDocRef);

  if (userDocSnap.exists() && !isNewUser) {
    // Existing user - update last login and return profile
    await setDoc(userDocRef, { lastLogin: Date.now() }, { merge: true });
    return userDocSnap.data() as UserProfile;
  }

  // New user or first-time sync - create profile
  const profile: UserProfile = {
    uid: firebaseUser.uid,
    email: firebaseUser.email || "",
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    createdAt: Date.now(),
    lastLogin: Date.now(),
  };

  await setDoc(userDocRef, profile, { merge: true });
  return profile;
};

// ─────────────────────── AUTH PROVIDER COMPONENT ────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Listen for authentication state changes
   * Automatically syncs user profile when auth state changes
   */
  useEffect(() => {
    // If Firebase is not configured, resolve loading immediately (demo/offline mode)
    if (!import.meta.env.VITE_FIREBASE_API_KEY) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (currentUser) {
          setUser(currentUser);
          const profile = await syncUserProfile(currentUser);
          setUserProfile(profile);
          console.log("✅ User loaded:", currentUser.uid);
        } else {
          setUser(null);
          setUserProfile(null);
        }
      } catch (err) {
        const errorMsg = getErrorMessage(err);
        console.error("❌ Auth state error:", err);
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  /**
   * Sign up with email and password
   * Creates user account and Firestore profile
   */
  const signUp = async (
    email: string,
    password: string,
    displayName: string,
  ) => {
    try {
      setError(null);

      // Validate inputs
      if (!email || !password || !displayName) {
        throw new Error("All fields are required");
      }

      // Create Firebase Auth user
      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );

      // Update display name in Firebase Auth
      await updateProfile(result.user, { displayName });

      // Create user profile in Firestore
      const profile = await syncUserProfile(result.user, true);
      setUserProfile(profile);

      console.log("✅ Sign up successful:", result.user.uid);
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      console.error("❌ Sign up error:", err);
      throw err;
    }
  };

  /**
   * Sign in with email and password
   */
  const signIn = async (email: string, password: string) => {
    try {
      setError(null);

      // Validate inputs
      if (!email || !password) {
        throw new Error("Email and password are required");
      }

      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log("✅ Sign in successful:", result.user.uid);
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      console.error("❌ Sign in error:", err);
      throw err;
    }
  };

  /**
   * Sign in with Google OAuth
   * Creates account if user doesn't exist
   */
  const signInWithGoogle = async () => {
    try {
      setError(null);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      // Create or update user profile
      const profile = await syncUserProfile(result.user, true);
      setUserProfile(profile);

      console.log("✅ Google sign-in successful:", result.user.uid);
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      console.error("❌ Google sign-in error:", err);
      throw err;
    }
  };

  /**
   * Sign out and clear session
   */
  const logout = async () => {
    try {
      setError(null);
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
      console.log("✅ Logged out successfully");
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      console.error("❌ Logout error:", err);
      throw err;
    }
  };

  /**
   * Send password reset email
   */
  const resetPassword = async (email: string) => {
    try {
      setError(null);

      if (!email) {
        throw new Error("Email is required");
      }

      await sendPasswordResetEmail(auth, email);
      console.log("✅ Password reset email sent to:", email);
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      console.error("❌ Reset password error:", err);
      throw err;
    }
  };

  /**
   * Update user profile (name, photo, etc.)
   * Updates both Firebase Auth and Firestore
   */
  const updateUserProfile = async (updates: Partial<UserProfile>) => {
    if (!user) {
      const msg = "No user logged in";
      setError(msg);
      throw new Error(msg);
    }

    try {
      setError(null);
      const userDocRef = doc(db, "users", user.uid);

      // Prepare Firebase Auth updates
      const authUpdates: { displayName?: string; photoURL?: string } = {};
      if (updates.displayName !== undefined) {
        authUpdates.displayName = updates.displayName;
      }
      if (updates.photoURL !== undefined) {
        authUpdates.photoURL = updates.photoURL;
      }

      // Update Firebase Auth profile
      if (Object.keys(authUpdates).length > 0) {
        await updateProfile(user, authUpdates);
      }

      // Update Firestore document
      await setDoc(userDocRef, updates, { merge: true });

      // Update local state
      setUserProfile((prev) => (prev ? { ...prev, ...updates } : null));

      console.log("✅ Profile updated");
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      setError(errorMsg);
      console.error("❌ Update profile error:", err);
      throw err;
    }
  };

  /**
   * Clear error message
   */
  const clearError = () => {
    setError(null);
  };

  // ─────────────────────── CONTEXT VALUE ────────────────────────

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    error,
    signUp,
    signIn,
    signInWithGoogle,
    logout,
    resetPassword,
    updateUserProfile,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─────────────────────── CUSTOM HOOK ────────────────────────

/**
 * useAuth hook - Use this in any component to access auth functionality
 *
 * @example
 * const { user, signIn, signOut } = useAuth();
 *
 * @throws Error if used outside AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
