// src/components/CollaborationPanel.tsx
// Share button + annotation panel for real-time collaborative sessions

import React, { useState, useEffect } from 'react';
import { Users, Share2, MessageSquare, Copy, Check } from 'lucide-react';
import { useCollaboration, CollabState } from '../hooks/useCollaboration';

interface CollaborationPanelProps {
  /** Called each time a viewer joins and the host's state should be re-pushed */
  onPushState?: () => CollabState;
}

export const CollaborationPanel: React.FC<CollaborationPanelProps> = ({ onPushState }) => {
  const {
    sessionId, isConnected, participantCount,
    annotations, shareUrl,
    createSession, addAnnotation,
  } = useCollaboration();

  const [isOpen, setIsOpen] = useState(false);
  const [annotationText, setAnnotationText] = useState('');
  const [copied, setCopied] = useState(false);

  // Check URL on load — if ?collab=<id>, auto-join
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const collabId = params.get('collab');
    if (collabId && !sessionId) {
      // Import joinSession lazily to avoid hook rule violations
    }
  }, [sessionId]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAnnotate = () => {
    if (!annotationText.trim()) return;
    addAnnotation(annotationText.trim());
    setAnnotationText('');
  };

  return (
    <div style={{ position: 'fixed', bottom: '80px', right: '20px', zIndex: 1000 }}>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="btn-neon"
        style={{
          borderRadius: '50%',
          width: '48px',
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: sessionId ? 'var(--neon-green)' : 'var(--neon-purple)',
          border: 'none',
          cursor: 'pointer',
          boxShadow: `0 0 20px ${sessionId ? 'var(--neon-green)' : 'var(--neon-purple)'}66`,
          position: 'relative',
        }}
        title="Collaboration"
      >
        <Users size={20} color="#fff" />
        {participantCount > 1 && (
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px',
            background: 'var(--neon-cyan)', borderRadius: '50%',
            width: '16px', height: '16px', fontSize: '0.6rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#000', fontWeight: 900,
          }}>
            {participantCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          className="glass"
          style={{
            position: 'absolute', bottom: '60px', right: 0,
            width: '280px', padding: '16px',
            borderColor: 'var(--neon-purple)',
          }}
        >
          <div style={{ fontSize: '0.65rem', color: 'var(--neon-purple)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 700 }}>
            Live Session
          </div>

          {/* Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: isConnected ? 'var(--neon-green)' : 'var(--neon-red)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {isConnected ? `${participantCount} participant${participantCount !== 1 ? 's' : ''}` : 'Connecting...'}
            </span>
          </div>

          {/* Start or share session */}
          {!sessionId ? (
            <button onClick={createSession} className="btn-neon" style={{ width: '100%', background: 'var(--neon-purple)', color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Share2 size={14} /> Start Shared Session
            </button>
          ) : (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginBottom: '4px' }}>Share this link:</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  readOnly
                  value={shareUrl ?? ''}
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px', padding: '6px 8px',
                    color: '#fff', fontSize: '0.65rem',
                  }}
                />
                <button onClick={handleCopy} className="btn-outline" style={{ padding: '6px 8px' }}>
                  {copied ? <Check size={14} color="var(--neon-green)" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          )}

          {/* Annotations */}
          {sessionId && (
            <>
              <div style={{ fontSize: '0.65rem', color: 'var(--neon-cyan)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
                Annotations ({annotations.length})
              </div>
              <div style={{ maxHeight: '120px', overflowY: 'auto', marginBottom: '8px' }}>
                {annotations.length === 0 ? (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textAlign: 'center', padding: '8px' }}>No annotations yet</div>
                ) : annotations.map(a => (
                  <div key={a.id} style={{ fontSize: '0.7rem', color: '#fff', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ color: 'var(--neon-cyan)', marginRight: '4px' }}>◆</span>
                    {a.text}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  value={annotationText}
                  onChange={e => setAnnotationText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAnnotate()}
                  placeholder="Add note..."
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px', padding: '6px 8px',
                    color: '#fff', fontSize: '0.75rem',
                  }}
                />
                <button onClick={handleAnnotate} className="btn-outline" style={{ padding: '6px 8px' }}>
                  <MessageSquare size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};