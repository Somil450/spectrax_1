import React from "react";
import { useAuth } from "../context/AuthContext";
import { LogOut, User as UserIcon, Mail, Calendar } from "lucide-react";
import { useSettings } from "../context/SettingsContext";
import "../styles/auth.css";

interface UserProfileScreenProps {
  onLogout: () => void;
}

export function UserProfileScreen({ onLogout }: UserProfileScreenProps) {
  const { user, userProfile, logout, loading } = useAuth();
  const { settings, updateSetting } = useSettings();

  const handleLogout = async () => {
    try {
      await logout();
      onLogout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="auth-container">
      <div className="auth-card profile-card">
        <div className="profile-header">
          <h1>My Profile</h1>
        </div>

        {userProfile && (
          <div className="profile-content">
            {userProfile.photoURL && (
              <img
                src={userProfile.photoURL}
                alt={userProfile.displayName || "User avatar"}
                className="profile-avatar"
              />
            )}

            <div className="profile-info">
              <div className="info-item">
                <div className="info-icon">
                  <UserIcon size={20} />
                </div>
                <div className="info-text">
                  <label>Name</label>
                  <p>{userProfile.displayName || "Not set"}</p>
                </div>
              </div>

              <div className="info-item">
                <div className="info-icon">
                  <Mail size={20} />
                </div>
                <div className="info-text">
                  <label>Email</label>
                  <p>{userProfile.email}</p>
                </div>
              </div>

              <div className="info-item">
                <div className="info-icon">
                  <Calendar size={20} />
                </div>
                <div className="info-text">
                  <label>Member Since</label>
                  <p>{formatDate(userProfile.createdAt)}</p>
                </div>
              </div>

              <div className="info-item">
                <div className="info-icon">
                  <Calendar size={20} />
                </div>
                <div className="info-text">
                  <label>Last Login</label>
                  <p>{formatDate(userProfile.lastLogin)}</p>
                </div>
              </div>
            </div>

            <div className="profile-settings-section" style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "20px", marginTop: "20px" }}>
              <h3 style={{ fontSize: "1rem", color: "var(--neon-cyan)", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "15px", fontFamily: "var(--font-heading)" }}>Preferences</h3>
              <div className="info-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div className="info-icon">
                    <span>🔊</span>
                  </div>
                  <div className="info-text">
                    <label style={{ cursor: "pointer" }} htmlFor="voice-coaching-checkbox">Voice Coaching</label>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", margin: 0 }}>Enable trainer audio alerts and rep counts</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <input
                     id="voice-coaching-checkbox"
                     type="checkbox"
                     checked={settings.voiceFeedback}
                     onChange={(e) => updateSetting("voiceFeedback", e.target.checked)}
                     style={{
                       width: "20px",
                       height: "20px",
                       cursor: "pointer",
                       accentColor: "var(--neon-cyan)",
                     }}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="auth-button logout"
              disabled={loading}
            >
              <LogOut size={18} />
              {loading ? "Signing out..." : "Sign Out"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
