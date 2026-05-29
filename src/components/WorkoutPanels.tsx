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

export const RepsPanel = ({ reps, statusColor, isStatic, holdTime, leftRepCount, rightRepCount }: { reps: number, statusColor: string, isStatic?: boolean, holdTime?: number, leftRepCount?: number, rightRepCount?: number }) => (
  <div className="rep-counter workout-reps-panel animate-in" style={{ textAlign: 'center' }}>
    {leftRepCount !== undefined && rightRepCount !== undefined ? (
      <>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '48px' }}>
          <div style={{ textAlign: 'center' }}>
            <div aria-live="polite" aria-atomic="true" style={{ fontFamily: 'var(--font-heading)', fontSize: '3.5rem', fontWeight: 900, lineHeight: 1, color: '#fff', textShadow: `0 0 40px ${statusColor}44` }}>{leftRepCount}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--neon-cyan)', letterSpacing: '2px', textTransform: 'uppercase' }}>LEFT</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div aria-live="polite" aria-atomic="true" style={{ fontFamily: 'var(--font-heading)', fontSize: '3.5rem', fontWeight: 900, lineHeight: 1, color: '#fff', textShadow: `0 0 40px ${statusColor}44` }}>{rightRepCount}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--neon-cyan)', letterSpacing: '2px', textTransform: 'uppercase' }}>RIGHT</div>
          </div>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', letterSpacing: '4px', textTransform: 'uppercase', marginTop: '8px' }}>REPETITIONS</div>
      </>
    ) : (
      <>
        <div
          aria-live="polite"
          aria-atomic="true"
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '7rem',
            fontWeight: 900,
            lineHeight: 1,
            color: '#fff',
            textShadow: `0 0 40px ${statusColor}44`
          }}
        >
          {isStatic ? (
            <span className="sr-only">Hold Time: {Math.floor(holdTime || 0)} seconds</span>
          ) : (
            <span className="sr-only">Rep Count: {reps}</span>
          )}
          <span aria-hidden="true">{isStatic ? `${Math.floor(holdTime || 0)}s` : reps}</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', letterSpacing: '4px', textTransform: 'uppercase' }}>
          {isStatic ? "HOLD TIME" : "REPETITIONS"}
        </div>
      </>
    )}
  </div>
);

interface EnginePanelProps {
  status: string;
  statusColor: string;
  reps?: number;
  stage?: string;
  frameScore?: number;
}
export const EnginePanel = ({ status, statusColor, reps, stage, frameScore }: EnginePanelProps) => (
  <div className="glass workout-stat-card animate-in" style={{ borderLeft: `3px solid ${statusColor}`, minWidth: '200px' }}>
    <div style={{ fontSize: '0.75rem', color: statusColor, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
      <Activity size={14} /> AI ENGINE: {status === 'green' ? 'STABLE' : 'CORRECTION REQUIRED'}
    </div>
    {reps !== undefined && (
      <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '6px', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span>REPS: {reps} | STAGE: {stage} | FORM: {frameScore}%</span>
      </div>
    )}
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
