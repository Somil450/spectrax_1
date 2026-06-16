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

export const RepsPanel = ({ reps, statusColor, isStatic, holdTime }: { reps: number, statusColor: string, isStatic?: boolean, holdTime?: number }) => (
  <div className="rep-counter workout-reps-panel animate-in" style={{ textAlign: 'center' }}>
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

export const RiskPanel = ({
  riskIndex,
  fatigueIndex,
  asymmetryScore,
  recommendedStopRep,
}: {
  riskIndex: number;
  fatigueIndex: number;
  asymmetryScore: number;
  recommendedStopRep: number | null;
}) => {
  const riskColor = riskIndex >= 75 ? "var(--neon-red)" : riskIndex >= 50 ? "var(--neon-yellow)" : "var(--neon-green)";
  const riskLabel = riskIndex >= 75 ? "HIGH RISK" : riskIndex >= 50 ? "ELEVATED" : "LOW RISK";

  return (
    <div className="glass workout-stat-card workout-risk-panel animate-in" style={{ borderLeft: `3px solid ${riskColor}` }}>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>
        Injury Risk Index
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
        <span style={{ fontFamily: 'var(--font-heading)', color: riskColor, fontSize: '2rem', fontWeight: 900 }}>
          {riskIndex}
        </span>
        <span style={{ fontSize: '0.75rem', color: riskColor, fontWeight: 700 }}>/ 100</span>
      </div>
      <div style={{ fontSize: '0.7rem', color: riskColor, fontWeight: 700, marginBottom: '8px' }}>
        {riskLabel}
      </div>
      <div style={{ display: 'flex', gap: '12px', fontSize: '0.65rem', color: 'var(--text-dim)' }}>
        <span>FATIGUE: {fatigueIndex}</span>
        <span>ASYM: {asymmetryScore}</span>
      </div>
      {recommendedStopRep !== null && (
        <div style={{ marginTop: '8px', fontSize: '0.7rem', color: 'var(--neon-red)', fontWeight: 700, background: 'rgba(255,34,85,0.1)', padding: '4px 8px', borderRadius: '4px' }}>
          STOP AT REP {recommendedStopRep}
        </div>
      )}
export const TutPanel = ({
  tutMetrics,
  statusColor,
}: {
  tutMetrics?: {
    eccentricMs: number;
    concentricMs: number;
    isometricMs: number;
    tempoRatio: string;
    totalRepMs: number;
  };
  statusColor: string;
}) => {
  if (!tutMetrics) return null;

  const eccSec = Math.round(tutMetrics.eccentricMs / 1000);
  const conSec = Math.round(tutMetrics.concentricMs / 1000);
  const isoSec = Math.round(tutMetrics.isometricMs / 1000);
  const total = eccSec + conSec + isoSec || 1;

  const eccPct = (eccSec / total) * 100;
  const conPct = (conSec / total) * 100;
  const isoPct = (isoSec / total) * 100;

  return (
    <div
      className="glass workout-stat-card workout-tut-panel animate-in"
      style={{
        padding: "12px 16px",
        minWidth: "200px",
      }}
    >
      <div
        style={{
          fontSize: "0.65rem",
          color: "var(--text-dim)",
          letterSpacing: "2px",
          textTransform: "uppercase",
          marginBottom: "8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>TEMPO</span>
        <span style={{ color: statusColor, fontWeight: 700 }}>{tutMetrics.tempoRatio}</span>
      </div>

      {/* Stacked bar: Eccentric (down) | Isometric (hold) | Concentric (up) */}
      <div
        style={{
          display: "flex",
          height: "8px",
          borderRadius: "4px",
          overflow: "hidden",
          background: "rgba(255,255,255,0.05)",
          marginBottom: "6px",
        }}
      >
        <div
          style={{
            width: `${eccPct}%`,
            background: "var(--neon-yellow)",
            transition: "width 0.3s ease",
          }}
          title="Eccentric (lowering)"
        />
        <div
          style={{
            width: `${isoPct}%`,
            background: "var(--text-dim)",
            transition: "width 0.3s ease",
          }}
          title="Isometric (hold)"
        />
        <div
          style={{
            width: `${conPct}%`,
            background: statusColor,
            transition: "width 0.3s ease",
          }}
          title="Concentric (lifting)"
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.6rem",
          color: "var(--text-dim)",
          letterSpacing: "1px",
        }}
      >
        <span style={{ color: "var(--neon-yellow)" }}>{eccSec}s ↓</span>
        <span>{isoSec}s ◆</span>
        <span style={{ color: statusColor }}>{conSec}s ↑</span>
      </div>
    </div>
  );
};

export const AngleDialPanel = ({
  angle,
  label,
  min = 0,
  max = 180,
  statusColor,
}: {
  angle: number;
  label: string;
  min?: number;
  max?: number;
  statusColor: string;
}) => {
  const clampedAngle = Math.min(max, Math.max(min, angle || 0));
  const p = (clampedAngle - min) / (max - min);
  const totalArc = 188.49; // 270 degrees on r=40 circle
  const filledArc = p * totalArc;
  const needleRotation = -135 + p * 270;

  return (
    <div
      className="glass workout-stat-card workout-dial-panel animate-in"
      style={{
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "12px 16px",
        minWidth: "150px",
      }}
    >
      <div
        style={{
          fontSize: "0.65rem",
          color: "var(--text-dim)",
          letterSpacing: "2px",
          textTransform: "uppercase",
          marginBottom: "8px",
        }}
      >
        {label.toUpperCase()} DIAL
      </div>
      <div style={{ position: "relative", width: "120px", height: "120px" }}>
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          style={{ transform: "rotate(90deg)" }}
        >
          <defs>
            <filter id="dial-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Background Track Circle */}
          <circle
            cx="60"
            cy="60"
            r="40"
            fill="none"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth="8"
            strokeDasharray="188.49 251.32"
            strokeLinecap="round"
            style={{ transformOrigin: "60px 60px", transform: "rotate(45deg)" }}
          />
          {/* Active Arc Gauges */}
          <circle
            cx="60"
            cy="60"
            r="40"
            fill="none"
            stroke={statusColor}
            strokeWidth="8"
            strokeDasharray={`${filledArc} 251.32`}
            strokeLinecap="round"
            filter="url(#dial-glow)"
            style={{
              transformOrigin: "60px 60px",
              transform: "rotate(45deg)",
              transition: "stroke-dasharray 0.15s ease-out, stroke 0.3s ease",
            }}
          />
          {/* Needle Indicator */}
          <line
            x1="60"
            y1="60"
            x2="60"
            y2="28"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            filter="url(#dial-glow)"
            style={{
              transformOrigin: "60px 60px",
              transform: `rotate(${needleRotation}deg)`,
              transition: "transform 0.15s ease-out",
            }}
          />
          {/* Center Hub */}
          <circle cx="60" cy="60" r="5" fill="#fff" filter="url(#dial-glow)" />
        </svg>
        {/* Numerical Readout Overlay in Center */}
        <div
          style={{
            position: "absolute",
            top: "62%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#fff",
            fontFamily: "var(--font-heading)",
            fontSize: "1.1rem",
            fontWeight: 800,
            textShadow: `0 0 10px ${statusColor}`,
          }}
        >
          {Math.round(clampedAngle)}°
        </div>
      </div>
    </div>
  );
};

