import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Mail, Lock, Loader } from "lucide-react";
import "../styles/auth.css";

interface LoginScreenProps {
  onLoginSuccess: () => void;
  onSignUpClick: () => void;
  onForgotPasswordClick: () => void;
}

export function LoginScreen({
  onLoginSuccess,
  onSignUpClick,
  onForgotPasswordClick,
}: LoginScreenProps) {
  const { signIn, signInWithGoogle, error, clearError, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    const attemptsKey = `auth_attempts_login_${email}`;
    const lockoutKey = `auth_lockout_login_${email}`;

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

    if (!email || !password) {
      setLocalError("Please fill in all fields");
      return;
    }

    if (timeLeft > 0) {
      setLocalError(`Too many failed attempts. Try again in ${timeLeft}s`);
      return;
    }

    try {
      await signIn(email, password);
      
      // Reset attempts and lockout on success
      const attemptsKey = `auth_attempts_login_${email}`;
      const lockoutKey = `auth_lockout_login_${email}`;
      safeRemoveItem(attemptsKey);
      safeRemoveItem(lockoutKey);

      setEmail("");
      setPassword("");
      setFailedAttempts(0);
      setTimeLeft(0);
      onLoginSuccess();
    } catch (err: any) {
      console.error("Login error:", err);
      
      const errorCode = err.code || "";
      const isAuthFailure =
        errorCode === "auth/wrong-password" ||
        errorCode === "auth/user-not-found" ||
        errorCode === "auth/invalid-credential";

      const isRateLimit = errorCode === "auth/too-many-requests";

      const attemptsKey = `auth_attempts_login_${email}`;
      const lockoutKey = `auth_lockout_login_${email}`;

      if (isRateLimit) {
        const cooldown = 60;
        const lockoutTime = Date.now() + cooldown * 1000;
        safeSetItem(lockoutKey, lockoutTime.toString());
        setTimeLeft(cooldown);
        setLocalError("Too many failed attempts. Account locked for 60 seconds.");
      } else if (isAuthFailure) {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        safeSetItem(attemptsKey, newAttempts.toString());

        if (newAttempts >= 5) {
          const cooldown = 60;
          const lockoutTime = Date.now() + cooldown * 1000;
          safeSetItem(lockoutKey, lockoutTime.toString());
          setTimeLeft(cooldown);
          setLocalError("Too many failed attempts. Account locked for 60 seconds.");
        } else {
          setLocalError("Invalid email or password");
        }
      } else {
        // Validation/network/other errors shouldn't increment failure attempts
        setLocalError("Unable to sign in. Please try again.");
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    try {
      await signInWithGoogle();
      onLoginSuccess();
    } catch (err) {
      console.error("Google sign-in error:", err);
    }
  };

  const displayError = localError || error;

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Welcome Back</h1>
          <p>Sign in to continue your fitness journey</p>
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
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                Signing in...
              </>
            ) : timeLeft > 0 ? (
              `Locked (${timeLeft}s)`
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="divider">or</div>

        <button
          className="auth-button google"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader size={18} className="spinner-icon" />
              Signing in...
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign in with Google
            </>
          )}
        </button>

        <div className="auth-footer">
          <button
            type="button"
            className="link-button"
            onClick={onForgotPasswordClick}
          >
            Forgot password?
          </button>
          <div className="auth-link">
            Don't have an account?{" "}
            <button
              type="button"
              className="link-button"
              onClick={onSignUpClick}
            >
              Sign up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
