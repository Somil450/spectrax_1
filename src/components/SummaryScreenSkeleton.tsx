import React from 'react';

const SkeletonBlock = ({ width = '100%', height = '16px', borderRadius = '8px', style = {} }: {
  width?: string;
  height?: string;
  borderRadius?: string;
  style?: React.CSSProperties;
}) => (
  <div style={{
    width,
    height,
    borderRadius,
    background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.05) 75%)',
    backgroundSize: '600px 100%',
    animation: 'skeletonShimmer 1.6s infinite linear',
    ...style
  }} />
);

export const SummaryScreenSkeleton: React.FC = () => {
  return (
    <>
      {/* Inject keyframes once */}
      <style>{`
        @keyframes skeletonShimmer {
          0%   { background-position: -600px 0; }
          100% { background-position:  600px 0; }
        }
      `}</style>

      <div
        className="screen-container"
        style={{
          background: 'radial-gradient(ellipse at 50% 20%, #151b4d 0%, var(--bg-primary) 70%)',
          padding: '60px 40px',
          alignItems: 'center',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '30px', width: '100%', maxWidth: '600px' }}>
          <SkeletonBlock width="55%" height="28px" style={{ margin: '0 auto 12px' }} />
          <SkeletonBlock width="70%" height="14px" style={{ margin: '0 auto' }} />
        </div>

        {/* Accuracy Ring */}
        <div
          className="glass"
          style={{
            width: '220px', height: '220px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', marginBottom: '30px',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {/* Outer ring shimmer */}
          <svg width="180" height="180" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
            <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
            <circle
              cx="80" cy="80" r="70" fill="none"
              stroke="rgba(255,255,255,0.1)" strokeWidth="10"
              strokeDasharray="440"
              strokeDashoffset="110"
              strokeLinecap="round"
              style={{ animation: 'skeletonShimmer 1.6s infinite linear' }}
            />
          </svg>
          {/* Center text placeholder */}
          <div style={{ position: 'absolute', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <SkeletonBlock width="80px" height="48px" borderRadius="8px" />
            <SkeletonBlock width="90px" height="10px" />
          </div>
        </div>

        {/* Core Metrics — 3 cards */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '15px', width: '100%', maxWidth: '600px', marginBottom: '20px'
        }}>
          {['var(--neon-green)', 'var(--neon-cyan)', 'var(--neon-purple)'].map((color, i) => (
            <div
              key={i}
              className="glass"
              style={{ padding: '20px 10px', textAlign: 'center', borderTop: `2px solid ${color}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}
            >
              <SkeletonBlock width="20px" height="20px" borderRadius="50%" />
              <SkeletonBlock width="50%" height="22px" />
              <SkeletonBlock width="80%" height="10px" />
            </div>
          ))}
        </div>

        {/* Rep Quality Insights */}
        <div
          className="glass"
          style={{
            width: '100%', maxWidth: '600px', padding: '20px',
            marginBottom: '20px', display: 'flex',
            justifyContent: 'space-around', alignItems: 'center'
          }}
        >
          {[0, 1, 2].map((i) => (
            <React.Fragment key={i}>
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <SkeletonBlock width="100px" height="10px" />
                <SkeletonBlock width="50px" height="20px" />
              </div>
              {i < 2 && (
                <div style={{ width: '1px', height: '40px', background: 'rgba(255,255,255,0.1)' }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Mistake & Streak cards */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr',
          gap: '15px', width: '100%', maxWidth: '600px', marginBottom: '30px'
        }}>
          {[0, 1].map((i) => (
            <div
              key={i}
              className="glass"
              style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}
            >
              <SkeletonBlock width="40%" height="10px" />
              <SkeletonBlock width="65%" height="18px" />
            </div>
          ))}
        </div>

        {/* Session Rating bar */}
        <div
          className="glass"
          style={{
            width: '100%', maxWidth: '600px',
            padding: '15px', marginBottom: '40px',
            display: 'flex', justifyContent: 'center'
          }}
        >
          <SkeletonBlock width="50%" height="14px" />
        </div>

        {/* Action Buttons */}
        {/* Action Buttons */}
<div style={{
  display: 'flex', gap: '20px',
  width: '100%', maxWidth: '600px'
}}>
  <div style={{
    flex: 1, height: '52px', borderRadius: '32px',
    border: '1.5px solid rgba(0, 240, 255, 0.4)',
    background: 'linear-gradient(90deg, var(--glass-border) 25%, rgba(0,240,255,0.08) 50%, var(--glass-border) 75%)',
    backgroundSize: '600px 100%',
    animation: 'skeletonShimmer 1.6s infinite linear',
  }} />
  <div style={{
    flex: 1, height: '52px', borderRadius: '32px',
    border: '1.5px solid rgba(168, 85, 247, 0.5)',
    background: 'linear-gradient(90deg, rgba(168,85,247,0.15) 25%, rgba(168,85,247,0.25) 50%, rgba(168,85,247,0.15) 75%)',
    backgroundSize: '600px 100%',
    animation: 'skeletonShimmer 1.6s infinite linear',
  }} />
</div>

      </div>
    </>
  );
};