import React, { useMemo, useState } from 'react';
import { BarChart3, Timer, Dumbbell } from 'lucide-react';
import {
  getWeeklyActivity,
  type WeeklyActivityDay,
} from '../utils/weeklyActivity';

type Metric = "reps" | "minutes";

interface WeeklyActivityChartProps {
  /** Workout records with timestamp / totalReps / duration (seconds) */
  workouts: Array<{
    timestamp: number;
    totalReps: number;
    duration: number;
  }>;
  now?: Date;
}

export const WeeklyActivityChart: React.FC<WeeklyActivityChartProps> = ({
  workouts,
  now,
}) => {
  const [metric, setMetric] = useState<Metric>("reps");

  const days = useMemo(
    () => getWeeklyActivity(workouts, now),
    [workouts, now],
  );

  const hasActivity = days.some((d) => d.sessions > 0);

  const values = days.map((d) =>
    metric === "reps" ? d.reps : d.minutes,
  );
  const maxValue = Math.max(1, ...values);

  const formatValue = (d: WeeklyActivityDay): string => {
    if (d.sessions === 0) return "—";
    return metric === "reps" ? `${d.reps}` : `${d.minutes}m`;
  };

  const tooltip = (d: WeeklyActivityDay): string => {
    if (d.sessions === 0) return "No activity";
    return `${d.sessions} session${d.sessions > 1 ? "s" : ""} · ${d.reps} reps · ${d.minutes} min`;
  };

  const metricBtn = (
    active: Metric,
    label: string,
    icon: React.ReactNode,
  ): React.ReactNode => (
    <button
      onClick={() => setMetric(active)}
      aria-pressed={metric === active}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 12px",
        borderRadius: "8px",
        border: "1px solid",
        cursor: "pointer",
        fontSize: "0.7rem",
        letterSpacing: "1px",
        textTransform: "uppercase",
        fontWeight: 700,
        fontFamily: "'Space Mono', monospace",
        background: metric === active ? "rgba(34, 211, 238, 0.12)" : "transparent",
        color: metric === active ? "var(--neon-cyan)" : "var(--text-dim)",
        borderColor: metric === active ? "var(--neon-cyan)" : "rgba(148, 163, 184, 0.3)",
        transition: "all 0.2s ease",
      }}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div
      className="animate-in glass"
      style={{
        width: "100%",
        maxWidth: "640px",
        padding: "20px",
        margin: "0 auto 20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "18px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <BarChart3 size={16} color="var(--neon-purple)" />
          <span
            style={{
              fontSize: "0.65rem",
              color: "var(--neon-cyan)",
              letterSpacing: "2px",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            Weekly Activity
          </span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {metricBtn("reps", "Reps", <Dumbbell size={12} />)}
          {metricBtn("minutes", "Minutes", <Timer size={12} />)}
        </div>
      </div>

      {hasActivity ? (
        <div
          role="img"
          aria-label="Bar chart of workout activity over the last 7 days"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: "8px",
            height: "170px",
            padding: "10px 6px 0",
          }}
        >
          {days.map((d, index) => {
            const value = values[index];
            const height = Math.round((value / maxValue) * 100);
            const isToday = d.isToday;
            return (
              <div
                key={d.key}
                title={tooltip(d)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flex: 1,
                  height: "100%",
                  justifyContent: "flex-end",
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontSize: "0.6rem",
                    color: "#fff",
                    marginBottom: "4px",
                    opacity: d.sessions > 0 ? 0.9 : 0.35,
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatValue(d)}
                </span>
                <div
                  style={{
                    height: "110px",
                    width: "100%",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      width: "70%",
                      maxWidth: "28px",
                      height: d.sessions > 0 ? `${Math.max(height, 4)}%` : "4px",
                      background:
                        d.sessions === 0
                          ? "rgba(148, 163, 184, 0.15)"
                          : isToday
                            ? "linear-gradient(to top, var(--neon-purple), var(--neon-cyan))"
                            : "var(--neon-cyan)",
                      borderRadius: "4px 4px 0 0",
                      boxShadow:
                        d.sessions === 0
                          ? "none"
                          : isToday
                            ? "0 0 15px var(--neon-purple)"
                            : "0 0 10px rgba(34, 211, 238, 0.25)",
                      transition: "height 0.8s ease-in-out",
                      opacity: d.sessions > 0 ? 1 : 0.4,
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: "0.6rem",
                    color: isToday ? "var(--neon-cyan)" : "var(--text-dim)",
                    marginTop: "8px",
                    textTransform: "uppercase",
                    fontWeight: isToday ? 700 : 400,
                    whiteSpace: "nowrap",
                  }}
                >
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "170px",
            color: "var(--text-dim)",
            fontSize: "0.85rem",
            textAlign: "center",
            padding: "0 20px",
          }}
        >
          No activity in the last 7 days. Complete a workout to start your
          weekly trend.
        </div>
      )}
    </div>
  );
};
