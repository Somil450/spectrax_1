import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAuthRateLimit } from "../hooks/useAuthRateLimit";
import { Mail, Loader, ArrowLeft } from "lucide-react";
import "../styles/auth.css";

interface ForgotPasswordScreenProps {
  onBack?: () => void;
}

export function ForgotPasswordScreen({ onBack }: ForgotPasswordScreenProps) {
  const navigate = useNavigate();
  const { resetPassword, error, clearError, loading } = useAuth();
  const {
    isLocked,
    secondsLeft,
    recordFailure,
    recordSuccess,
    isRateLimitError,
  } = useAuthRateLimit('forgot-password');
  const [email, setEmail] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (error && isRateLimitError(error)) {
      recordFailure();
    }
  }, [error, isRateLimitError, recordFailure]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (isLocked) return;

    if (!email) {
      setLocalError("Please enter your email");
      return;
    }

    try {
      await resetPassword(email);
      recordSuccess();
      setSuccess(true);
      setEmail("");
    } catch {
      recordFailure();
    }
  };

  const displayError = localError || error;

  return (
    <div className="auth-container">
      <div className="auth-card">
        <button className="back-button" onClick={() => { onBack?.(); navigate('/login'); }}>
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
              We've sent a password reset link to <strong>{email}</strong>.
              Please check your email to continue.
            </p>
            <button
              type="button"
              className="auth-button primary"
              onClick={() => {
                setSuccess(false);
                onBack?.();
                navigate('/login');
              }}
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <>
            {isLocked && (
              <div className="error-alert rate-limit-alert">
                <span>Too many attempts. Try again in {secondsLeft}s</span>
              </div>
            )}

            {displayError && !isLocked && (
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
                    disabled={loading || isLocked}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="auth-button primary"
                disabled={loading || isLocked}
              >
                {loading ? (
                  <>
                    <Loader size={18} className="spinner-icon" />
                    Sending...
                  </>
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
