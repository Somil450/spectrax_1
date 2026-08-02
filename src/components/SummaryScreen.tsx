import React, { useEffect, useMemo, useState } from 'react';
import { Award, Clock, RotateCcw, Video, Activity, FileJson, FileSpreadsheet } from 'lucide-react';
import { updateWorkoutStreak } from "../utils/streakUtils";
import { useAuth } from '../context/AuthContext';
import { getLocalWorkouts, WorkoutRecord } from '../services/workoutSyncService';
import {
  buildRepLog,
  countQualityTiers,
  longestGoodStreak,
  exportSessionJSON,
  exportSessionCSV,
  type RepLogRow,
  type RepQualityTier,
} from '../utils/sessionExport';

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
      exportSessionJSON(stats);
    } catch (error) {
      console.error("Failed to export session data:", error);
      alert("Unable to export session data. Please try again.");
    }
  };

  const exportSessionCsv = () => {
    try {
      exportSessionCSV(stats);
    } catch (error) {
      console.error("Failed to export session CSV:", error);
      alert("Unable to export session CSV. Please try again.");
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

  // Rep-level breakdown derived from per-rep scores (issue #984)
  const repLog: RepLogRow[] = useMemo(() => buildRepLog(stats), [stats]);
  const qualityCounts = useMemo(() => countQualityTiers(repLog), [repLog]);
  const goodRepStreak = useMemo(() => longestGoodStreak(repLog), [repLog]);
  const hasRepData = repLog.length > 0;

  if (stats.totalReps === 0) {
    return (
      <div
        className="screen-container"
        style={{
          background:
            "radial-gradient(ellipse at 50% 20%, #151b4d 0%, var(--bg-primary) 70%)",
          padding: "60px 40px",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          className="animate-in"
          style={{ textAlign: "center", marginBottom: "40px" }}
        >
          <h2
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "2rem",
              color: "var(--neon-purple)",
              letterSpacing: "4px",
            }}
          >
            SESSION COMPLETE
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "1.2rem",
              marginTop: "16px",
            }}
          >
            No reps detected
          </p>
        </div>
        <div
          className="animate-in"
          style={{
            display: "flex",
            gap: "20px",
            width: "100%",
            maxWidth: "300px",
            pointerEvents: "all",
          }}
        >
          <button
            onClick={onRestart}
            className="btn-neon"
            style={{ flex: 1, background: "var(--neon-purple)", color: "#fff" }}
          >
            <RotateCcw size={16} /> RESTART SESSION
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="screen-container"
      style={{
        background:
          "radial-gradient(ellipse at 50% 20%, #151b4d 0%, var(--bg-primary) 70%)",
        padding: "60px 40px",
        alignItems: "center",
        overflowY: "auto",
      }}
    >
      <div
        className="animate-in"
        style={{ textAlign: "center", marginBottom: "30px" }}
      >
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "2rem",
            color: "var(--neon-purple)",
            letterSpacing: "4px",
          }}
        >
          PERFORMANCE SUMMARY
        </h2>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "0.9rem",
            marginTop: "8px",
          }}
        >
          Session complete. AI analysis synchronized.
        </p>
      </div>

      {/* Accuracy Ring */}
      <div
        className="glass animate-in"
        style={{
          width: "220px",
          height: "220px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          marginBottom: "30px",
          border: `1px solid ${accuracyColor}`,
          boxShadow: `0 0 30px ${accuracyColor}33`,
        }}
      >
        <svg
          width="180"
          height="180"
          viewBox="0 0 160 160"
          style={{ transform: "rotate(-90deg)" }}
        >
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke="rgba(255,255,255,0.05)"
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
            style={{ transition: "stroke-dashoffset 1.5s var(--ease-out)" }}
          />
        </svg>
        <div style={{ position: "absolute", textAlign: "center" }}>
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "3rem",
              fontWeight: 900,
              color: "#fff",
            }}
          >
            {accuracy}
            <span style={{ fontSize: "1rem", color: "var(--text-dim)" }}>
              %
            </span>
          </div>
          <div
            style={{
              fontSize: "0.65rem",
              color: "var(--text-dim)",
              letterSpacing: "2px",
              textTransform: "uppercase",
            }}
          >
            Overall Accuracy
          </div>
        </div>
      </div>

      {/* Core Metrics */}
      <div
        className="animate-in"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "15px",
          width: "100%",
          maxWidth: "600px",
          marginBottom: "20px",
        }}
      >
        <div
          className="glass"
          style={{
            padding: "20px 10px",
            textAlign: "center",
            borderTop: "2px solid var(--neon-green)",
          }}
        >
          <Award
            size={18}
            color="var(--neon-green)"
            style={{ marginBottom: "8px", margin: "0 auto" }}
          />
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "1.4rem",
              color: "#fff",
            }}
          >
            {stats.reps}
          </div>
          <div
            style={{
              fontSize: "0.6rem",
              color: "var(--text-dim)",
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            Correct Reps
          </div>
        </div>
        <div
          className="glass"
          style={{
            padding: "20px 10px",
            textAlign: "center",
            borderTop: "2px solid var(--neon-cyan)",
          }}
        >
          <Activity
            size={18}
            color="var(--neon-cyan)"
            style={{ marginBottom: "8px", margin: "0 auto" }}
          />
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "1.4rem",
              color: "#fff",
            }}
          >
            {stats.totalReps}
          </div>
          <div
            style={{
              fontSize: "0.6rem",
              color: "var(--text-dim)",
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            Total Rated
          </div>
        </div>
        <div
          className="glass"
          style={{
            padding: "20px 10px",
            textAlign: "center",
            borderTop: "2px solid var(--neon-purple)",
          }}
        >
          <Clock
            size={18}
            color="var(--neon-purple)"
            style={{ marginBottom: "8px", margin: "0 auto" }}
          />
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "1.4rem",
              color: "#fff",
            }}
          >
            {formatTime(stats.duration)}
          </div>
          <div
            style={{
              fontSize: "0.6rem",
              color: "var(--text-dim)",
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            Duration
          </div>
        </div>
      </div>

      {/* Rep Quality Insights */}
      <div
        className="glass animate-in"
        style={{
          width: "100%",
          maxWidth: "600px",
          padding: "20px",
          marginBottom: "20px",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "0.65rem",
              color: "var(--text-dim)",
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: "4px",
            }}
          >
            Peak Form Target
          </div>
          <div
            style={{
              color: "var(--neon-cyan)",
              fontSize: "1.2rem",
              fontWeight: "bold",
            }}
          >
            {bestRepScore}%
          </div>
        </div>
        <div
          style={{
            width: "1px",
            height: "40px",
            background: "rgba(255,255,255,0.1)",
          }}
        ></div>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "0.65rem",
              color: "var(--text-dim)",
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: "4px",
            }}
          >
            Consistency Average
          </div>
          <div
            style={{ color: "#fff", fontSize: "1.2rem", fontWeight: "bold" }}
          >
            {averageRepScore}%
          </div>
        </div>
        <div
          style={{
            width: "1px",
            height: "40px",
            background: "rgba(255,255,255,0.1)",
          }}
        ></div>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "0.65rem",
              color: "var(--text-dim)",
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: "4px",
            }}
          >
            Lowest Drop-Off
          </div>
          <div
            style={{
              color: "var(--neon-red)",
              fontSize: "1.2rem",
              fontWeight: "bold",
            }}
          >
            {worstRepScore}%
          </div>
        </div>
      </div>

      {/* Rep Quality Breakdown — issue #984 */}
      {hasRepData && (
        <div className="glass animate-in" style={{ width: '100%', maxWidth: '600px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--neon-cyan)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px', fontWeight: 700, textAlign: 'left' }}>
            REP QUALITY BREAKDOWN
          </div>
          <div style={{ display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden', marginBottom: '14px', background: 'rgba(255,255,255,0.05)' }}>
            {repLog.length > 0 && (
              <>
                <div style={{ width: `${(qualityCounts.Good / repLog.length) * 100}%`, background: 'var(--neon-green)', boxShadow: '0 0 8px var(--neon-green)55' }} title={`Good: ${qualityCounts.Good}`} />
                <div style={{ width: `${(qualityCounts.Acceptable / repLog.length) * 100}%`, background: 'var(--neon-yellow)', boxShadow: '0 0 8px var(--neon-yellow)55' }} title={`Acceptable: ${qualityCounts.Acceptable}`} />
                <div style={{ width: `${(qualityCounts.Poor / repLog.length) * 100}%`, background: 'var(--neon-red)', boxShadow: '0 0 8px var(--neon-red)55' }} title={`Poor: ${qualityCounts.Poor}`} />
              </>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', gap: '10px', flexWrap: 'wrap' }}>
            <QualityTierStat label="Good" count={qualityCounts.Good} color="var(--neon-green)" />
            <QualityTierStat label="Acceptable" count={qualityCounts.Acceptable} color="var(--neon-yellow)" />
            <QualityTierStat label="Poor" count={qualityCounts.Poor} color="var(--neon-red)" />
          </div>
        </div>
      )}

      {/* Form Score Timeline — issue #984 */}
      {hasRepData && (
        <div className="glass animate-in" style={{ width: '100%', maxWidth: '600px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--neon-purple)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px', fontWeight: 700, textAlign: 'left' }}>
            FORM SCORE TIMELINE
          </div>
          <FormScoreTimeline rows={repLog} />
        </div>
      )}

      {/* Rep-by-Rep Details — issue #984 */}
      {hasRepData && (
        <div className="glass animate-in" style={{ width: '100%', maxWidth: '600px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--neon-yellow)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px', fontWeight: 700, textAlign: 'left' }}>
            REP-BY-REP DETAILS
          </div>
          <div style={{ maxHeight: '260px', overflowY: 'auto', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Space Mono', monospace", fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: '0.62rem', letterSpacing: '1px' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Rep</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Time</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Score</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Tier</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Flagged Issue</th>
                </tr>
              </thead>
              <tbody>
                {repLog.map((row) => (
                  <tr key={row.rep} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '7px 10px', color: '#fff' }}>#{row.rep}</td>
                    <td style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>{formatTime(row.timestampSec)}</td>
                    <td style={{ padding: '7px 10px', color: tierColor(row.tier), fontWeight: 700 }}>{row.score}%</td>
                    <td style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>{row.tier}</td>
                    <td style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>{row.issue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Fatigue Insights */}
      {stats.repDeviations && stats.repDeviations.length > 0 && (
        <div className="glass animate-in" style={{ width: '100%', maxWidth: '600px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--neon-yellow)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '20px', fontWeight: 700, textAlign: 'left' }}>
            FORM FATIGUE (POSTURE DEVIATION)
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '100px', padding: '0 10px', paddingTop: '10px' }}>
            {stats.repDeviations.map((dev, index) => {
              // Normalise deviation to a max of 30 for visualization
              const maxDev = 30;
              const heightPct = Math.min(100, Math.max(5, (dev / maxDev) * 100));
              // Color logic: low deviation is green, high is red
              const color = dev < 10 ? 'var(--neon-green)' : dev < 20 ? 'var(--neon-yellow)' : 'var(--neon-red)';
              return (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end', gap: '4px' }}>
                  <span style={{ fontSize: '0.55rem', color: '#fff', opacity: 0.8 }}>{Math.round(dev)}</span>
                  <div style={{
                    width: '60%',
                    maxWidth: '20px',
                    height: `${heightPct}%`,
                    background: color,
                    borderRadius: '2px 2px 0 0',
                    boxShadow: `0 0 8px ${color}44`,
                    transition: 'height 1s ease-in-out',
                    minHeight: '4px'
                  }}></div>
                  <span style={{ fontSize: '0.55rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>R{index + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {stats.jumpingJackSync?.score !== null && stats.jumpingJackSync?.score !== undefined && (
        <div className="glass animate-in" style={{ width: '100%', maxWidth: '600px', padding: '20px', marginBottom: '20px', borderTop: '2px solid var(--neon-cyan)' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--neon-cyan)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px', fontWeight: 700, textAlign: 'left' }}>
            JUMPING JACK COORDINATION
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center' }}>
            <div>
              <div style={{ color: '#fff', fontSize: '1.6rem', fontWeight: 900 }}>{stats.jumpingJackSync.score}%</div>
              <div style={{ fontSize: '0.55rem', color: 'var(--text-dim)', letterSpacing: '1px', textTransform: 'uppercase' }}>Sync Score</div>
            </div>
            <div>
              <div style={{ color: stats.jumpingJackSync.lagMs && stats.jumpingJackSync.lagMs > 0 ? 'var(--neon-yellow)' : 'var(--neon-green)', fontSize: '1.6rem', fontWeight: 900 }}>
                {stats.jumpingJackSync.lagMs ? `${Math.abs(stats.jumpingJackSync.lagMs)}ms` : '0ms'}
              </div>
              <div style={{ fontSize: '0.55rem', color: 'var(--text-dim)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                {stats.jumpingJackSync.lagMs && stats.jumpingJackSync.lagMs < 0 ? 'Arms Lead' : 'Arm Lag'}
              </div>
            </div>
            <div>
              <div style={{ color: '#fff', fontSize: '1.6rem', fontWeight: 900 }}>{Math.round(stats.jumpingJackSync.confidence * 100)}%</div>
              <div style={{ fontSize: '0.55rem', color: 'var(--text-dim)', letterSpacing: '1px', textTransform: 'uppercase' }}>Confidence</div>
            </div>
          </div>
        </div>
      )}

      {stats.gainedXp ? (
        <div className="glass animate-in" style={{ width: '100%', maxWidth: '600px', padding: '20px', marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', borderColor: 'var(--neon-yellow)', background: 'rgba(255, 235, 59, 0.05)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--neon-yellow)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 700 }}>XP Gained</div>
          <div style={{ color: '#fff', fontSize: '2rem', fontWeight: 900, marginBottom: '8px' }}>+{stats.gainedXp} XP</div>
          {leveling && (
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '15px' }}>
              <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem', fontWeight: 'bold' }}>LVL {leveling.level}</span>
              <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${leveling.progress}%`, height: '100%', background: 'var(--neon-yellow)' }}></div>
              </div>
              <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{leveling.nextLevelXp} XP</span>
            </div>
          )}
        </div>
      ) : null}

      {/* Calorie Estimate Card */}
      {stats.calories !== undefined && stats.calories > 0 && (
        <div
          className="glass animate-in"
          style={{
            width: '100%',
            maxWidth: '600px',
            padding: '20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderColor: 'var(--neon-green)',
            background: 'rgba(0, 255, 100, 0.04)',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* Left: icon + label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '2rem' }}>🔥</span>
            <div>
              <div
                style={{
                  fontSize: '0.65rem',
                  color: 'var(--neon-green)',
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  marginBottom: '4px',
                }}
              >
                Est. Calories Burned
              </div>
              <div
                style={{
                  color: '#fff',
                  fontSize: '2rem',
                  fontWeight: 900,
                  fontFamily: 'var(--font-heading)',
                  lineHeight: 1,
                }}
              >
                {stats.calories}
                <span
                  style={{
                    fontSize: '1rem',
                    color: 'var(--text-dim)',
                    marginLeft: '4px',
                  }}
                >
                  kcal
                </span>
              </div>
            </div>
          </div>

          {/* Right: accuracy impact note */}
          <div
            style={{
              textAlign: 'right',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div
              style={{
                fontSize: '0.65rem',
                color: 'var(--text-dim)',
                letterSpacing: '1px',
                textTransform: 'uppercase',
              }}
            >
              Accuracy Impact
            </div>
            <div
              style={{
                fontSize: '0.85rem',
                color: stats.accuracy > 75 ? 'var(--neon-green)' : 'var(--neon-yellow)',
                fontWeight: 700,
              }}
            >
              {stats.accuracy > 75
                ? '✅ Full credit'
                : stats.accuracy > 50
                  ? '⚠️ Reduced (form)'
                  : '⬇️ Low (poor form)'}
            </div>
            <div
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-dim)',
              }}
            >
              MET-based estimate
            </div>
          </div>
        </div>
      )}

      {/* Mistake & Streak Insights */}
      <div
        className="animate-in"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "15px",
          width: "100%",
          maxWidth: "600px",
          marginBottom: "30px",
        }}
      >
        <div
          className="glass"
          style={{
            padding: "20px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: "0.65rem",
              color: "var(--neon-yellow)",
              letterSpacing: "2px",
              textTransform: "uppercase",
              marginBottom: "8px",
              fontWeight: 700,
            }}
          >
            Most Frequent Mistake
          </div>
          <div
            style={{ color: "#fff", fontSize: "1.1rem", marginBottom: "4px" }}
          >
            {getWorstMistake()}
          </div>
        </div>
        <div className="glass" style={{ padding: "20px", textAlign: "center" }}>
          <div
            style={{
              fontSize: "0.65rem",
              color: "var(--neon-green)",
              letterSpacing: "2px",
              textTransform: "uppercase",
              marginBottom: "8px",
              fontWeight: 700,
            }}
          >
            Peak Form Streak
          </div>
          <div
            style={{ color: "#fff", fontSize: "1.1rem", marginBottom: "4px" }}
          >
            {stats.bestStreak} Consecutive Reps
          </div>
        </div>
      </div>
      {/* Weekly Activity Bar Chart - Added for GSSoC Issue #49 */}
      <div className="glass animate-in" style={{ width: '100%', maxWidth: '600px', padding: '20px', marginBottom: '20px' }}>
        <div style={{ fontSize: '0.65rem', color: 'var(--neon-cyan)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '20px', fontWeight: 700, textAlign: 'left' }}>
          WEEKLY ACTIVITY (AVG ACCURACY)
        </div>
        {hasWeeklyActivity ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '140px', padding: '0 10px', paddingTop: '10px' }}>
            {weeklyData.map((item, index) => (
              <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '0.65rem', color: '#fff', marginBottom: '4px', opacity: 0.8 }}>
                  {item.score}%
                </span>

                {/* Fix 1: Fixed-height bar track container to prevent layout overflow */}
                <div style={{ height: '80px', width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <div style={{
                    width: '70%',
                    maxWidth: '30px',
                    height: `${item.score}%`,
                    background: index === 6 ? 'linear-gradient(to top, var(--neon-purple), var(--neon-cyan))' : 'var(--neon-cyan)',
                    borderRadius: '4px 4px 0 0',
                    boxShadow: index === 6 ? '0 0 15px var(--neon-purple)' : '0 0 10px var(--neon-cyan)44',
                    transition: 'height 1s ease-in-out',
                    minHeight: '5px'
                  }}></div>
                </div>

                <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '8px', textTransform: 'uppercase' }}>
                  {item.day}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '140px', color: 'var(--text-dim)', fontSize: '0.85rem', textAlign: 'center', padding: '0 20px' }}>
            No activity yet. Complete a workout to start your weekly trend.
          </div>
        )}
      </div>
      <div className="animate-in glass" style={{ width: '100%', maxWidth: '600px', padding: '15px', textAlign: 'center', marginBottom: '40px', borderColor: accuracyColor }}>
        <div style={{ color: accuracyColor, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '2px' }}>SESSION RATING: {getPerformanceHighlight()}</div>
      </div>

      {/* AI Visual Insights */}
      {stats.tags && stats.tags.length > 0 && (
        <div
          className="animate-in glass"
          style={{
            width: "100%",
            maxWidth: "600px",
            padding: "20px",
            marginBottom: "30px",
            background: "rgba(157, 78, 221, 0.05)",
            borderStyle: "dashed",
            borderColor: "var(--neon-purple)",
          }}
        >
          <div
            style={{
              color: "var(--neon-purple)",
              fontSize: "0.65rem",
              letterSpacing: "2px",
              textTransform: "uppercase",
              marginBottom: "15px",
              fontWeight: 800,
            }}
          >
            AI VISUAL HIGHLIGHTS
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              justifyContent: "center",
            }}
          >
            {stats.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  background: "rgba(157, 78, 221, 0.15)",
                  color: "#fff",
                  padding: "6px 14px",
                  borderRadius: "20px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  border: "1px solid var(--neon-purple)",
                  boxShadow: "0 0 10px rgba(157, 78, 221, 0.3)",
                }}
              >
                {tag.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      )}

      <div
        className="animate-in"
        style={{
          width: "100%",
          maxWidth: "600px",
          marginBottom: "24px",
          padding: "20px",
          borderRadius: "16px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          textAlign: "center",
        }}
      >
        <h3
          style={{
            color: "#00e0ff",
            marginBottom: "12px",
            fontSize: "1.3rem",
          }}
        >
          🔥 Workout Streak
        </h3>

        <p
          style={{
            color: "#ffffff",
            fontSize: "1.1rem",
            marginBottom: "8px",
          }}
        >
          Current Streak: {streakData.currentStreak} days
        </p>

        <p
          style={{
            color: "#bbbbbb",
            fontSize: "0.95rem",
          }}
        >
          Longest Streak: {streakData.longestStreak} days
        </p>
      </div>

      {/* Action Buttons */}
      <div
        className="animate-in"
        style={{
          display: "flex",
          gap: "20px",
          width: "100%",
          maxWidth: "600px",
          pointerEvents: "all",
        }}
      >
        <button onClick={onRestart} className="btn-outline" style={{ flex: 1 }}>
          <RotateCcw size={16} /> RESTART
        </button>

        <button
          onClick={exportSessionData}
          className="btn-outline"
          style={{ flex: 1 }}
        >
          <FileJson size={16} /> EXPORT JSON
        </button>

        <button
          onClick={exportSessionCsv}
          className="btn-outline"
          style={{ flex: 1 }}
        >
          <FileSpreadsheet size={16} /> EXPORT CSV
        </button>

        <button
          onClick={onViewReplay}
          className="btn-neon"
          style={{ flex: 1, background: "var(--neon-purple)", color: "#fff" }}
        >
          VIEW 3D REPLAY <Video size={16} />
        </button>      </div>
    </div>
  );
};

function tierColor(tier: RepQualityTier): string {
  if (tier === "Good") return "var(--neon-green)";
  if (tier === "Acceptable") return "var(--neon-yellow)";
  return "var(--neon-red)";
}

interface QualityTierStatProps {
  label: string;
  count: number;
  color: string;
}

const QualityTierStat: React.FC<QualityTierStatProps> = ({ label, count, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '120px' }}>
    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}88` }} />
    <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '1px', flex: 1 }}>{label}</span>
    <span style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 700, fontFamily: "'Space Mono', monospace" }}>{count}</span>
  </div>
);

interface FormScoreTimelineProps {
  rows: RepLogRow[];
}

const FormScoreTimeline: React.FC<FormScoreTimelineProps> = ({ rows }) => {
  const width = 560;
  const height = 180;
  const padLeft = 30;
  const padRight = 10;
  const padTop = 12;
  const padBottom = 24;
  const maxScore = 100;
  const minScore = 0;

  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const xFor = (index: number) => {
    if (rows.length === 1) return padLeft + plotWidth / 2;
    return padLeft + (index / (rows.length - 1)) * plotWidth;
  };
  const yFor = (score: number) =>
    padTop + plotHeight - (score / (maxScore - minScore)) * plotHeight;

  const points = rows.map((row, index) => `${xFor(index)},${yFor(row.score)}`).join(" ");
  const goodY = yFor(80);
  const poorY = yFor(60);

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', minWidth: '320px', height: 'auto', display: 'block' }}>
        {/* Score zone bands */}
        <rect x={padLeft} y={goodY} width={plotWidth} height={padTop + plotHeight - goodY} fill="rgba(34,211,160,0.06)" />
        <rect x={padLeft} y={poorY} width={plotWidth} height={goodY - poorY} fill="rgba(251,191,36,0.05)" />
        <rect x={padLeft} y={padTop} width={plotWidth} height={poorY - padTop} fill="rgba(239,68,68,0.06)" />

        {/* Gridlines + labels */}
        {[100, 80, 60, 40, 20, 0].map((score) => (
          <g key={score}>
            <line x1={padLeft} y1={yFor(score)} x2={padLeft + plotWidth} y2={yFor(score)} stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" />
            <text x={padLeft - 6} y={yFor(score) + 3} textAnchor="end" fontSize="9" fill="var(--text-dim)" fontFamily="'Space Mono', monospace">{score}</text>
          </g>
        ))}

        {/* Polyline */}
        <polyline
          points={points}
          fill="none"
          stroke="var(--neon-cyan)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ filter: 'drop-shadow(0 0 4px rgba(0,240,255,0.5))' }}
        />

        {/* Rep dots */}
        {rows.map((row, index) => (
          <g key={row.rep}>
            <circle cx={xFor(index)} cy={yFor(row.score)} r="3" fill={tierColor(row.tier)} stroke="#0a0e1a" strokeWidth="1" />
            {index % Math.ceil(rows.length / 12) === 0 && (
              <text x={xFor(index)} y={height - 8} textAnchor="middle" fontSize="8.5" fill="var(--text-dim)" fontFamily="'Space Mono', monospace">
                {row.rep}
              </text>
            )}
          </g>
        ))}

        <text x={padLeft + plotWidth / 2} y={height - 2} textAnchor="middle" fontSize="9" fill="var(--text-dim)" fontFamily="'Space Mono', monospace">
          REP →
        </text>
      </svg>
    </div>
  );
};
