import React from 'react';
import { Zap } from 'lucide-react';

interface VBTDegradationChartProps {
  velocitiesSession?: number[];
}

export const VBTDegradationChart: React.FC<VBTDegradationChartProps> = ({ velocitiesSession }) => {
  if (!velocitiesSession || velocitiesSession.length === 0) return null;

  const baseline = velocitiesSession[0] || 1;
  const maxVel = Math.max(...velocitiesSession, 1);

  return (
    <div className="glass animate-in" style={{ width: '100%', maxWidth: '600px', padding: '20px', marginBottom: '20px', borderTop: '2px solid var(--neon-purple)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.65rem', color: 'var(--neon-purple)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '16px', fontWeight: 700, textAlign: 'left' }}>
        <Zap size={16} /> VELOCITY DEGRADATION (VBT)
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '120px', padding: '0 10px' }}>
        {velocitiesSession.map((vel, index) => {
          const dropoff = baseline > 0 ? ((baseline - vel) / baseline) * 100 : 0;
          const heightPct = Math.min(100, Math.max(5, (vel / maxVel) * 100));
          const color = dropoff > 20 ? 'var(--neon-red)' : dropoff > 10 ? 'var(--neon-yellow)' : 'var(--neon-green)';
          return (
            <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end', gap: '4px' }}>
              <span style={{ fontSize: '0.55rem', color: '#fff', opacity: 0.8 }}>{Math.round(vel)}</span>
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
      <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginTop: '10px', textAlign: 'center' }}>
        Baseline Peak: {baseline.toFixed(1)} units/s | Final Drop-off: {velocitiesSession && velocitiesSession[0] ? ((1 - (velocitiesSession[velocitiesSession.length - 1] || 0) / velocitiesSession[0]) * 100).toFixed(0) : 0}%
      </div>
    </div>
  );
};