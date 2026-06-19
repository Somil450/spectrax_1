// src/SessionCard.tsx
import React, { useState } from "react";
import { Trash2, Clock, Zap, Target, Calendar } from "lucide-react";
import type { WorkoutSession } from "./useWorkoutHistory";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function accuracyColor(score: number): string {
  if (score >= 80) return "var(--neon-cyan)";
  if (score >= 50) return "var(--neon-yellow)";
  return "var(--neon-red)";
}

// ── Component ─────────────────────────────────────────────────────────────────

interface SessionCardProps {
  session: WorkoutSession;
  onDelete: (id: string | number) => void;
}

const SessionCard: React.FC<SessionCardProps> = ({ session, onDelete }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDeleteClick = () => {
    if (confirmDelete) {
      onDelete(session.id!);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  const formatExerciseName = (name: string) => {
    return name
      .replace(/_/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const color = accuracyColor(session.accuracyScore);

  return (
    <div className="session-card">
      {/* Left accent bar colored by accuracy */}
      <div className="card-accent" style={{ background: color }} />

      <div className="card-body">
        {/* Header row */}
        <div className="card-header">
          <span className="exercise-badge">{formatExerciseName(session.exerciseType)}</span>

          <button
            className={`delete-btn ${confirmDelete ? "confirm" : ""} has-tooltip tooltip-left`}
            onClick={handleDeleteClick}
            data-tooltip={confirmDelete ? "Confirm delete" : "Delete session"}
            aria-label="Delete session"
          >
            <Trash2 size={15} />
            {confirmDelete && <span className="confirm-label">Confirm?</span>}
          </button>
        </div>

        {/* Stats grid */}
        <div className="stats-grid">
          <Stat icon={<Zap size={14} />} label="Reps" value={session.totalReps} />
          <Stat
            icon={<Target size={14} />}
            label="Accuracy"
            value={`${session.accuracyScore}%`}
            valueStyle={{ color }}
          />
          <Stat
            icon={<Clock size={14} />}
            label="Duration"
            value={formatDuration(session.duration)}
          />
        </div>

        {/* Timestamp */}
        <div className="card-footer">
          <Calendar size={12} />
          <span>
            {formatDate(session.timestamp)} · {formatTime(session.timestamp)}
          </span>
        </div>
      </div>

      <style>{`
        .session-card {
          display: flex;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: 14px;
          overflow: visible;
          transition: transform 0.18s ease, box-shadow 0.18s ease;
          backdrop-filter: blur(12px);
        }
        .session-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--glass-shadow);
        }
        .card-accent {
          width: 4px;
          flex-shrink: 0;
          border-radius: 14px 0 0 14px;
        }
        .card-body {
          flex: 1;
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .exercise-badge {
          font-family: 'Space Mono', monospace;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-primary);
          background: rgba(0, 240, 255, 0.08);
          padding: 3px 10px;
          border-radius: 6px;
        }
        .delete-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 7px;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 4px 8px;
          font-size: 12px;
          transition: all 0.15s ease;
        }
        .delete-btn:hover {
          color: #ef4444;
          border-color: rgba(239,68,68,0.3);
          background: rgba(239,68,68,0.08);
        }
        .delete-btn.confirm {
          color: var(--neon-red);
          border-color: rgba(239,68,68,0.5);
          background: rgba(239,68,68,0.12);
          animation: pulse-border 0.8s ease infinite alternate;
        }
        @keyframes pulse-border {
          to { border-color: rgba(239,68,68,0.9); }
        }
        .confirm-label { font-size: 11px; font-weight: 600; }
        .stats-grid {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
        }
        .card-footer {
          display: flex;
          align-items: center;
          gap: 5px;
          color: var(--text-secondary);
          font-size: 11px;
          font-family: 'Space Mono', monospace;
        }
      `}</style>
    </div>
  );
};

// ── Small sub-component ───────────────────────────────────────────────────────

interface StatProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  valueStyle?: React.CSSProperties;
}

const Stat: React.FC<StatProps> = ({ icon, label, value, valueStyle }) => (
  <div className="stat-item">
    <span className="stat-icon">{icon}</span>
    <div>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={valueStyle}>
        {value}
      </div>
    </div>
    <style>{`
      .stat-item {
        display: flex;
        align-items: center;
        gap: 7px;
      }
      .stat-icon {
        color: var(--text-secondary);
        display: flex;
        align-items: center;
      }
      .stat-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--text-secondary);
        font-family: 'Space Mono', monospace;
      }
      .stat-value {
        font-size: 16px;
        font-weight: 700;
        color: var(--text-primary);
        line-height: 1.1;
        font-family: 'Space Mono', monospace;
      }
    `}</style>
  </div>
);

export default SessionCard;