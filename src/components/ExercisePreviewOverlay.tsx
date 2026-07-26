import React, { useState } from 'react';
import { Dumbbell } from 'lucide-react';

interface ExercisePreviewOverlayProps {
  demoUrl?: string;
  exerciseName?: string;
  isVisible: boolean;
  placement?: 'left' | 'right' | 'above';
  width?: number;
}

export const ExercisePreviewOverlay: React.FC<ExercisePreviewOverlayProps> = ({
  demoUrl,
  exerciseName,
  isVisible,
  placement = 'above',
  width = 220,
}) => {
  const [hasError, setHasError] = useState(false);

  if (!isVisible) {
    return null;
  }

  // Base styles shared across all placements
  const baseStyles: React.CSSProperties = {
    position: 'absolute',
    width: `${width}px`,
    borderRadius: '12px',
    overflow: 'hidden',
    border: '2px solid var(--neon-cyan)',
    boxShadow: '0 0 25px rgba(0, 240, 255, 0.3)',
    backgroundColor: '#000',
    zIndex: 50,
    pointerEvents: 'none',
  };

  // Placement-specific positioning
  let positionStyles: React.CSSProperties;

  if (placement === 'above') {
    positionStyles = {
      ...baseStyles,
      bottom: 'calc(100% + 8px)',
      left: '50%',
      transform: 'translateX(-50%)',
    };
  } else if (placement === 'left') {
    positionStyles = {
      ...baseStyles,
      right: 'calc(100% + 8px)',
      top: '50%',
      transform: 'translateY(-50%)',
    };
  } else {
    positionStyles = {
      ...baseStyles,
      left: 'calc(100% + 8px)',
      top: '50%',
      transform: 'translateY(-50%)',
    };
  }

  // If no video or video failed to load, show a stylish fallback
  if (!demoUrl || hasError) {
    return (
      <div className="animate-in" style={positionStyles}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px',
          background: 'linear-gradient(135deg, rgba(10, 15, 30, 0.95), rgba(20, 10, 40, 0.95))',
          gap: '10px',
        }}>
          <Dumbbell 
            size={32} 
            style={{ 
              color: 'var(--neon-cyan)', 
              opacity: 0.6,
              filter: 'drop-shadow(0 0 8px rgba(0, 240, 255, 0.4))',
            }} 
          />
          <span style={{ 
            fontSize: '0.7rem', 
            color: 'var(--text-secondary)', 
            textAlign: 'center',
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}>
            {exerciseName || 'Exercise'}
          </span>
          <span style={{ 
            fontSize: '0.55rem', 
            color: 'var(--text-dim)', 
            opacity: 0.7,
          }}>
            Preview coming soon
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in" style={positionStyles}>
      <video
        src={demoUrl}
        autoPlay
        loop
        muted
        playsInline
        onError={() => setHasError(true)}
        style={{ width: '100%', display: 'block', objectFit: 'cover' }}
      />
    </div>
  );
};
