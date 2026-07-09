import React, { useMemo } from "react";
import { TrendingUp, BarChart4, Calendar, ShieldCheck } from "lucide-react";
import type { WorkoutSession } from "../../useWorkoutHistory";

interface DashboardProps {
  sessions: WorkoutSession[];
}

export const Dashboard: React.FC<DashboardProps> = ({ sessions }) => {
  // ── 1. Calculate Calendar Heatmap Data (Last 28 Days) ──
  const heatmapData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days = Array.from({ length: 28 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (27 - i));
      return {
        date: d,
        reps: 0,
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      };
    });

    sessions.forEach((s) => {
      const sDate = new Date(s.timestamp);
      sDate.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - sDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays < 28) {
        const idx = 27 - diffDays;
        days[idx].reps += s.totalReps;
      }
    });

    return days;
  }, [sessions]);

  // ── 2. Calculate Weekly Accuracy Trends ──
  const weeklyAccuracy = useMemo(() => {
    if (sessions.length === 0) return 0;
    const totalAccuracy = sessions.reduce((sum, s) => sum + s.accuracyScore, 0);
    return Math.round(totalAccuracy / sessions.length);
  }, [sessions]);

  // ── 3. Calculate Total Reps ──
  const totalRepsCount = useMemo(() => {
    return sessions.reduce((sum, s) => sum + s.totalReps, 0);
  }, [sessions]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", width: "100%" }}>
      {/* Metrics Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
        <div className="fitness-card" style={{ padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
          <TrendingUp size={24} style={{ color: "var(--neon-cyan)" }} />
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Total Reps</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{totalRepsCount}</div>
          </div>
        </div>

        <div className="fitness-card" style={{ padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
          <ShieldCheck size={24} style={{ color: "var(--neon-green)" }} />
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Avg Accuracy</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{weeklyAccuracy}%</div>
          </div>
        </div>
      </div>

      {/* Calendar Heatmap Section */}
      <div className="fitness-card" style={{ padding: "20px" }}>
        <h3 className="fitness-card-title" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <Calendar size={18} />
          Consistency Heatmap (Last 28 Days)
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "8px",
            maxWidth: "320px",
            margin: "0 auto",
          }}
        >
          {heatmapData.map((day, idx) => {
            // Heatmap color intensity based on daily reps count
            let bg = "rgba(255, 255, 255, 0.05)";
            let border = "1px solid rgba(255, 255, 255, 0.1)";
            if (day.reps > 0 && day.reps <= 10) {
              bg = "rgba(34, 197, 94, 0.2)";
              border = "1px solid rgba(34, 197, 94, 0.4)";
            } else if (day.reps > 10 && day.reps <= 25) {
              bg = "rgba(34, 197, 94, 0.5)";
              border = "1px solid rgba(34, 197, 94, 0.7)";
            } else if (day.reps > 25) {
              bg = "var(--neon-green)";
              border = "1px solid var(--neon-green)";
            }

            return (
              <div
                key={idx}
                style={{
                  aspectRatio: "1",
                  background: bg,
                  border: border,
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.6rem",
                  color: day.reps > 25 ? "#000" : "var(--text-dim)",
                  fontWeight: "bold",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                title={`${day.label}: ${day.reps} reps`}
              >
                {day.date.getDate()}
              </div>
            );
          })}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "12px",
            fontSize: "0.65rem",
            color: "var(--text-dim)",
            marginTop: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <div style={{ width: "10px", height: "10px", background: "rgba(255, 255, 255, 0.05)", borderRadius: "2px" }}></div>
            <span>0 Reps</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <div style={{ width: "10px", height: "10px", background: "rgba(34, 197, 94, 0.2)", borderRadius: "2px" }}></div>
            <span>1-10 Reps</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <div style={{ width: "10px", height: "10px", background: "rgba(34, 197, 94, 0.5)", borderRadius: "2px" }}></div>
            <span>11-25 Reps</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <div style={{ width: "10px", height: "10px", background: "var(--neon-green)", borderRadius: "2px" }}></div>
            <span>25+ Reps</span>
          </div>
        </div>
      </div>
    </div>
  );
};
