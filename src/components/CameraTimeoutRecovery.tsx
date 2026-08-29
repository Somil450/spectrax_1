import React from 'react';
import { TimerOff, RefreshCw } from 'lucide-react';

interface CameraTimeoutRecoveryProps {
  onRetry: () => void;
}

/**
 * Fallback feedback shown when the camera fails to initialize within the
 * allowed timeout. On slow devices or unstable connections the webcam can
 * take too long (or never become ready); instead of leaving the loading
 * state visible indefinitely this screen explains what happened and offers
 * an in-place retry plus a full reload fallback.
 */
export const CameraTimeoutRecovery: React.FC<CameraTimeoutRecoveryProps> = ({ onRetry }) => {
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
          border: '1px solid var(--neon-yellow, #facc15)',
          background: 'rgba(250, 204, 21, 0.05)',
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
              background: 'rgba(250, 204, 21, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TimerOff size={40} color="var(--neon-yellow, #facc15)" />
          </div>
        </div>

        <h2
          style={{
            fontSize: 'clamp(1.2rem, 4vw, 1.5rem)',
            marginBottom: '16px',
            color: '#facc15',
            fontFamily: 'var(--font-heading)',
          }}
        >
          CAMERA INITIALIZATION TIMEOUT
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
          SpectraX waited but your camera did not finish starting up. This usually
          happens on slow devices or unstable connections.
          <br /><br />
          <strong>Try this:</strong>
          <ol style={{ paddingLeft: '20px', marginTop: '12px' }}>
            <li>Make sure no other app is using the camera.</li>
            <li>Close other tabs and reduce background activity.</li>
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
              background: 'var(--neon-yellow, #facc15)',
              color: '#0a0a1a',
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
              borderColor: 'var(--neon-yellow, #facc15)',
              color: 'var(--neon-yellow, #facc15)',
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
