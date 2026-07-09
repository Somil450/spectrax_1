import React, { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import type { WorkoutSession } from "../useWorkoutHistory";

export const ProgressAnalyticsWidget: React.FC<{ sessions: WorkoutSession[] }> = ({ sessions }) => {
  // Group sessions by day for the last 7 days
  const chartData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return {
        date: d,
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        totalReps: 0,
        totalAccuracy: 0,
        sessionCount: 0,
      };
    });

    sessions.forEach((s) => {
      const sDate = new Date(s.timestamp);
      sDate.setHours(0, 0, 0, 0);
      const dayDiff = Math.floor((today.getTime() - sDate.getTime()) / (1000 * 3600 * 24));
      
      if (dayDiff >= 0 && dayDiff < 7) {
        const idx = 6 - dayDiff;
        days[idx].totalReps += s.totalReps;
        days[idx].totalAccuracy += s.accuracyScore;
        days[idx].sessionCount += 1;
      }
    });

    return days.map(d => ({
      ...d,
      avgAccuracy: d.sessionCount > 0 ? Math.round(d.totalAccuracy / d.sessionCount) : 0,
    }));
  }, [sessions]);

  const maxReps = Math.max(...chartData.map(d => d.totalReps), 10); // avoid div by 0

  return (
    <div className="fitness-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2 className="fitness-card-title">
        <TrendingUp size={18} /> 7-Day Reps Volume
      </h2>
      
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '16px', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '8px' }}>
        {chartData.map((day, idx) => {
          const heightPercent = Math.max((day.totalReps / maxReps) * 100, 2); // 2% min height for visibility
          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                {day.totalReps > 0 ? day.totalReps : ''}
              </span>
              <div 
                style={{ 
                  width: '100%', 
                  maxWidth: '32px', 
                  height: `${heightPercent}%`, 
                  minHeight: '4px',
                  background: day.totalReps > 0 ? 'var(--neon-cyan)' : 'rgba(255, 255, 255, 0.05)', 
                  borderRadius: '4px 4px 0 0',
                  transition: 'height 0.3s ease',
                  position: 'relative'
                }}
                title={`${day.label}: ${day.totalReps} reps, ${day.avgAccuracy}% avg accuracy`}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                {day.label}
              </span>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '12px', textAlign: 'center' }}>
        Total volume tracking helps ensure progressive overload.
      </p>
    </div>
  );
};
