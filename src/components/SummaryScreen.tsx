import React, { useEffect, useMemo, useState } from 'react';
import { Award, Clock, RotateCcw, Video, Activity } from 'lucide-react';
import { updateWorkoutStreak } from "../utils/streakUtils";
import { useAuth } from '../context/AuthContext';
import { getLocalWorkouts, WorkoutRecord } from '../services/workoutSyncService';
import "./SummaryScreen.css";

interface SummaryScreenProps {
  stats: {
    reps: number;
    totalReps: number;
    correctReps: number;
    repScores: number[];
    repDeviations?: number[];
    duration: number;
    accuracy: number;
    mistakes: Record<string, number>;
    bestStreak: number;
    tags?: string[];
    gainedXp?: number;
    exerciseName?: string;
    calories?: number;
    jumpingJackSync?: {
      score: number | null;
      lagMs: number | null;
      confidence: number;
      samples: number;
    };
  };
  leveling?: {
    xp: number;
    level: number;
    progress: number;
    nextLevelXp: number;
  };
  onRestart: () => void;
  onViewReplay: () => void;
}

export const SummaryScreen: React.FC<SummaryScreenProps> = ({ stats, leveling, onRestart, onViewReplay }) => {
  const [accuracy, setAccuracy] = useState(0);
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([]);

  useEffect(() => {
    if (!user?.uid) return;
    let active = true;
    getLocalWorkouts(user.uid)
      .then((records) => {
        if (active) setWorkouts(records);
      })
      .catch((error) => {
        console.error("Failed to load weekly activity:", error);
      });
    return () => {
      active = false;
    };
  }, [user?.uid]);

  const weeklyData = useMemo(() => {
    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayMs = 24 * 60 * 60 * 1000;

    return Array.from({ length: 7 }, (_, i) => {
      const dayStart = today.getTime() - (6 - i) * dayMs;
      const dayWorkouts = workouts.filter(
        (w) => w.timestamp >= dayStart && w.timestamp < dayStart + dayMs,
      );
      const score = dayWorkouts.length
        ? Math.round(
          dayWorkouts.reduce((sum, w) => sum + (w.accuracyScore || 0), 0) /
          dayWorkouts.length,
        )
        : 0;
      return { day: dayLabels[new Date(dayStart).getDay()], score };
    });
  }, [workouts]);

  const hasWeeklyActivity = weeklyData.some((d) => d.score > 0);

  useEffect(() => {
    // Animate accuracy ring on mount
    const timer = setTimeout(() => setAccuracy(stats.accuracy), 300);
    return () => clearTimeout(timer);
  }, [stats.accuracy]);

  const offset = 440 - (440 * accuracy) / 100;

  let accuracyColor = "var(--neon-red)";
  if (stats.accuracy > 80) accuracyColor = "var(--neon-green)";
  else if (stats.accuracy > 60) accuracyColor = "var(--neon-yellow)";

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const secs = (s % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const getWorstMistake = () => {
    const entries = Object.entries(stats.mistakes);
    if (entries.length === 0) return "None — Perfect Form! ✨";
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  };

  const getPerformanceHighlight = () => {
    if (stats.accuracy > 90) return "Elite Precision 🏆";
    if (stats.accuracy > 75) return "Solid Technique 💪";
    return "Needs Calibration ⚙️";
  };

  const exportSessionData = () => {
    try {
      const jsonData = JSON.stringify(stats, null, 2);
      const blob = new Blob([jsonData], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-");
      link.href = url;
      link.download = `workout-session-${timestamp}.json`;
      link.click();
      URL.revokeObjectURL(url); 
    } catch (error) {
      console.error("Failed to export session data:", error);
      alert("Unable to export session data. Please try again.");
    }

  };

  // Rep Quality Insights
  const bestRepScore =
    stats.repScores.length > 0 ? Math.max(...stats.repScores) : 0;
  const worstRepScore =
    stats.repScores.length > 0 ? Math.min(...stats.repScores) : 0;
  const averageRepScore =
    stats.repScores.length > 0
      ? Math.round(
        stats.repScores.reduce((a, b) => a + b, 0) / stats.repScores.length,
      )
      : 0;
  const streakData = updateWorkoutStreak();

  if (stats.totalReps === 0) {
    return (
      <div className="screen-container summary-screen summary-screen--empty">
        <div className="animate-in summary-header">
          <h2 className="summary-title">
            SESSION COMPLETE
          </h2>
          <p className="summary-empty-subtitle">
            No reps detected
          </p>
        </div>
        <div className="animate-in summary-empty-actions">
          <button
            onClick={onRestart}
            className="btn-neon"
            style={{ background: "var(--neon-purple)", color: "#fff" }}
          >
            <RotateCcw size={16} /> RESTART SESSION
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-container summary-screen">
      <div className="animate-in summary-header">
        <h2 className="summary-title">
          PERFORMANCE SUMMARY
        </h2>
        <p className="summary-subtitle">
          Session complete. AI analysis synchronized.
        </p>
      </div>

      {/* Accuracy Ring */}
      <div
        className="glass animate-in accuracy-ring"
        style={{
          border: `1px solid ${accuracyColor}`,
          boxShadow: `0 0 30px ${accuracyColor}`,
        }}
      >
        <svg
          className="accuracy-ring__svg"
          width="180"
          height="180"
          viewBox="0 0 160 160"
        >
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke="var(--summary-track)"
            strokeWidth="10"
          />
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke={accuracyColor}
            strokeWidth="10"
            strokeDasharray="440"
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="accuracy-ring__progress"
          />
        </svg>
        <div className="accuracy-ring__overlay">
          <div className="accuracy-value">
            {accuracy}
            <span className="accuracy-pct">%</span>
          </div>
          <div className="accuracy-label">
            Overall Accuracy
          </div>
        </div>
      </div>

      {/* Core Metrics */}
      <div className="animate-in metrics-grid">
        <div className="glass metric-card metric-card--green">
          <Award
            size={18}
            color="var(--neon-green)"
            className="metric-icon"
          />
          <div className="metric-value">
            {stats.reps}
          </div>
          <div className="metric-label">
            Correct Reps
          </div>
        </div>
        <div className="glass metric-card metric-card--cyan">
          <Activity
            size={18}
            color="var(--neon-cyan)"
            className="metric-icon"
          />
          <div className="metric-value">
            {stats.totalReps}
          </div>
          <div className="metric-label">
            Total Rated
          </div>
        </div>
        <div className="glass metric-card metric-card--purple">
          <Clock
            size={18}
            color="var(--neon-purple)"
            className="metric-icon"
          />
          <div className="metric-value">
            {formatTime(stats.duration)}
          </div>
          <div className="metric-label">
            Duration
          </div>
        </div>
      </div>

      {/* Rep Quality Insights */}
      <div className="glass animate-in rep-quality-card">
        <div className="rep-quality-stat">
          <div className="rep-quality-label">
            Peak Form Target
          </div>
          <div className="rep-quality-value rep-quality-value--cyan">
            {bestRepScore}%
          </div>
        </div>
        <div className="insights-divider"></div>
        <div className="rep-quality-stat">
          <div className="rep-quality-label">
            Consistency Average
          </div>
          <div className="rep-quality-value">
            {averageRepScore}%
          </div>
        </div>
        <div className="insights-divider"></div>
        <div className="rep-quality-stat">
          <div className="rep-quality-label">
            Lowest Drop-Off
          </div>
          <div className="rep-quality-value rep-quality-value--red">
            {worstRepScore}%
          </div>
        </div>
      </div>

      {/* Form Fatigue Insights */}
      {stats.repDeviations && stats.repDeviations.length > 0 && (
        <div className="glass animate-in fatigue-card">
          <div className="section-title section-title--yellow">
            FORM FATIGUE (POSTURE DEVIATION)
          </div>
          <div className="fatigue-chart">
            {stats.repDeviations.map((dev, index) => {
              // Normalise deviation to a max of 30 for visualization
              const maxDev = 30;
              const heightPct = Math.min(100, Math.max(5, (dev / maxDev) * 100));
              // Color logic: low deviation is green, high is red
              const color = dev < 10 ? 'var(--neon-green)' : dev < 20 ? 'var(--neon-yellow)' : 'var(--neon-red)';
              return (
                <div key={index} className="fatigue-col">
                  <span className="fatigue-bar-value">{Math.round(dev)}</span>
                  <div className="fatigue-bar" style={{
                    height: `${heightPct}%`,
                    background: color,
                    boxShadow: `0 0 8px ${color}`,
                  }}></div>
                  <span className="fatigue-rep-label">R{index + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {stats.jumpingJackSync?.score !== null && stats.jumpingJackSync?.score !== undefined && (
        <div className="glass animate-in jj-card">
          <div className="section-title section-title--cyan">
            JUMPING JACK COORDINATION
          </div>
          <div className="jj-grid">
            <div>
              <div className="jj-value">{stats.jumpingJackSync.score}%</div>
              <div className="jj-label">Sync Score</div>
            </div>
            <div>
              <div className="jj-value" style={{ color: stats.jumpingJackSync.lagMs && stats.jumpingJackSync.lagMs > 0 ? 'var(--neon-yellow)' : 'var(--neon-green)' }}>
                {stats.jumpingJackSync.lagMs ? `${Math.abs(stats.jumpingJackSync.lagMs)}ms` : '0ms'}
              </div>
              <div className="jj-label">
                {stats.jumpingJackSync.lagMs && stats.jumpingJackSync.lagMs < 0 ? 'Arms Lead' : 'Arm Lag'}
              </div>
            </div>
            <div>
              <div className="jj-value">{Math.round(stats.jumpingJackSync.confidence * 100)}%</div>
              <div className="jj-label">Confidence</div>
            </div>
          </div>
        </div>
      )}

      {stats.gainedXp ? (
        <div className="glass animate-in xp-card">
          <div className="xp-title">XP Gained</div>
          <div className="xp-value">+{stats.gainedXp} XP</div>
          {leveling && (
            <div className="xp-progress-row">
              <span className="xp-lvl">LVL {leveling.level}</span>
              <div className="xp-bar-track">
                <div className="xp-bar-fill" style={{ width: `${leveling.progress}%` }}></div>
              </div>
              <span className="xp-next">{leveling.nextLevelXp} XP</span>
            </div>
          )}
        </div>
      ) : null}

      {/* Calorie Estimate Card */}
      {stats.calories !== undefined && stats.calories > 0 && (
        <div className="glass animate-in calorie-card">
          {/* Left: icon + label */}
          <div className="calorie-main">
            <span className="calorie-icon">🔥</span>
            <div>
              <div className="calorie-label">
                Est. Calories Burned
              </div>
              <div className="calorie-value">
                {stats.calories}
                <span className="calorie-kcal">kcal</span>
              </div>
            </div>
          </div>

          {/* Right: accuracy impact note */}
          <div className="calorie-note">
            <div className="calorie-note-title">
              Accuracy Impact
            </div>
            <div
              className="calorie-impact"
              style={{
                color: stats.accuracy > 75 ? 'var(--neon-green)' : 'var(--neon-yellow)',
              }}
            >
              {stats.accuracy > 75
                ? '✅ Full credit'
                : stats.accuracy > 50
                  ? '⚠️ Reduced (form)'
                  : '⬇️ Low (poor form)'}
            </div>
            <div className="calorie-note-sub">
              MET-based estimate
            </div>
          </div>
        </div>
      )}

      {/* Mistake & Streak Insights */}
      <div className="animate-in insights-grid">
        <div className="glass insights-card">
          <div className="card-title card-title--yellow">
            Most Frequent Mistake
          </div>
          <div className="card-body">
            {getWorstMistake()}
          </div>
        </div>
        <div className="glass insights-card">
          <div className="card-title card-title--green">
            Peak Form Streak
          </div>
          <div className="card-body">
            {stats.bestStreak} Consecutive Reps
          </div>
        </div>
      </div>

      {/* Weekly Activity Bar Chart - Added for GSSoC Issue #49 */}
      <div className="glass animate-in weekly-card">
        <div className="section-title section-title--cyan">
          WEEKLY ACTIVITY (AVG ACCURACY)
        </div>
        {hasWeeklyActivity ? (
          <div className="weekly-chart">
            {weeklyData.map((item, index) => (
              <div key={index} className="weekly-col">
                <span className="weekly-value">
                  {item.score}%
                </span>

                {/* Fixed-height bar track container to prevent layout overflow */}
                <div className="weekly-bar-track">
                  <div className="weekly-bar" style={{
                    height: `${item.score}%`,
                    background: index === 6 ? 'linear-gradient(to top, var(--neon-purple), var(--neon-cyan))' : 'var(--neon-cyan)',
                    boxShadow: index === 6 ? '0 0 15px var(--neon-purple)' : '0 0 10px var(--neon-cyan)',
                  }}></div>
                </div>

                <span className="weekly-day-label">
                  {item.day}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="weekly-empty">
            No activity yet. Complete a workout to start your weekly trend.
          </div>
        )}
      </div>

      <div className="animate-in glass session-rating" style={{ borderColor: accuracyColor }}>
        <div className="session-rating-text" style={{ color: accuracyColor }}>SESSION RATING: {getPerformanceHighlight()}</div>
      </div>

      {/* AI Visual Insights */}
      {stats.tags && stats.tags.length > 0 && (
        <div className="animate-in glass tags-card">
          <div className="tags-title">
            AI VISUAL HIGHLIGHTS
          </div>
          <div className="tags-list">
            {stats.tags.map((tag) => (
              <span key={tag} className="tag-chip">
                {tag.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="animate-in streak-card">
        <h3 className="streak-card__title">
          🔥 Workout Streak
        </h3>

        <p className="streak-card__text">
          Current Streak: {streakData.currentStreak} days
        </p>

        <p className="streak-card__text--dim">
          Longest Streak: {streakData.longestStreak} days
        </p>
      </div>

      {/* Action Buttons */}
      <div className="animate-in action-row">
        <button onClick={onRestart} className="btn-outline">
          <RotateCcw size={16} /> RESTART
        </button>

        <button
          onClick={exportSessionData}
          className="btn-outline"
        >
          EXPORT DATA
        </button>

        <button
          onClick={onViewReplay}
          className="btn-neon"
          style={{ background: "var(--neon-purple)", color: "#fff" }}
        >
          VIEW 3D REPLAY <Video size={16} />
        </button>
      </div>
    </div>
  );
};
