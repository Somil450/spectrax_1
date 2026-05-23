import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class CameraErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Camera/WebGL Error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    // In a real app we might re-initialize WebGL context here
    // For now, refreshing the screen ensures pure state recovery
    window.location.reload(); 
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          zIndex: 50,
          padding: '20px',
          textAlign: 'center',
          backdropFilter: 'blur(10px)'
        }}>
          <AlertTriangle size={56} color="#ff4466" style={{ marginBottom: '16px' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '8px', color: '#ff4466', letterSpacing: '2px' }}>
            CAMERA OR WEBGL CRASH DETECTED
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginBottom: '24px', maxWidth: '400px', lineHeight: '1.5' }}>
            {this.state.error?.message || 'An unexpected error occurred in the visual tracking pipeline. The rest of the interface remains active.'}
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              background: 'transparent',
              border: '1px solid #00ffff',
              color: '#00ffff',
              padding: '12px 28px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontWeight: 700,
              fontSize: '0.8rem',
              letterSpacing: '1px',
              transition: 'all 0.2s ease',
              boxShadow: '0 0 15px rgba(0,255,255,0.15)'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,255,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <RefreshCw size={18} /> RESTART SUBSYSTEM
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
