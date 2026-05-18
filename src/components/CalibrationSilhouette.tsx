import React from 'react';

interface CalibrationSilhouetteProps {
  visible: boolean;
}

export const CalibrationSilhouette: React.FC<CalibrationSilhouetteProps> = ({ visible }) => {
  if (!visible) return null;

  return (
    <div className="calibration-silhouette" aria-hidden="true">
      <svg viewBox="0 0 120 280" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="60" cy="28" rx="18" ry="22" stroke="currentColor" strokeWidth="2" />
        <line x1="60" y1="50" x2="60" y2="130" stroke="currentColor" strokeWidth="2" />
        <line x1="60" y1="70" x2="30" y2="110" stroke="currentColor" strokeWidth="2" />
        <line x1="60" y1="70" x2="90" y2="110" stroke="currentColor" strokeWidth="2" />
        <line x1="30" y1="110" x2="22" y2="150" stroke="currentColor" strokeWidth="2" />
        <line x1="90" y1="110" x2="98" y2="150" stroke="currentColor" strokeWidth="2" />
        <line x1="60" y1="130" x2="42" y2="200" stroke="currentColor" strokeWidth="2" />
        <line x1="60" y1="130" x2="78" y2="200" stroke="currentColor" strokeWidth="2" />
        <line x1="42" y1="200" x2="38" y2="260" stroke="currentColor" strokeWidth="2" />
        <line x1="78" y1="200" x2="82" y2="260" stroke="currentColor" strokeWidth="2" />
      </svg>

      <style>{`
        .calibration-silhouette {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          z-index: 5;
          color: rgba(0, 240, 255, 0.45);
        }
        .calibration-silhouette svg {
          width: min(35vw, 180px);
          height: auto;
          opacity: 0.55;
          filter: drop-shadow(0 0 12px rgba(0, 240, 255, 0.3));
          animation: silhouettePulse 2.5s ease-in-out infinite;
        }
        @keyframes silhouettePulse {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
};
