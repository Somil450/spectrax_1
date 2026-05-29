// src/HistoryPage.tsx
import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { History, Trash2, ArrowLeft, TrendingUp, Filter, Loader2, WifiOff, CheckCircle2, AlertCircle } from "lucide-react";
import { useWorkoutHistory, type WorkoutSession } from "./useWorkoutHistory";
import { EmptyState } from "./components/EmptyState";

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
import { useNetworkStatus } from "./hooks/useNetworkStatus";
import { getQueue } from "./utils/offlineQueue";
import { syncOfflineQueue } from "./services/syncQueue";
import { HistoryPageSkeleton } from "./components/HistoryPageSkeleton";
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

// ── Offline Queue Sync State ──────────────────────────────────────────────────

type OfflineSyncState = "idle" | "pending" | "syncing" | "synced" | "failed";

const HistoryPage: React.FC<HistoryPageProps> = ({ onBack }) => {
  const {
    sessions,
    loading,
    error,
    fetchHistory,
    removeSession,
    clearHistory,
  } = useWorkoutHistory();
  const { syncStatus, isOnline: workoutIsOnline, manualSync } = useWorkoutSync();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Offline replay queue state
  const [offlineSyncState, setOfflineSyncState] = useState<OfflineSyncState>("idle");
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [syncResultMessage, setSyncResultMessage] = useState<string>("");
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Trigger sync when coming back online
  const handleReconnect = useCallback(async () => {
    const queue = getQueue();
    if (queue.length === 0) return;

    setPendingCount(queue.length);
    setOfflineSyncState("syncing");
    setSyncResultMessage("");

    try {
      const result = await syncOfflineQueue();
      if (result.failed === 0) {
        setOfflineSyncState("synced");
        setSyncResultMessage("All sessions synced");
        // Auto-dismiss success after 4 seconds
        syncTimeoutRef.current = setTimeout(() => {
          setOfflineSyncState("idle");
          setSyncResultMessage("");
        }, 4000);
      } else {
        setOfflineSyncState("failed");
        setSyncResultMessage(
          `${result.synced} synced, ${result.failed} failed`,
        );
      }
      setPendingCount(getQueue().length);
    } catch (err) {
      setOfflineSyncState("failed");
      setSyncResultMessage("Sync failed — will retry on reconnect");
      console.error("[HistoryPage] Offline queue sync error:", err);
    }
  }, []);

  const { isOnline } = useNetworkStatus(handleReconnect);

  // Check pending queue on mount and when online status changes
  useEffect(() => {
    const queue = getQueue();
    setPendingCount(queue.length);
    if (queue.length > 0 && !isOnline) {
      setOfflineSyncState("pending");
    } else if (queue.length === 0 && offlineSyncState === "pending") {
      setOfflineSyncState("idle");
    }
  }, [isOnline, offlineSyncState]);

  // Auto-sync when isOnline transitions to true and there are pending items
  useEffect(() => {
    if (isOnline && offlineSyncState === "pending") {
      handleReconnect();
    }
  }, [isOnline, offlineSyncState, handleReconnect]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  // Manual retry for failed syncs
  const handleRetrySync = useCallback(async () => {
    if (!isOnline) return;
    setOfflineSyncState("syncing");
    setSyncResultMessage("");

    try {
      const result = await syncOfflineQueue();
      if (result.failed === 0) {
        setOfflineSyncState("synced");
        setSyncResultMessage("All sessions synced");
        syncTimeoutRef.current = setTimeout(() => {
          setOfflineSyncState("idle");
          setSyncResultMessage("");
        }, 4000);
      } else {
        setOfflineSyncState("failed");
        setSyncResultMessage(
          `${result.synced} synced, ${result.failed} failed`,
        );
      }
      setPendingCount(getQueue().length);
    } catch (err) {
      setOfflineSyncState("failed");
      setSyncResultMessage("Sync failed — please try again");
    }
  }, [isOnline]);

  // Filter state
  const [filterType, setFilterType] = useState<string>("All");
  const [filterCalories, setFilterCalories] = useState<string>("");
  const debouncedCalories = useDebounce(filterCalories, 150);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, syncStatus.lastSyncTime]);

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

      {/* ── Offline Replay Queue Banner ── */}
      {offlineSyncState !== "idle" && (
        <div
          className="offline-queue-banner"
          role="status"
          aria-live="polite"
          style={{
            padding: "10px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            fontSize: "0.82rem",
            fontFamily: "'Space Mono', monospace",
            borderBottom: "1px solid",
            ...(offlineSyncState === "pending" || (!isOnline && pendingCount > 0)
              ? {
                  background: "rgba(251, 191, 36, 0.08)",
                  borderColor: "rgba(251, 191, 36, 0.3)",
                  color: "#fbbf24",
                }
              : offlineSyncState === "syncing"
                ? {
                    background: "rgba(96, 165, 250, 0.08)",
                    borderColor: "rgba(96, 165, 250, 0.3)",
                    color: "#60a5fa",
                  }
                : offlineSyncState === "synced"
                  ? {
                      background: "rgba(34, 211, 160, 0.08)",
                      borderColor: "rgba(34, 211, 160, 0.3)",
                      color: "#22d3a0",
                    }
                  : {
                      background: "rgba(239, 68, 68, 0.08)",
                      borderColor: "rgba(239, 68, 68, 0.3)",
                      color: "#ef4444",
                    }),
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {(!isOnline || offlineSyncState === "pending") && (
              <>
                <WifiOff size={14} />
                <span>
                  You&apos;re offline — {pendingCount} session{pendingCount !== 1 ? "s" : ""} will sync when you reconnect
                </span>
              </>
            )}
            {offlineSyncState === "syncing" && (
              <>
                <Loader2 size={14} className="spin-icon" />
                <span>Syncing {pendingCount} session{pendingCount !== 1 ? "s" : ""}...</span>
              </>
            )}
            {offlineSyncState === "synced" && (
              <>
                <CheckCircle2 size={14} />
                <span>{syncResultMessage}</span>
              </>
            )}
            {offlineSyncState === "failed" && (
              <>
                <AlertCircle size={14} />
                <span>{syncResultMessage}</span>
              </>
            )}
          </div>
          {offlineSyncState === "failed" && isOnline && (
            <button
              onClick={handleRetrySync}
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                color: "#ef4444",
                padding: "4px 10px",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.78rem",
                fontWeight: 600,
                fontFamily: "'Space Mono', monospace",
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* ── Body ── */}
      <main className="history-body">
        {/* Loading */}
        {loading && <HistoryPageSkeleton />}

        {/* ── Filter Panel ── */}
        {!loading && !error && sessions.length > 0 && (
          <div className="filter-panel" style={{ marginBottom: "20px", display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center", background: "var(--glass-bg)", padding: "16px", borderRadius: "12px", border: "1px solid var(--glass-border)", backdropFilter: "blur(12px)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-secondary)" }}>
              <Filter size={16} />
              <span style={{ fontSize: "14px", fontWeight: 600, fontFamily: "'Space Mono', monospace" }}>Filters</span>
            </div>
            
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <label htmlFor="type-filter" style={{ fontSize: "12px", color: "var(--text-primary)" }}>Type:</label>
              <select
                id="type-filter"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                style={{
                  background: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--glass-border)",
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
              <label htmlFor="calorie-filter" style={{ fontSize: "12px", color: "var(--text-primary)" }}>Min Cals (est):</label>
              <input
                id="calorie-filter"
                type="number"
                min="0"
                placeholder="e.g. 50"
                value={filterCalories}
                onChange={(e) => setFilterCalories(e.target.value)}
                style={{
                  background: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--glass-border)",
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
          <EmptyState 
            title="No sessions yet"
            description="Complete a workout and your session will appear here."
            actionText="Start a Workout"
            onAction={onBack}
          />
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
          background: var(--bg-primary);
          color: var(--text-primary);
          font-family: 'Syne', sans-serif;
          position: relative;
          overflow-x: hidden;
        }

        /* subtle dot-grid background */
        .bg-grid {
          position: fixed;
          inset: 0;
          background-image: radial-gradient(circle, rgba(0,240,255,0.08) 1px, transparent 1px);
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
          padding-right: 220px;
          border-bottom: 1px solid var(--glass-border);
          backdrop-filter: blur(12px);
          background: var(--glass-bg);
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
          color: var(--text-primary);
        }
        .title-icon { color: var(--neon-cyan); }

        .back-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: 9px;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 7px 14px;
          font-size: 13px;
          font-family: 'Space Mono', monospace;
          transition: all 0.15s ease;
        }
        .back-btn:hover {
          color: var(--text-primary);
          background: rgba(0, 240, 255, 0.08);
        }

        .clear-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 9px;
          color: var(--neon-red);
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
          background: var(--glass-bg);
          border-bottom: 1px solid var(--glass-border);
          flex-wrap: wrap;
        }
        .summary-divider {
          width: 1px;
          height: 28px;
          background: var(--glass-border);
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
          color: var(--text-secondary);
        }
        .spinner {
          width: 36px;
          height: 36px;
          border: 3px solid rgba(0,240,255,0.2);
          border-top-color: var(--neon-cyan);
          border-radius: 50%;
          animation: spin 0.75s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .spin-icon {
          animation: spin 1s linear infinite;
        }

        .error-state { color: var(--neon-red); }
        .retry-btn {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.4);
          border-radius: 8px;
          color: var(--neon-red);
          cursor: pointer;
          padding: 8px 18px;
          font-family: 'Space Mono', monospace;
          font-size: 13px;
        }

        .empty-state { color: var(--text-secondary); }
        .empty-icon { font-size: 48px; line-height: 1; }
        .empty-state h2 {
          font-size: 22px;
          font-weight: 800;
          color: var(--text-primary);
        }
        .empty-state p { font-size: 14px; max-width: 280px; }
        .start-btn {
          margin-top: 8px;
          background: linear-gradient(135deg, var(--neon-cyan), var(--neon-green));
          border: none;
          border-radius: 10px;
          color: var(--bg-primary);
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
          .history-header { padding: 16px 16px; padding-right: 110px; }
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
        color: var(--text-secondary);
      }
      .sp-value {
        display: flex;
        align-items: center;
        gap: 4px;
        font-family: 'Space Mono', monospace;
        font-size: 18px;
        font-weight: 700;
        color: var(--neon-cyan);
      }
      .sp-icon { display: flex; align-items: center; }
    `}</style>
  </div>
);

export default HistoryPage;
