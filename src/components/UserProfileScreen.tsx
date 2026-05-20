import React from "react";
import { useAuth } from "../context/AuthContext";
import { LogOut, User as UserIcon, Mail, Calendar } from "lucide-react";
import "../styles/auth.css";

interface UserProfileScreenProps {
  onLogout: () => void;
}

export function UserProfileScreen({ onLogout }: UserProfileScreenProps) {
  const { user, userProfile, logout, loading } = useAuth();

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
