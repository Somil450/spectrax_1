import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Play, Pause, CheckCircle2, AlertTriangle, Palette } from 'lucide-react';
import { Replay3DModel } from './Replay3DModel';
import { sessionRecorder } from '../services/sessionRecorder';
import { AVATAR_SKINS } from '../utils/avatarSkins';

interface ReplayScreenProps {
  onBack: () => void;
  stats?: {
    accuracy?: number;
    reps?: number;
    exerciseName?: string;
  };
}

export const ReplayScreen: React.FC<ReplayScreenProps> = ({
  onBack,
  stats,
}) => {
  const frames = (sessionRecorder as any).frames || [];
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedSkin, setSelectedSkin] = useState<string>(AVATAR_SKINS.STANDARD_HUMAN);

  // Stable session ID (was Math.random() inline in JSX — wrong)
  const [sessionId] = useState(() =>
    Math.random().toString(36).substr(2, 6).toUpperCase()
  );

  // Derive live vectors from current frame
  const currentFrame = frames[currentFrameIdx];
  const lm = currentFrame?.landmarks;

  const calcAngle = (a: any, b: any, c: any): number => {
    if (!a || !b || !c) return 0;
    const v1 = { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) };
    const v2 = { x: c.x - b.x, y: c.y - b.y, z: (c.z || 0) - (b.z || 0) };
    const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2);
    const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2 + v2.z ** 2);
    if (mag1 === 0 || mag2 === 0) return 0;
    return Math.round(
      (Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * 180) /
        Math.PI,
    );
  };

  const kneeAngle     = lm ? calcAngle(lm[23], lm[25], lm[27]) : 0;
  const elbowAngle    = lm ? calcAngle(lm[11], lm[13], lm[15]) : 0;
  const shoulderAngle = lm ? calcAngle(lm[23], lm[11], lm[13]) : 0;
  const hipAngle      = lm ? calcAngle(lm[11], lm[23], lm[25]) : 0;
  const bodyline      = lm ? calcAngle(lm[23], lm[11], lm[25]) : 0;

  const isGoodForm     = currentFrame?.feedback?.includes('Good form') || false;
  const accuracy       = stats?.accuracy ?? 0;
  const alignmentScore = lm ? Math.min(100, Math.round((kneeAngle / 177) * 100)) : 0;

  // History of joint angles for SVG chart
  const [angleHistory, setAngleHistory] = useState<
    Array<{
      frame: number;
      knee: number;
      elbow: number;
      shoulder: number;
      hip: number;
      bodyline: number;
    }>
  >([]);

  // Record angles each frame
  useEffect(() => {
    if (!lm) return;
    const entry = {
      frame: currentFrameIdx,
      knee: kneeAngle,
      elbow: elbowAngle,
      shoulder: shoulderAngle,
      hip: hipAngle,
      bodyline: bodyline,
    };
    setAngleHistory((prev) => {
      const next = [...prev, entry];
      return next.length > 60 ? next.slice(next.length - 60) : next;
    });
  }, [currentFrameIdx, kneeAngle, elbowAngle, shoulderAngle, hipAngle, bodyline, lm]);

  // Auto-advance frames when playing
  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;
    const interval = setInterval(() => {
      setCurrentFrameIdx((prev) => {
        if (prev >= frames.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 66); // ~15fps
    return () => clearInterval(interval);
  }, [isPlaying, frames.length]);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: 'var(--bg-primary)',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Rajdhani', 'Orbitron', 'Inter', sans-serif",
      }}
    >
      {/* ── TOP HEADER ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          padding: '20px 24px',
          zIndex: 20,
          pointerEvents: 'none',
        }}
      >
        {/* Top-left badge — FIX: was an unclosed <div> with duplicate children */}
        <div
          style={{
            background: 'rgba(0,255,255,0.08)',
            border: '1px solid rgba(0,255,255,0.25)',
            borderRadius: '8px',
            padding: '10px 16px',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div
            style={{
              color: '#00ffff',
              fontSize: '0.85rem',
              fontWeight: 700,
              letterSpacing: '2px',
            }}
          >
            3D SPATIAL REPLAY
          </div>
          <div
            style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.6rem',
              letterSpacing: '1px',
              marginTop: '2px',
            }}
          >
            {stats?.exerciseName?.toUpperCase() || "SQUAT"} MODULE — SESSION #
            {sessionId}
          </div>
        </div>

        {/* Top-center STATUS */}
        <div style={{ textAlign: 'center', pointerEvents: 'none' }}>
          <div
            style={{
              fontSize: '0.65rem',
              letterSpacing: '3px',
              color: isGoodForm ? '#00ff88' : '#ffcc00',
              textTransform: 'uppercase',
              marginBottom: '4px',
            }}
          >
            STATUS: {isGoodForm ? 'OPTIMAL' : 'CALIBRATING'}
          </div>
          <div
            style={{
              fontSize: '1.8rem',
              fontWeight: 900,
              color: isGoodForm ? '#00ff88' : '#ffcc00',
              letterSpacing: '1px',
              textShadow: isGoodForm ? '0 0 20px #00ff8888' : '0 0 20px #ffcc0088',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {isGoodForm ? (
              <><CheckCircle2 size={28} /> GOOD FORM</>
            ) : (
              <><AlertTriangle size={28} /> ADJUST FORM</>
            )}
          </div>
        </div>

        {/* Exit button */}
        <button
          onClick={onBack}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
            padding: '10px 18px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '1.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            pointerEvents: 'all',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
        >
          <LayoutDashboard size={14} /> EXIT REPLAY
        </button>
      </div>

      {/* ── RIGHT SETTINGS PANEL ── */}
      <div
        style={{
          position: 'absolute',
          top: '90px',
          right: '20px',
          width: '260px',
          zIndex: 20,
          background: 'rgba(0,0,0,0.7)',
          border: '1px solid rgba(0,255,255,0.15)',
          borderRadius: '10px',
          padding: '16px',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 0 30px rgba(0,255,255,0.05)',
        }}
      >
        <div
          style={{
            fontSize: '0.7rem',
            letterSpacing: '2px',
            color: 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase',
            fontWeight: 700,
            marginBottom: '14px',
            paddingBottom: '8px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Palette size={14} color="#00ffff" /> AVATAR CUSTOMIZATION
        </div>

        <div
          style={{
            marginBottom: '8px',
            fontSize: '0.72rem',
            color: 'rgba(255,255,255,0.6)',
            letterSpacing: '1px',
          }}
        >
          SELECT AVATAR SKIN
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { id: AVATAR_SKINS.STANDARD_HUMAN, label: 'STANDARD HUMAN',  desc: 'Natural skin, moderate roughness' },
            { id: AVATAR_SKINS.ROBOT,           label: 'CHROME ROBOT',    desc: 'High metalness, smooth reflections' },
            { id: AVATAR_SKINS.CYBERPUNK_NEON,  label: 'CYBERPUNK NEON',  desc: 'Dark wireframe, bright emissive glow' },
          ].map((skinOption) => {
            const isSelected = selectedSkin === skinOption.id;
            return (
              <button
                key={skinOption.id}
                onClick={() => setSelectedSkin(skinOption.id)}
                style={{
                  background: isSelected ? 'rgba(0,255,255,0.15)' : 'rgba(255,255,255,0.03)',
                  border: isSelected ? '1px solid rgba(0,255,255,0.6)' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  transition: 'all 0.2s ease',
                  outline: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.border = '1px solid rgba(255,255,255,0.2)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)';
                  }
                }}
              >
                <div
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: isSelected ? '#00ffff' : '#fff',
                    letterSpacing: '1px',
                    textShadow: isSelected ? '0 0 10px rgba(0,255,255,0.5)' : 'none',
                  }}
                >
                  {skinOption.label}
                </div>
                <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.5px' }}>
                  {skinOption.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── LEFT ANALYTICS PANEL ── */}
      <div
        style={{
          position: 'absolute',
          top: '90px',
          left: '20px',
          width: '260px',
          zIndex: 20,
          background: 'rgba(0,0,0,0.7)',
          border: '1px solid rgba(0,255,255,0.15)',
          borderRadius: '10px',
          padding: '16px',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 0 30px rgba(0,255,255,0.05)',
        }}
      >
        <div
          style={{
            fontSize: '0.7rem',
            letterSpacing: '2px',
            color: 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase',
            fontWeight: 700,
            marginBottom: '14px',
            paddingBottom: '8px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          SESSION ANALYTICS
        </div>

        {/* Accuracy bar */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', letterSpacing: '1px' }}>
              Total Accuracy (AI)
            </span>
            <span style={{ fontSize: '0.72rem', color: accuracy >= 80 ? '#00ff88' : '#ff4466', fontWeight: 700 }}>
              {accuracy}%
            </span>
          </div>
          <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
            <div
              style={{
                height: '100%',
                width: `${accuracy}%`,
                background: accuracy >= 80 ? '#00ff88' : '#ff4466',
                borderRadius: '2px',
                boxShadow: accuracy >= 80 ? '0 0 6px #00ff88' : '0 0 6px #ff4466',
                transition: 'width 0.5s ease',
              }}
            />
          </div>
        </div>

        {/* Alignment bar */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', letterSpacing: '1px' }}>
              Alignment Score
            </span>
            <span style={{ fontSize: '0.72rem', color: '#00ff88', fontWeight: 700 }}>
              {alignmentScore}%
            </span>
          </div>
          <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px' }}>
            <div
              style={{
                height: '100%',
                width: `${alignmentScore}%`,
                background: '#00ff88',
                borderRadius: '2px',
                boxShadow: '0 0 6px #00ff88',
                transition: 'width 0.1s linear',
              }}
            />
          </div>
        </div>

        {/* Physical Vectors */}
        <div
          style={{
            fontSize: '0.65rem',
            letterSpacing: '2px',
            color: 'rgba(255,255,255,0.35)',
            textTransform: 'uppercase',
            fontWeight: 700,
            marginBottom: '10px',
          }}
        >
          PHYSICAL VECTORS
        </div>

        {[
          { label: 'KNEE',      value: kneeAngle,     color: '#00ff88' },
          { label: 'ELBOW',     value: elbowAngle,    color: '#00ffff' },
          { label: 'SHOULDER',  value: shoulderAngle, color: '#00ffff' },
          { label: 'BODYLINE',  value: bodyline,      color: '#00ff88' },
          { label: 'HIPDEPTH', value: hipAngle,       color: '#00ffff' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '5px 0',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', letterSpacing: '1px', fontWeight: 600 }}>
              {label}
            </span>
            <span style={{ fontSize: '0.95rem', color, fontWeight: 800, textShadow: `0 0 8px ${color}66` }}>
              {value}°
            </span>
          </div>
        ))}

        {/* Joint Angles SVG Chart */}
        {angleHistory.length > 1 && (
          <svg
            width="240"
            height="80"
            style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', marginTop: '8px' }}
          >
            <polyline
              fill="none"
              stroke="#00ffff"
              strokeWidth="2"
              points={angleHistory
                .map((d, i) => {
                  const x = (i / Math.max(1, angleHistory.length - 1)) * 240;
                  const y = 80 - (d.knee / 180) * 80;
                  return `${x},${y}`;
                })
                .join(' ')}
            />
          </svg>
        )}
      </div>

      {/* ── 3D MODEL (fills full screen) ── */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <Replay3DModel
          frames={frames}
          currentFrameIdx={currentFrameIdx}
          isPlaying={isPlaying}
          onFrameChange={setCurrentFrameIdx}
          onPlayToggle={() => setIsPlaying((p) => !p)}
          hideControls
          skin={selectedSkin}
        />
      </div>

      {/* ── BOTTOM CONTROLS ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          padding: '0 40px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
        }}
      >
        {/* Play/Pause */}
        <button
          onClick={() => setIsPlaying((p) => !p)}
          className="has-tooltip tooltip-top"
          data-tooltip={isPlaying ? "Pause" : "Play"}
          aria-label={isPlaying ? "Pause replay" : "Play replay"}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'var(--neon-purple, #9D4EDD)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(157,78,221,0.5)',
            transition: 'transform 0.1s ease',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          {isPlaying ? <Pause size={16} fill="#fff" color="#fff" /> : <Play size={16} fill="#fff" color="#fff" />}
        </button>

        {/* Scrubber */}
        <div style={{ flex: 1, position: 'relative', height: '4px' }}>
          <input
            type="range"
            min={0}
            max={Math.max(0, frames.length - 1)}
            value={currentFrameIdx}
            onChange={(e) => {
              setIsPlaying(false);
              setCurrentFrameIdx(Number(e.target.value));
            }}
            style={{
              width: '100%',
              appearance: 'none',
              background: 'transparent',
              cursor: 'pointer',
              position: 'absolute',
              top: '-8px',
              margin: 0,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'rgba(255,255,255,0.15)',
              borderRadius: '2px',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${frames.length > 1 ? (currentFrameIdx / (frames.length - 1)) * 100 : 0}%`,
                background: 'linear-gradient(90deg, #00ffff, #9D4EDD)',
                borderRadius: '2px',
                boxShadow: '0 0 8px rgba(0,255,255,0.6)',
                transition: 'width 0.05s linear',
              }}
            />
          </div>
        </div>

        {/* Frame counter */}
        <div
          style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '1px',
            minWidth: '80px',
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {String(currentFrameIdx).padStart(3, '0')} /{' '}
          {String(Math.max(0, frames.length - 1)).padStart(3, '0')}
        </div>
      </div>

      <style>{`
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px; height: 14px;
          border-radius: 50%;
          background: #fff;
          border: 2px solid #00ffff;
          box-shadow: 0 0 8px #00ffff;
          cursor: pointer;
        }
        input[type=range]::-webkit-slider-runnable-track {
          background: transparent;
        }
      `}</style>
    </div>
  );
}
