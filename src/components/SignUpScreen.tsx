import React, { useState } from "react";
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

    try {
      await signUp(email, password, displayName);
      setDisplayName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      onSignUpSuccess();
    } catch (err) {
      console.error("Sign up error:", err);
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
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader size={18} className="spinner-icon" />
                Creating account...
              </>
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
