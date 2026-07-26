import React, { Component, ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  onRecover?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PageErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('PageErrorBoundary caught an error:', error, errorInfo);
  }

  private handleRecover = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRecover) {
      this.props.onRecover();
    } else {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '20px',
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-body)'
        }}>
          <AlertOctagon size={64} color="var(--neon-red)" style={{ marginBottom: '24px' }} />
          <h2 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.8rem',
            marginBottom: '16px',
            color: 'var(--text-primary)'
          }}>
            Something went wrong
          </h2>
          <p style={{
            color: 'var(--text-secondary)',
            marginBottom: '32px',
            maxWidth: '500px',
            textAlign: 'center',
            lineHeight: 1.6
          }}>
            {this.props.fallbackMessage || 'An unexpected error occurred while loading this page. Our team has been notified.'}
          </p>
          
          <button 
            onClick={this.handleRecover}
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: 'var(--neon-red)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            <RotateCcw size={18} />
            Recover Page
          </button>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre style={{
              marginTop: '40px',
              padding: '16px',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '8px',
              maxWidth: '800px',
              overflowX: 'auto',
              color: '#ff8888',
              fontSize: '0.8rem',
              border: '1px solid #330000'
            }}>
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
