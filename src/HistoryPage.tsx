// src/HistoryPage.tsx
import React, { useEffect, useState, useMemo } from "react";
import { History, Trash2, ArrowLeft, TrendingUp, Filter } from "lucide-react";
import { useWorkoutHistory, type WorkoutSession } from "./useWorkoutHistory";

// ── Debounce Hook ─────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}
import { useWorkoutSync } from "./hooks/useWorkoutSync";
import SessionCard from "./SessionCard";

// ── Helpers ──────────────────────────────────────────────────────────────────

function avgAccuracy(sessions: { accuracyScore: number }[]): number {
  if (!sessions.length) return 0;
  return Math.round(
    sessions.reduce((sum, s) => sum + s.accuracyScore, 0) / sessions.length,
  );
}

function totalReps(sessions: { totalReps: number }[]): number {
  return sessions.reduce((sum, s) => sum + s.totalReps, 0);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface HistoryPageProps {
  onBack: () => void;
}

const HistoryPage: React.FC<HistoryPageProps> = ({ onBack }) => {
  const {
    sessions,
    loading,
    error,
    fetchHistory,
    removeSession,
    clearHistory,
  } = useWorkoutHistory();
  const { syncStatus, isOnline, manualSync } = useWorkoutSync();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Filter state
  const [filterType, setFilterType] = useState<string>("All");
  const [filterCalories, setFilterCalories] = useState<string>("");
  const debouncedCalories = useDebounce(filterCalories, 150);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const availableTypes = useMemo(() => {
    const types = new Set(sessions.map((s) => s.exerciseType));
    return ["All", ...Array.from(types)];
  }, [sessions]);

  useEffect(() => {
    if (!availableTypes.includes(filterType)) {
      setFilterType("All");
    }
  }, [availableTypes, filterType]);

  const filteredSessions = useMemo(() => {
    const calGoal = parseInt(debouncedCalories || "0", 10);
    return sessions.filter((s) => {
      // Calorie estimation: 1.5 calories per rep
      const estimatedCals = s.totalReps * 1.5;
      const matchType = filterType === "All" || s.exerciseType === filterType;
      const matchCals = estimatedCals >= calGoal;
      return matchType && matchCals;
    });
  }, [sessions, filterType, debouncedCalories]);

  const handleClear = () => {
    if (showClearConfirm) {
      clearHistory();
      setShowClearConfirm(false);
    } else {
      setShowClearConfirm(true);
      setTimeout(() => setShowClearConfirm(false), 3000);
    }
  };

  return (
    <div className="history-root">
      {/* Google Font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap"
        rel="stylesheet"
      />

      {/* Background grid */}
      <div className="bg-grid" aria-hidden="true" />

      {/* ── Header ── */}
      <header className="history-header">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="header-title">
          <History size={20} className="title-icon" />
          <h1>Workout History</h1>
        </div>

        {sessions.length > 0 && (
          <button
            className={`clear-btn ${showClearConfirm ? "confirm" : ""}`}
            onClick={handleClear}
          >
            <Trash2 size={14} />
            {showClearConfirm ? "Sure?" : "Clear All"}
          </button>
        )}
      </header>

      {/* ── Summary bar (only when data exists) ── */}
      {sessions.length > 0 && (
        <div className="summary-bar">
          <SummaryPill label="Sessions" value={filteredSessions.length} />
          <div className="summary-divider" />
          <SummaryPill label="Total Reps" value={totalReps(filteredSessions)} />
          <div className="summary-divider" />
          <SummaryPill
            label="Avg Accuracy"
            value={`${avgAccuracy(filteredSessions)}%`}
            icon={<TrendingUp size={12} />}
          />
        </div>
      )}

      {/* ── Sync Status Indicator ── */}
      <div
        style={{
          padding: "12px 28px",
          background: isOnline
            ? "rgba(34, 211, 160, 0.05)"
            : "rgba(239, 68, 68, 0.05)",
          borderBottom: `1px solid ${isOnline ? "rgba(34, 211, 160, 0.2)" : "rgba(239, 68, 68, 0.2)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
          fontSize: "0.85rem",
          fontFamily: "'Space Mono', monospace",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flex: "1 1 auto",
          }}
        >
          <span style={{ fontSize: "1.2em" }}>
            {!isOnline
              ? "⚠️ Offline"
              : syncStatus.isSyncing
                ? "🔄 Syncing"
                : "✅ Online"}
          </span>
          <span
            style={{ color: isOnline ? "#22d3a0" : "#ef4444", fontWeight: 600 }}
          >
            {!isOnline
              ? "Offline Mode"
              : syncStatus.isSyncing
                ? "Syncing..."
                : "All synced"}
          </span>
          {syncStatus.pendingUploads > 0 && (
            <span style={{ color: "#fbbf24", marginLeft: "8px" }}>
              ({syncStatus.pendingUploads} pending)
            </span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "center",
            flex: "0 1 auto",
          }}
        >
          {isOnline && !syncStatus.isSyncing && (
            <button
              onClick={manualSync}
              style={{
                background: "rgba(34, 211, 160, 0.2)",
                border: "1px solid rgba(34, 211, 160, 0.4)",
                color: "#22d3a0",
                padding: "4px 10px",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: 600,
                fontFamily: "'Space Mono', monospace",
              }}
            >
              Sync Now
            </button>
          )}
          {syncStatus.lastSyncTime && (
            <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
              Last: {new Date(syncStatus.lastSyncTime).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <main className="history-body">
        {/* ── Filter Panel ── */}
        {!loading && !error && sessions.length > 0 && (
          <div className="filter-panel" style={{ marginBottom: "20px", display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center", background: "rgba(255,255,255,0.03)", padding: "16px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#94a3b8" }}>
              <Filter size={16} />
              <span style={{ fontSize: "14px", fontWeight: 600, fontFamily: "'Space Mono', monospace" }}>Filters</span>
            </div>
            
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <label htmlFor="type-filter" style={{ fontSize: "12px", color: "#e2e8f0" }}>Type:</label>
              <select
                id="type-filter"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                style={{
                  background: "rgba(8,12,20,0.8)",
                  color: "#e2e8f0",
                  border: "1px solid rgba(255,255,255,0.2)",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontFamily: "'Space Mono', monospace",
                  outline: "none",
                  cursor: "pointer"
                }}
              >
                {availableTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <label htmlFor="calorie-filter" style={{ fontSize: "12px", color: "#e2e8f0" }}>Min Cals (est):</label>
              <input
                id="calorie-filter"
                type="number"
                min="0"
                placeholder="e.g. 50"
                value={filterCalories}
                onChange={(e) => setFilterCalories(e.target.value)}
                style={{
                  background: "rgba(8,12,20,0.8)",
                  color: "#e2e8f0",
                  border: "1px solid rgba(255,255,255,0.2)",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontFamily: "'Space Mono', monospace",
                  outline: "none",
                  width: "100px"
                }}
              />
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="state-center">
            <div className="spinner" />
            <p>Loading history…</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="state-center error-state">
            <p>{error}</p>
            <button className="retry-btn" onClick={fetchHistory}>
              Retry
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && sessions.length === 0 && (
          <div className="state-center empty-state">
            <div className="empty-icon">🏋️</div>
            <h2>No sessions yet</h2>
            <p>Complete a workout and your session will appear here.</p>
            <button className="start-btn" onClick={onBack}>
              Start a Workout
            </button>
          </div>
        )}

        {/* Sessions empty after filter */}
        {!loading && !error && sessions.length > 0 && filteredSessions.length === 0 && (
          <div className="state-center empty-state" style={{ minHeight: "150px" }}>
            <p>No sessions match your filters.</p>
          </div>
        )}

        {/* Session grid */}
        {!loading && !error && filteredSessions.length > 0 && (
          <div className="sessions-grid">
            {filteredSessions.map((session: WorkoutSession) => (
              <SessionCard
                key={session.id}
                session={session}
                onDelete={removeSession}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Styles ── */}
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .history-root {
          min-height: 100vh;
          background: #080c14;
          color: #e2e8f0;
          font-family: 'Syne', sans-serif;
          position: relative;
          overflow-x: hidden;
        }

        /* subtle dot-grid background */
        .bg-grid {
          position: fixed;
          inset: 0;
          background-image: radial-gradient(circle, rgba(255,255,255,0.035) 1px, transparent 1px);
          background-size: 28px 28px;
          pointer-events: none;
          z-index: 0;
        }

        /* ── Header ── */
        .history-header {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 28px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          backdrop-filter: blur(12px);
          background: rgba(8,12,20,0.7);
          gap: 12px;
          flex-wrap: wrap;
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .header-title h1 {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #f1f5f9;
        }
        .title-icon { color: #22d3a0; }

        .back-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 9px;
          color: #94a3b8;
          cursor: pointer;
          padding: 7px 14px;
          font-size: 13px;
          font-family: 'Space Mono', monospace;
          transition: all 0.15s ease;
        }
        .back-btn:hover {
          color: #e2e8f0;
          background: rgba(255,255,255,0.09);
        }

        .clear-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 9px;
          color: #ef4444;
          cursor: pointer;
          padding: 7px 14px;
          font-size: 13px;
          font-family: 'Space Mono', monospace;
          transition: all 0.15s ease;
        }
        .clear-btn:hover { background: rgba(239,68,68,0.15); }
        .clear-btn.confirm {
          background: rgba(239,68,68,0.22);
          border-color: rgba(239,68,68,0.7);
          animation: pulse-border 0.8s ease infinite alternate;
        }
        @keyframes pulse-border {
          to { border-color: #ef4444; box-shadow: 0 0 8px rgba(239,68,68,0.4); }
        }

        /* ── Summary bar ── */
        .summary-bar {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 0;
          padding: 14px 28px;
          background: rgba(34,211,160,0.05);
          border-bottom: 1px solid rgba(34,211,160,0.12);
          flex-wrap: wrap;
        }
        .summary-divider {
          width: 1px;
          height: 28px;
          background: rgba(255,255,255,0.1);
          margin: 0 20px;
        }

        /* ── Body ── */
        .history-body {
          position: relative;
          z-index: 1;
          padding: 28px;
          max-width: 900px;
          margin: 0 auto;
        }

        /* States */
        .state-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          min-height: 320px;
          text-align: center;
          color: #64748b;
        }
        .spinner {
          width: 36px;
          height: 36px;
          border: 3px solid rgba(34,211,160,0.2);
          border-top-color: #22d3a0;
          border-radius: 50%;
          animation: spin 0.75s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .error-state { color: #ef4444; }
        .retry-btn {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.4);
          border-radius: 8px;
          color: #ef4444;
          cursor: pointer;
          padding: 8px 18px;
          font-family: 'Space Mono', monospace;
          font-size: 13px;
        }

        .empty-state { color: #475569; }
        .empty-icon { font-size: 48px; line-height: 1; }
        .empty-state h2 {
          font-size: 22px;
          font-weight: 800;
          color: #64748b;
        }
        .empty-state p { font-size: 14px; max-width: 280px; }
        .start-btn {
          margin-top: 8px;
          background: linear-gradient(135deg, #22d3a0, #06b6d4);
          border: none;
          border-radius: 10px;
          color: #080c14;
          cursor: pointer;
          padding: 10px 22px;
          font-family: 'Syne', sans-serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.02em;
          transition: opacity 0.15s ease;
        }
        .start-btn:hover { opacity: 0.88; }

        /* Sessions grid */
        .sessions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }

        @media (max-width: 500px) {
          .history-header { padding: 16px 16px; }
          .history-body { padding: 16px; }
          .summary-bar { padding: 12px 16px; }
        }
      `}</style>
    </div>
  );
};

// ── Summary pill ──────────────────────────────────────────────────────────────

interface SummaryPillProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}

const SummaryPill: React.FC<SummaryPillProps> = ({ label, value, icon }) => (
  <div className="summary-pill">
    <span className="sp-label">{label}</span>
    <span className="sp-value">
      {icon && <span className="sp-icon">{icon}</span>}
      {value}
    </span>
    <style>{`
      .summary-pill { display: flex; flex-direction: column; gap: 2px; }
      .sp-label {
        font-family: 'Space Mono', monospace;
        font-size: 10px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #475569;
      }
      .sp-value {
        display: flex;
        align-items: center;
        gap: 4px;
        font-family: 'Space Mono', monospace;
        font-size: 18px;
        font-weight: 700;
        color: #22d3a0;
      }
      .sp-icon { display: flex; align-items: center; }
    `}</style>
  </div>
);

export default HistoryPage;
