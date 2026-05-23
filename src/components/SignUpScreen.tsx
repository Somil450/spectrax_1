import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Mail, Lock, User, Loader } from "lucide-react";
import "../styles/auth.css";

interface SignUpScreenProps {
  onSignUpSuccess: () => void;
  onLoginClick: () => void;
}

export function SignUpScreen({
  onSignUpSuccess,
  onLoginClick,
}: SignUpScreenProps) {
  const { signUp, error, clearError, loading } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);

  // Safe localStorage helper to prevent private-browsing crashes
  const safeGetItem = (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  };

  const safeSetItem = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
  };

  const safeRemoveItem = (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  };

  // Load lockout state from localStorage when email changes
  useEffect(() => {
    if (!email) {
      setFailedAttempts(0);
      setTimeLeft(0);
      return;
    }
    const attemptsKey = `auth_attempts_signup_${email}`;
    const lockoutKey = `auth_lockout_signup_${email}`;

    const storedAttempts = parseInt(safeGetItem(attemptsKey) || "0", 10);
    const storedLockout = parseInt(safeGetItem(lockoutKey) || "0", 10);

    setFailedAttempts(storedAttempts);

    const now = Date.now();
    if (storedLockout > now) {
      setTimeLeft(Math.ceil((storedLockout - now) / 1000));
    } else {
      setTimeLeft(0);
    }
  }, [email]);

  // Handle countdown timer ticking
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setTimeout(() => {
      setTimeLeft(t => t - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [timeLeft]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    // Validation
    if (!displayName || !email || !password || !confirmPassword) {
      setLocalError("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setLocalError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setLocalError("Password must be at least 6 characters");
      return;
    }

    if (timeLeft > 0) {
      setLocalError(`Too many failed attempts. Try again in ${timeLeft}s`);
      return;
    }

    try {
      await signUp(email, password, displayName);
      
      // Reset attempts and lockout on success
      const attemptsKey = `auth_attempts_signup_${email}`;
      const lockoutKey = `auth_lockout_signup_${email}`;
      safeRemoveItem(attemptsKey);
      safeRemoveItem(lockoutKey);

      setDisplayName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setFailedAttempts(0);
      setTimeLeft(0);
      onSignUpSuccess();
    } catch (err: any) {
      console.error("Sign up error:", err);
      
      const errorCode = err.code || "";
      const isSignUpFailure = errorCode === "auth/email-already-in-use";
      const isRateLimit = errorCode === "auth/too-many-requests";

      const attemptsKey = `auth_attempts_signup_${email}`;
      const lockoutKey = `auth_lockout_signup_${email}`;

      if (isRateLimit) {
        const cooldown = 60;
        const lockoutTime = Date.now() + cooldown * 1000;
        safeSetItem(lockoutKey, lockoutTime.toString());
        setTimeLeft(cooldown);
        setLocalError("Too many failed attempts. Account creation locked for 60 seconds.");
      } else if (isSignUpFailure) {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        safeSetItem(attemptsKey, newAttempts.toString());

        if (newAttempts >= 5) {
          const cooldown = 60;
          const lockoutTime = Date.now() + cooldown * 1000;
          safeSetItem(lockoutKey, lockoutTime.toString());
          setTimeLeft(cooldown);
          setLocalError("Too many failed attempts. Account creation locked for 60 seconds.");
        } else {
          setLocalError(err.message || "Failed to create account. Please try again.");
        }
      } else {
        // Validation/network/other errors shouldn't increment failure attempts
        setLocalError(err.message || "Failed to create account. Please try again.");
      }
    }
  };

  const displayError = localError || error;

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Create Account</h1>
          <p>Join us and start tracking your workouts</p>
        </div>

        {displayError && (
          <div className="error-alert">
            <span>{displayError}</span>
            <button
              className="error-close"
              onClick={() => {
                setLocalError(null);
                clearError();
              }}
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="displayName">Full Name</label>
            <div className="input-wrapper">
              <User size={20} />
              <input
                id="displayName"
                type="text"
                placeholder="Enter your full name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-wrapper">
              <Mail size={20} />
              <input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <Lock size={20} />
              <input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className="input-wrapper">
              <Lock size={20} />
              <input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            className="auth-button primary"
            disabled={loading || timeLeft > 0}
          >
            {loading ? (
              <>
                <Loader size={18} className="spinner-icon" />
                Creating account...
              </>
            ) : timeLeft > 0 ? (
              `Locked (${timeLeft}s)`
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <div className="auth-footer">
          <div className="auth-link">
            Already have an account?{" "}
            <button
              type="button"
              className="link-button"
              onClick={onLoginClick}
            >
              Sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
