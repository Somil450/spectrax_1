import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WorkoutSession } from '../useWorkoutHistory';
import {
  aggregateWorkoutChartData,
  type ChartPeriod,
} from '../utils/workoutChartData';

interface WorkoutChartProps {
  sessions: WorkoutSession[];
}

export const WorkoutChart: React.FC<WorkoutChartProps> = ({ sessions }) => {
  const [period, setPeriod] = useState<ChartPeriod>('weekly');
  const data = useMemo(
    () => aggregateWorkoutChartData(sessions, period),
    [sessions, period],
  );

  if (!sessions.length) return null;

  return (
    <div className="workout-chart">
      <div className="workout-chart-header">
        <h2>Activity Overview</h2>
        <div className="workout-chart-toggle">
          <button
            type="button"
            className={period === 'weekly' ? 'active' : ''}
            onClick={() => setPeriod('weekly')}
          >
            Weekly
          </button>
          <button
            type="button"
            className={period === 'monthly' ? 'active' : ''}
            onClick={() => setPeriod('monthly')}
          >
            Monthly
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="label" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} />
          <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--glass-border)',
              borderRadius: 8,
              color: 'var(--text-primary)',
            }}
          />
          <Bar dataKey="sessions" name="Sessions" fill="#22d3a0" radius={[4, 4, 0, 0]} />
          <Bar dataKey="calories" name="Calories (est.)" fill="#00f0ff" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <style>{`
        .workout-chart {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          padding: 20px;
          margin-bottom: 24px;
        }
        .workout-chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .workout-chart-header h2 {
          font-size: 1rem;
          color: var(--text-primary);
          letter-spacing: 0.04em;
        }
        .workout-chart-toggle {
          display: flex;
          gap: 6px;
        }
        .workout-chart-toggle button {
          padding: 6px 14px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.12);
          background: transparent;
          color: var(--text-dim);
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 600;
        }
        .workout-chart-toggle button.active {
          background: rgba(0, 240, 255, 0.12);
          border-color: rgba(0, 240, 255, 0.35);
          color: var(--neon-cyan);
        }
      `}</style>
    </div>
  );
};
