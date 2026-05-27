import React from 'react';

export function HistoryPageSkeleton() {
  return (
    <div style={{ padding: '28px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      {/* Header Skeleton */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <div style={{ width: '80px', height: '32px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', animation: 'pulse 1.5s infinite' }} />
        <div style={{ width: '200px', height: '32px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', animation: 'pulse 1.5s infinite' }} />
      </div>

      {/* Summary Bar Skeleton */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
        <div style={{ width: '100px', height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', animation: 'pulse 1.5s infinite' }} />
        <div style={{ width: '100px', height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', animation: 'pulse 1.5s infinite' }} />
        <div style={{ width: '100px', height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', animation: 'pulse 1.5s infinite' }} />
      </div>

      {/* Filter Panel Skeleton */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
        <div style={{ width: '120px', height: '32px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', animation: 'pulse 1.5s infinite' }} />
        <div style={{ width: '120px', height: '32px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', animation: 'pulse 1.5s infinite' }} />
      </div>

      {/* Grid Skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ 
            height: '180px', 
            background: 'rgba(255,255,255,0.03)', 
            borderRadius: '16px', 
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ width: '60%', height: '24px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
            <div style={{ width: '40%', height: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} />
            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between' }}>
               <div style={{ width: '30%', height: '32px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', animation: 'pulse 1.5s infinite' }} />
               <div style={{ width: '30%', height: '32px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', animation: 'pulse 1.5s infinite' }} />
            </div>
          </div>
        ))}
      </div>
      
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 0.3; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
