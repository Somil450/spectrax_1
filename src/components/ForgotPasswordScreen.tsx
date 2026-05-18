import React, { useState } from "react";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email) {
      setLocalError("Please enter your email");
      return;
    }

    try {
      await resetPassword(email);
      setSuccess(true);
      setEmail("");
    } catch (err) {
      console.error("Reset password error:", err);
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
              We've sent a password reset link to <strong>{email}</strong>.
              Please check your email to continue.
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
                    disabled={loading}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="auth-button primary"
                disabled={loading}
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
