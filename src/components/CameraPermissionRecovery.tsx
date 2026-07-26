import React from 'react';
import { Camera, RefreshCw } from 'lucide-react';

interface CameraPermissionRecoveryProps {
  onRetry: () => void;
}

export const CameraPermissionRecovery: React.FC<CameraPermissionRecoveryProps> = ({ onRetry }) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(8,12,20,0.95)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        padding: '20px',
        textAlign: 'center',
        backdropFilter: 'blur(10px)',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          margin: 'auto',
          width: '100%',
          maxWidth: '500px',
          padding: '32px',
          border: '1px solid var(--neon-red, #ff3b5c)',
          background: 'rgba(255, 59, 92, 0.05)',
          borderRadius: '16px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'rgba(255, 59, 92, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Camera size={40} color="var(--neon-red, #ff3b5c)" />
          </div>
        </div>

        <h2
          style={{
            fontSize: 'clamp(1.2rem, 4vw, 1.5rem)',
            marginBottom: '16px',
            color: '#ef4444',
            fontFamily: 'var(--font-heading)',
          }}
        >
          CAMERA ACCESS BLOCKED
        </h2>

        <p
          style={{
            color: '#94a3b8',
            lineHeight: 1.6,
            marginBottom: '24px',
            fontSize: '0.95rem',
            textAlign: 'left',
          }}
        >
          SpectraX needs camera access to track your movements. It looks like the permission was denied.
          <br /><br />
          <strong>How to unblock:</strong>
          <ol style={{ paddingLeft: '20px', marginTop: '12px' }}>
            <li>Click the site information icon (🔒 or ⓘ) in the left side of your browser's address bar.</li>
            <li>Find the <strong>Camera</strong> setting.</li>
            <li>Change the permission to <strong>Allow</strong>.</li>
            <li>Click <strong>Try Again</strong> below.</li>
          </ol>
        </p>

        <div style={{ display: 'flex', gap: '16px', flexDirection: 'column' }}>
          <button
            onClick={onRetry}
            className="btn-primary"
            style={{
              padding: '14px 24px',
              width: '100%',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              letterSpacing: '1px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: 'var(--neon-red, #ff3b5c)',
              color: 'white',
              border: 'none',
            }}
          >
            <RefreshCw size={20} />
            TRY AGAIN
          </button>
          
          <button
            onClick={() => window.location.reload()}
            className="btn-outline"
            style={{
              borderColor: 'var(--neon-red, #ff3b5c)',
              color: 'var(--neon-red, #ff3b5c)',
              padding: '12px 24px',
              width: '100%',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              letterSpacing: '1px',
              background: 'transparent',
            }}
          >
            RELOAD PAGE
          </button>
        </div>
      </div>
    </div>
  );
};
