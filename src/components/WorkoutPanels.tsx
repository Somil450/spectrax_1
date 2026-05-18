import React from "react";
import { Activity } from "lucide-react";

export const FocusPanel = ({ exerciseName }: { exerciseName: string }) => (
  <div className="glass workout-stat-card workout-focus-panel animate-in">
    <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>Session Focus</div>
    <div style={{ fontFamily: 'var(--font-heading)', color: 'var(--neon-cyan)', fontSize: '1.2rem' }}>{exerciseName.toUpperCase()}</div>
  </div>
);

export const TimerPanel = ({ seconds }: { seconds: number }) => {
  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60).toString().padStart(2, "0");
    const secs = (s % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };
  return (
    <div className="glass workout-stat-card workout-timer-panel animate-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', marginBottom: '4px' }}>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '2px', textTransform: 'uppercase' }}>Time</span>
      </div>
      <div style={{ fontFamily: 'var(--font-heading)', color: '#fff', fontSize: '1.5rem' }}>{formatTime(seconds)}</div>
    </div>
  );
};

export const RepsPanel = ({ reps, statusColor }: { reps: number, statusColor: string }) => (
  <div className="rep-counter workout-reps-panel animate-in" style={{ textAlign: 'center' }}>
    <div style={{ fontFamily: 'var(--font-heading)', fontSize: '7rem', fontWeight: 900, lineHeight: 1, color: '#fff', textShadow: `0 0 40px ${statusColor}44` }}>{reps}</div>
    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', letterSpacing: '4px', textTransform: 'uppercase' }}>Repetitions</div>
  </div>
);

export const EnginePanel = ({ status, statusColor }: { status: string, statusColor: string }) => (
  <div className="glass workout-stat-card animate-in" style={{ borderLeft: `3px solid ${statusColor}` }}>
    <div style={{ fontSize: '0.75rem', color: statusColor, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
      <Activity size={14} /> AI ENGINE: {status === 'green' ? 'STABLE' : 'CORRECTION REQUIRED'}
    </div>
  </div>
);

export const SensePanel = ({ clipEngine, clipResult }: { clipEngine: any, clipResult: any }) => (
  clipEngine.isReady() || clipEngine.getMode() === 'cloud' ? (
    <div className="glass workout-stat-card workout-sense-panel animate-in">
      <div className="radar-ping" style={{ width: '8px', height: '8px', background: '#9D4EDD', borderRadius: '50%' }}></div>
      <div style={{ fontSize: '0.75rem', color: '#9D4EDD', fontWeight: 700 }}>
        VLM SENSE: {clipEngine.getMode() === 'cloud' ? (clipResult ? `CLOUD: ${clipResult.label.toUpperCase()}` : 'CLOUD ACTIVATING...') : (clipResult ? clipResult.label.toUpperCase() : 'SCANNING...')} ({clipResult ? Math.round(clipResult.confidence * 100) : 0}%)
      </div>
    </div>
  ) : (
    <div className="glass workout-stat-card animate-in" style={{ borderLeft: '3px solid var(--neon-cyan)' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--neon-cyan)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div className="radar-ping loading" style={{ width: '8px', height: '8px', background: 'var(--neon-cyan)', borderRadius: '50%' }}></div>
        OFFLINE AI SENSE: READY
      </div>
    </div>
  )
);
