import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Mail, Loader, ArrowLeft } from "lucide-react";
import "../styles/auth.css";

interface ForgotPasswordScreenProps {
  onBack: () => void;
}

export function ForgotPasswordScreen({ onBack }: ForgotPasswordScreenProps) {
  const { resetPassword, error, clearError, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
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
    } catch (e) {

      return;

      // Ignored: Fallback if localStorage is disabled or not accessible

    }
  };

  const safeRemoveItem = (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {

      return;

      // Ignored: Fallback if localStorage is disabled or not accessible

    }
  };

  // Load lockout state from localStorage when email changes
  useEffect(() => {
    if (!email) {
      setFailedAttempts(0);
      setTimeLeft(0);
      return;
    }
    const attemptsKey = `auth_attempts_forgot_${email}`;
    const lockoutKey = `auth_lockout_forgot_${email}`;

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
      setTimeLeft((t) => t - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [timeLeft]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email) {
      setLocalError("Please enter your email");
      return;
    }

    if (timeLeft > 0) {
      setLocalError(`Too many requests. Try again in ${timeLeft}s`);
      return;
    }

    const attemptsKey = `auth_attempts_forgot_${email}`;
    const lockoutKey = `auth_lockout_forgot_${email}`;

    try {
      await resetPassword(email);

      // Increment attempt even on success to prevent email spam/abuse (maximum 5 requests)
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      safeSetItem(attemptsKey, newAttempts.toString());

      if (newAttempts >= 5) {
        const cooldown = 60;
        const lockoutTime = Date.now() + cooldown * 1000;
        safeSetItem(lockoutKey, lockoutTime.toString());
        setTimeLeft(cooldown);
        setLocalError(
          "Too many password reset requests. Try again in 60 seconds.",
        );
      }

      setSuccess(true);
    } catch (err: any) {
      console.error("Reset password error:", err);

      const errorCode = err.code || "";
      const isRateLimit = errorCode === "auth/too-many-requests";

      if (isRateLimit) {
        const cooldown = 60;
        const lockoutTime = Date.now() + cooldown * 1000;
        safeSetItem(lockoutKey, lockoutTime.toString());
        setTimeLeft(cooldown);
        setLocalError(
          "Too many requests. Password reset locked for 60 seconds.",
        );
      } else {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        safeSetItem(attemptsKey, newAttempts.toString());

        if (newAttempts >= 5) {
          const cooldown = 60;
          const lockoutTime = Date.now() + cooldown * 1000;
          safeSetItem(lockoutKey, lockoutTime.toString());
          setTimeLeft(cooldown);

          setLocalError(
            "Too many requests. Password reset locked for 60 seconds.",
          );
        } else if (errorCode === "auth/network-request-failed") {
          setLocalError("Network error. Check your connection.");
        } else {
          setLocalError(
            err.message || "Failed to send reset link. Please try again.",
          );
        }
      }
    }
  };

  const displayError = localError || error;

  return (
    <div className="auth-container">
      <div className="auth-card">
        <button className="back-button" onClick={onBack}>
          <ArrowLeft size={20} />
          Back
        </button>

        <div className="auth-header">
          <h1>Reset Password</h1>
          <p>
            Enter your email address and we'll send you a link to reset your
            password
          </p>
        </div>

        {success ? (
          <div className="success-alert">
            <div className="success-icon">✓</div>
            <h3>Check your email</h3>
            <p>
              If an account exists for <strong>{email}</strong>, a password
              reset link has been sent. Please check your email to continue.
            </p>
            <button
              type="button"
              className="auth-button primary"
              onClick={() => {
                setSuccess(false);
                onBack();
              }}
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <>
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
                    disabled={loading || timeLeft > 0}
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
                    Sending...
                  </>
                ) : timeLeft > 0 ? (
                  `Locked (${timeLeft}s)`
                ) : (
                  "Send Reset Link"
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
